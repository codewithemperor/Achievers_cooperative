import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { AuditService } from '../../common/services/audit.service';
import { FundWalletDto } from './dto/index';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly audit: AuditService,
  ) {}

  async getMyWallet(userId: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    return this.walletService.getBalance(member.id);
  }

  async getMemberWalletByMemberId(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { wallet: true },
    });

    if (!member || !member.wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { walletId: member.wallet.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      balance: Number(member.wallet.availableBalance),
      pendingBalance: Number(member.wallet.pendingBalance),
      totalFunded: Number(member.wallet.totalFunded),
      totalCharges: Number(member.wallet.totalCharges),
      transactions: transactions.map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      })),
    };
  }

  async fund(userId: string, dto: FundWalletDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const reference = `FUND-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const result = await this.walletService.creditWallet(
      member.id,
      dto.amount,
      'WALLET_FUNDING',
      reference,
      {
        category: 'wallet funding',
        description: 'Wallet funded by member',
        editable: false,
        lockReason: 'Wallet funding transactions are generated from funding activity and cannot be edited.',
      },
    );

    await this.audit.log(userId, 'FUND_WALLET', 'Wallet', result.wallet!.id, {
      amount: dto.amount,
      reference,
    });

    return {
      wallet: {
        availableBalance: Number(result.wallet!.availableBalance),
        currency: result.wallet!.currency,
      },
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: Number(result.transaction.amount),
        status: result.transaction.status,
        reference: result.transaction.reference,
      },
    };
  }

  async getTransactions(userId: string, options?: { limit?: number; offset?: number }) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: { wallet: true },
    });
    if (!member || !member.wallet) throw new NotFoundException('Wallet not found');

    const { limit = 50, offset = 0 } = options ?? {};

    const [items, payments, total, totalPayments] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId: member.wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.payment.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.transaction.count({ where: { walletId: member.wallet.id } }),
      this.prisma.payment.count({ where: { memberId: member.id } }),
    ]);

    const mergedItems = [
      ...items.map((transaction) => ({
        id: transaction.id,
        source: 'TRANSACTION',
        type: transaction.type,
        amount: Number(transaction.amount),
        status: transaction.status,
        reference: transaction.reference,
        description: transaction.description,
        createdAt: transaction.createdAt,
      })),
      ...payments.map((payment) => ({
        id: `payment-${payment.id}`,
        source: 'PAYMENT_REQUEST',
        type: 'WALLET_FUNDING_REQUEST',
        amount: Number(payment.amount),
        status: payment.status,
        reference: null,
        description:
          payment.status === 'PENDING'
            ? 'Wallet funding request is processing'
            : payment.status === 'APPROVED'
              ? 'Wallet funding request approved'
              : payment.rejectionReason || 'Wallet funding request rejected',
        createdAt: payment.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return {
      items: mergedItems,
      total: total + totalPayments,
      limit,
      offset,
    };
  }
}
