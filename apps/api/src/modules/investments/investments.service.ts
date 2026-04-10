import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { NotificationService } from '../../common/services/notification.service';
import { AuditService } from '../../common/services/audit.service';
import { SubscribeInvestmentDto, QueryInvestmentsDto } from './dto';

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async getProducts() {
    const products = await this.prisma.investmentProduct.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'desc' },
    });

    return products.map((p) => ({
      ...p,
      annualRate: Number(p.annualRate),
      minimumAmount: Number(p.minimumAmount),
    }));
  }

  async subscribe(userId: string, dto: SubscribeInvestmentDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const product = await this.prisma.investmentProduct.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== 'ACTIVE') throw new BadRequestException('Product is not active');
    if (dto.principal < Number(product.minimumAmount)) {
      throw new BadRequestException(
        `Minimum investment amount is ₦${Number(product.minimumAmount).toLocaleString()}`,
      );
    }

    // Debit wallet
    const reference = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await this.walletService.debitWallet(member.id, dto.principal, 'INVESTMENT', reference);

    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + product.durationMonths);

    const subscription = await this.prisma.investmentSubscription.create({
      data: {
        memberId: member.id,
        productId: product.id,
        principal: dto.principal,
        maturityDate,
        status: 'APPROVED',
      },
      include: { product: true },
    });

    await this.audit.log(userId, 'SUBSCRIBE_INVESTMENT', 'InvestmentSubscription', subscription.id, {
      productId: product.id,
      principal: dto.principal,
    });

    await this.notifications.notifyMember(
      userId,
      'Investment Confirmed',
      `Your investment of ₦${dto.principal.toLocaleString()} in ${product.name} is confirmed. Matures on ${maturityDate.toDateString()}.`,
    );

    return {
      ...subscription,
      principal: Number(subscription.principal),
    };
  }

  async getMyInvestments(userId: string, query: QueryInvestmentsDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { memberId: member.id };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.investmentSubscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { maturityDate: 'desc' },
        include: { product: true },
      }),
      this.prisma.investmentSubscription.count({ where }),
    ]);

    return {
      items: items.map((i) => ({
        ...i,
        principal: Number(i.principal),
        product: i.product
          ? { ...i.product, annualRate: Number(i.product.annualRate), minimumAmount: Number(i.product.minimumAmount) }
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  async approveSubscription(id: string, actorId: string) {
    const subscription = await this.prisma.investmentSubscription.findUnique({
      where: { id },
      include: { member: true, product: true },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (subscription.status !== 'PENDING') throw new BadRequestException('Not pending');

    const updated = await this.prisma.investmentSubscription.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    await this.audit.log(actorId, 'APPROVE_INVESTMENT', 'InvestmentSubscription', id);

    await this.notifications.notifyMember(
      subscription.member.userId,
      'Investment Approved',
      `Your investment in ${subscription.product.name} has been approved.`,
    );

    return { ...updated, principal: Number(updated.principal) };
  }
}
