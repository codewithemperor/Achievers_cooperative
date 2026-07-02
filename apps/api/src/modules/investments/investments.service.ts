import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { NotificationService } from '../../common/services/notification.service';
import { AuditService } from '../../common/services/audit.service';
import { SubscribeInvestmentDto, QueryInvestmentsDto } from './dto/index';
import { normalizePagination } from '../../common/pagination';
import { formatMoney, normalizeMoney } from '../../common/utils/money';

@Injectable()
export class InvestmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WalletService) private readonly walletService: WalletService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async getProducts() {
    const products = await this.prisma.investmentProduct.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'desc' },
      include: {
        subscriptions: {
          include: {
            cancellationRequests: { select: { id: true, status: true } },
          },
        },
      },
    });

    return products.map((p) => {
      const activeSubscriptions = p.subscriptions.filter((item) => item.status === 'APPROVED');

      return {
      ...p,
      annualRate: Number(p.annualRate),
      minimumAmount: Number(p.minimumAmount),
      maximumAmount: p.maximumAmount ? Number(p.maximumAmount) : null,
      subscriberCount: activeSubscriptions.length,
      amountSubscribed: activeSubscriptions.reduce((sum, item) => sum + Number(item.principal), 0),
      withdrawalCount: p.subscriptions.reduce((sum, item) => sum + item.cancellationRequests.length, 0),
      subscriptions: undefined,
      };
    });
  }

  async createProduct(
    actorId: string,
    body: {
      name: string;
      annualRate: number;
      minimumAmount: number;
      maximumAmount?: number;
      durationMonths: number;
      status?: string;
    },
  ) {
    const created = await this.prisma.investmentProduct.create({
      data: {
        ...body,
        status: body.status ?? 'ACTIVE',
      },
    });

    await this.audit.log(actorId, 'CREATE_INVESTMENT_PRODUCT', 'InvestmentProduct', created.id, body);

    return {
      ...created,
      annualRate: Number(created.annualRate),
      minimumAmount: Number(created.minimumAmount),
      maximumAmount: created.maximumAmount ? Number(created.maximumAmount) : null,
    };
  }

  async getProduct(id: string) {
    const product = await this.prisma.investmentProduct.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            member: { select: { id: true, fullName: true, membershipNumber: true } },
            cancellationRequests: {
              include: {
                member: { select: { id: true, fullName: true, membershipNumber: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { maturityDate: 'desc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Investment product not found');
    }

    const subscriptions = product.subscriptions.map((subscription) => ({
      ...subscription,
      principal: Number(subscription.principal),
      maturityAmount:
        subscription.status === 'APPROVED'
          ? Number(subscription.principal) +
            Number(subscription.principal) * (Number(product.annualRate) / 100) * (product.durationMonths / 12)
          : Number(subscription.principal),
      isDefaulter: subscription.maturityDate < new Date() && subscription.status !== 'APPROVED',
    }));

    return {
      ...product,
      annualRate: Number(product.annualRate),
      minimumAmount: Number(product.minimumAmount),
      maximumAmount: product.maximumAmount ? Number(product.maximumAmount) : null,
      subscriptions,
      cancellationRequests: product.subscriptions.flatMap((subscription) =>
        (subscription as any).cancellationRequests.map((request: any) => ({
          ...request,
          investment: {
            id: subscription.id,
            principal: Number(subscription.principal),
            maturityDate: subscription.maturityDate,
            product: { id: product.id, name: product.name },
          },
        })),
      ),
      subscribers: subscriptions.filter((subscription) => !subscription.isDefaulter),
      defaulters: subscriptions.filter((subscription) => subscription.isDefaulter),
    };
  }

  async updateProduct(id: string, actorId: string, body: Record<string, unknown>) {
    const updated = await this.prisma.investmentProduct.update({
      where: { id },
      data: body,
    });

    await this.audit.log(actorId, 'UPDATE_INVESTMENT_PRODUCT', 'InvestmentProduct', id, body);

    return {
      ...updated,
      annualRate: Number(updated.annualRate),
      minimumAmount: Number(updated.minimumAmount),
      maximumAmount: updated.maximumAmount ? Number(updated.maximumAmount) : null,
    };
  }

  async deleteProduct(id: string, actorId: string) {
    const product = await this.prisma.investmentProduct.findUnique({
      where: { id },
      include: {
        subscriptions: {
          select: { id: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Investment product not found');
    }

    if (product.subscriptions.length > 0) {
      throw new BadRequestException('This investment product has subscribers and cannot be deleted.');
    }

    await this.prisma.investmentProduct.delete({ where: { id } });
    await this.audit.log(actorId, 'DELETE_INVESTMENT_PRODUCT', 'InvestmentProduct', id, {});

    return { success: true };
  }

  async getAllInvestments(query: { page?: number; limit?: number }) {
    const { page, limit, skip } = normalizePagination(query);

    const [items, total] = await Promise.all([
      this.prisma.investmentSubscription.findMany({
        orderBy: { maturityDate: 'desc' },
        include: {
          member: { select: { fullName: true, membershipNumber: true } },
          product: true,
        },
        take: limit,
        skip,
      }),
      this.prisma.investmentSubscription.count(),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        principal: Number(item.principal),
        product: {
          ...item.product,
          annualRate: Number(item.product.annualRate),
          minimumAmount: Number(item.product.minimumAmount),
          maximumAmount: item.product.maximumAmount ? Number(item.product.maximumAmount) : null,
        },
      })),
      total,
      page,
      limit,
    };
  }

  async withdraw(id: string, actorId: string) {
    const investment = await this.prisma.investmentSubscription.findUnique({
      where: { id },
      include: { product: true, member: true },
    });

    if (!investment) {
      throw new NotFoundException('Investment not found');
    }

    const annualRate = Number(investment.product.annualRate);
    const principal = Number(investment.principal);
    const totalReturn = normalizeMoney(principal + principal * (annualRate / 100) * (investment.product.durationMonths / 12));
    const reference = `INV-WD-${id}`;
    const existingReturn = await this.prisma.transaction.findUnique({ where: { reference } });
    if (existingReturn) {
      return {
        ...investment,
        principal,
        totalReturn,
      };
    }

    if (investment.status !== 'APPROVED') {
      throw new BadRequestException('Only active approved investments can be withdrawn.');
    }

    const updated = await this.prisma.runTransaction('investments.withdraw', async (tx) => {
      const claimed = await tx.investmentSubscription.updateMany({
        where: { id, status: 'APPROVED' },
        data: { status: 'REJECTED' },
      });
      if (claimed.count < 1) {
        throw new BadRequestException('Investment has already been withdrawn.');
      }

      const debtRecoveryPlan = await this.walletService.prepareWalletFundingDebtRecovery(investment.memberId, totalReturn);
      await this.walletService.applyWalletFundingWithDebtRecovery(
        tx,
        investment.memberId,
        totalReturn,
        'INVESTMENT_RETURN',
        reference,
        {
          actorId,
          category: 'investment return',
          description: `Investment return for ${investment.product.name}`,
          editable: false,
          lockReason: 'Investment returns are generated after withdrawal.',
          metadata: { investmentId: id, trigger: 'INVESTMENT_WITHDRAWAL' },
          debtRecoveryPlan,
        },
      );

      return tx.investmentSubscription.findUniqueOrThrow({ where: { id } });
    });

    await this.audit.log(actorId, 'WITHDRAW_INVESTMENT', 'InvestmentSubscription', id, { totalReturn });

    return {
      ...updated,
      principal: Number(updated.principal),
      totalReturn,
    };
  }

  async subscribe(userId: string, dto: SubscribeInvestmentDto) {
    const principal = normalizeMoney(dto.principal);
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const product = await this.prisma.investmentProduct.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== 'ACTIVE') throw new BadRequestException('Product is not active');
    if (principal < Number(product.minimumAmount)) {
      throw new BadRequestException(
        `Minimum investment amount is ₦${formatMoney(product.minimumAmount)}`,
      );
    }

    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + product.durationMonths);

    const subscription = await this.prisma.runTransaction('investments.subscribe', async (tx) => {
      const created = await tx.investmentSubscription.create({
        data: {
          memberId: member.id,
          productId: product.id,
          principal,
          maturityDate,
          status: 'APPROVED',
        },
        include: { product: true },
      });

      const reference = `INV-${created.id}`;
      await this.walletService.debitWalletInTransaction(tx, member.id, principal, 'INVESTMENT', reference, {
        category: 'investment deposit',
        description: `Investment deposit for ${product.name}`,
        editable: false,
        lockReason: 'Investment deposits are generated from subscriptions and cannot be edited.',
        metadata: { investmentId: created.id, productId: product.id, trigger: 'INVESTMENT_SUBSCRIPTION' },
      });

      return created;
    });

    await this.audit.log(userId, 'SUBSCRIBE_INVESTMENT', 'InvestmentSubscription', subscription.id, {
      productId: product.id,
      principal,
    });

    await this.notifications.notifyMember(
      userId,
      'Investment Confirmed',
      `Your investment of ₦${formatMoney(principal)} in ${product.name} is confirmed. Matures on ${maturityDate.toDateString()}.`,
    );

    return {
      ...subscription,
      principal: Number(subscription.principal),
    };
  }

  async getMyInvestments(userId: string, query: QueryInvestmentsDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const { status } = query;
    const { page, limit, skip } = normalizePagination(query);

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
        maturityAmount:
          i.status === 'APPROVED'
            ? Number(i.principal) +
              Number(i.principal) * (Number(i.product?.annualRate ?? 0) / 100) * ((i.product?.durationMonths ?? 0) / 12)
            : Number(i.principal),
        product: i.product
          ? { ...i.product, annualRate: Number(i.product.annualRate), minimumAmount: Number(i.product.minimumAmount) }
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  async getMyInvestment(userId: string, id: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const investment = await this.prisma.investmentSubscription.findUnique({
      where: { id },
      include: {
        product: true,
        cancellationRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
      } as any,
    });

    if (!investment || investment.memberId !== member.id) {
      throw new NotFoundException('Investment not found');
    }

    return this.serializeInvestment(investment);
  }

  async requestCancellation(userId: string, investmentId: string, reason?: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const investment = await this.prisma.investmentSubscription.findUnique({
      where: { id: investmentId },
      include: { product: true },
    });
    if (!investment || investment.memberId !== member.id) {
      throw new NotFoundException('Investment not found');
    }
    if (investment.status !== 'APPROVED') {
      throw new BadRequestException('Only active approved investments can be cancelled.');
    }

    const existing = await (this.prisma as any).investmentCancellationRequest.findFirst({
      where: { investmentId, status: 'PENDING' },
    });
    if (existing) {
      throw new BadRequestException('A cancellation request is already pending for this investment.');
    }

    const created = await (this.prisma as any).investmentCancellationRequest.create({
      data: {
        memberId: member.id,
        investmentId,
        reason: reason || null,
      },
    });

    await this.audit.log(userId, 'REQUEST_INVESTMENT_CANCELLATION', 'InvestmentCancellationRequest', created.id, {
      investmentId,
      reason,
    });

    return created;
  }

  async listCancellationRequests() {
    const items = await (this.prisma as any).investmentCancellationRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true } },
        investment: { include: { product: true } },
      },
    });

    return {
      items: items.map((item: any) => ({
        ...item,
        investment: this.serializeInvestment(item.investment),
      })),
    };
  }

  async approveCancellation(id: string, actorId: string) {
    const request = await (this.prisma as any).investmentCancellationRequest.findUnique({
      where: { id },
      include: { investment: true },
    });
    if (!request) throw new NotFoundException('Cancellation request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Cancellation request is not pending.');
    if (request.investment.status !== 'APPROVED') {
      throw new BadRequestException('Only active approved investments can be refunded.');
    }

    const reference = `INV-CANCEL-${id}`;
    await this.prisma.runTransaction('investments.approveCancellation', async (tx) => {
      const claimed = await (tx as any).investmentCancellationRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVING' },
      });
      if (claimed.count < 1) {
        throw new BadRequestException('Cancellation request is not pending.');
      }

      const investmentClaim = await tx.investmentSubscription.updateMany({
        where: { id: request.investmentId, status: 'APPROVED' },
        data: { status: 'REJECTED' },
      });
      if (investmentClaim.count < 1) {
        throw new BadRequestException('Only active approved investments can be refunded.');
      }

      const principal = normalizeMoney(request.investment.principal);
      const debtRecoveryPlan = await this.walletService.prepareWalletFundingDebtRecovery(request.memberId, principal);
      await this.walletService.applyWalletFundingWithDebtRecovery(
        tx,
        request.memberId,
        principal,
        'INVESTMENT_CANCELLATION_REFUND' as any,
        reference,
        {
          actorId,
          category: 'investment cancellation',
          description: `Investment cancellation refund for ${request.investmentId}`,
          editable: false,
          lockReason: 'Investment cancellation refunds are generated after admin approval.',
          metadata: { investmentId: request.investmentId, cancellationRequestId: id, trigger: 'INVESTMENT_CANCELLATION' },
          debtRecoveryPlan,
        },
      );

      await (tx as any).investmentCancellationRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
    });

    await this.audit.log(actorId, 'APPROVE_INVESTMENT_CANCELLATION', 'InvestmentCancellationRequest', id, {
      investmentId: request.investmentId,
      amount: Number(request.investment.principal),
      reference,
    });

    return { success: true, reference };
  }

  async rejectCancellation(id: string, actorId: string, reason?: string) {
    const request = await (this.prisma as any).investmentCancellationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Cancellation request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Cancellation request is not pending.');

    const updated = await (this.prisma as any).investmentCancellationRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason || null,
      },
    });

    await this.audit.log(actorId, 'REJECT_INVESTMENT_CANCELLATION', 'InvestmentCancellationRequest', id, { reason });

    return updated;
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

  private serializeInvestment(investment: any) {
    const principal = Number(investment.principal);
    const annualRate = Number(investment.product?.annualRate ?? 0);
    const durationMonths = Number(investment.product?.durationMonths ?? 0);
    const isActive = investment.status === 'APPROVED';
    const interest = isActive ? principal * (annualRate / 100) * (durationMonths / 12) : 0;

    return {
      ...investment,
      principal,
      interest,
      maturityAmount: principal + interest,
      product: investment.product
        ? {
            ...investment.product,
            annualRate: Number(investment.product.annualRate),
            minimumAmount: Number(investment.product.minimumAmount),
            maximumAmount: investment.product.maximumAmount ? Number(investment.product.maximumAmount) : null,
          }
        : null,
    };
  }
}
