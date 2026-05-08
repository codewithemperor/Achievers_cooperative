import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { AuditService } from '../../common/services/audit.service';
import { AdminWalletSpendDto, FundWalletDto, RequestWalletWithdrawalDto } from './dto/index';

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
      settlements: result.settlements,
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
      settlements: result.settlements,
    };
  }

  async adminSpend(actorId: string, dto: AdminWalletSpendDto) {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
      include: { wallet: true },
    });
    if (!member || !member.wallet) {
      throw new NotFoundException('Wallet not found');
    }

    let result:
      | { reference?: string; settlement?: { type: string; amount: number; targetId: string }; settlements?: Array<{ type: string; amount: number; targetId: string }> }
      | undefined;

    if (dto.targetType === 'LOAN') {
      if (!dto.targetId || !dto.amount) {
        throw new NotFoundException('Loan target and amount are required');
      }
      result = await this.walletService.applyLoanRepayment(member.id, dto.targetId, dto.amount, 'ADMIN');
    } else if (dto.targetType === 'PACKAGE') {
      if (!dto.targetId || !dto.amount) {
        throw new NotFoundException('Package target and amount are required');
      }
      result = await this.walletService.applyPackagePayment(member.id, dto.targetId, dto.amount, 'ADMIN');
    } else if (dto.targetType === 'SAVINGS') {
      if (!dto.amount) {
        throw new NotFoundException('Amount is required for savings allocation');
      }
      result = await this.walletService.applySavingsContribution(member.id, dto.amount, 'ADMIN', dto.savingsAccountId);
    } else {
      const pending = await this.walletService.settlePendingWeeklyDeductions(member.wallet.id);
      result = {
        settlements: pending.transactions.map((item) => ({
          type: item.type,
          amount: Number(item.amount),
          targetId: item.id,
        })),
      };
    }

    await this.audit.log(actorId, 'ADMIN_WALLET_SPEND', 'Wallet', member.wallet.id, dto as unknown as Record<string, unknown>);

    return {
      success: true,
      reference: result?.reference,
      settlement: result && 'settlement' in result ? result.settlement : undefined,
      settlements: result?.settlements ?? (result && 'settlement' in result && result.settlement ? [result.settlement] : []),
      wallet: await this.walletService.getBalance(member.id),
    };
  }

  async getTransactions(userId: string, options?: { limit?: number; offset?: number; type?: string; from?: string; to?: string }) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: { wallet: true },
    });
    if (!member || !member.wallet) throw new NotFoundException('Wallet not found');

    const { limit = 50, offset = 0, type, from, to } = options ?? {};
    const dateFilter =
      from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    const effectiveType = (type ?? 'WALLET_FUNDING').toUpperCase();
    const allTypes = effectiveType === 'ALL';
    const fundingOnly = effectiveType === 'WALLET_FUNDING' || effectiveType === 'WALLET_FUNDING_REQUEST';
    const includePaymentRequests = allTypes || fundingOnly;
    const includeWalletWithdrawals = allTypes || effectiveType === 'WALLET_WITHDRAWAL';
    const includeSavingsWithdrawals = allTypes || effectiveType === 'SAVINGS' || effectiveType === 'SAVINGS_WITHDRAWAL';
    const includeInvestmentCancellations =
      allTypes || effectiveType === 'INVESTMENT' || effectiveType === 'INVESTMENT_CANCELLATION_REFUND';
    const transactionTypeFilter = allTypes
      ? {
          NOT: [
            { type: 'WALLET_FUNDING' as any, reference: { startsWith: 'PAY-' } },
            { type: { in: ['WALLET_WITHDRAWAL', 'INVESTMENT_CANCELLATION_REFUND'] as any } },
          ],
        }
      : effectiveType === 'WALLET_WITHDRAWAL' || effectiveType === 'INVESTMENT_CANCELLATION_REFUND'
        ? { id: '__request_backed_activity__' }
      : fundingOnly
        ? { type: 'WALLET_FUNDING' as any, reference: { not: { startsWith: 'PAY-' } } }
        : { type: effectiveType as any };

    const [
      items,
      payments,
      walletWithdrawals,
      savingsWithdrawals,
      investmentCancellations,
      total,
      totalPayments,
      totalWalletWithdrawals,
      totalSavingsWithdrawals,
      totalInvestmentCancellations,
    ] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          walletId: member.wallet.id,
          ...transactionTypeFilter,
          ...dateFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      includePaymentRequests
        ? this.prisma.payment.findMany({
            where: { memberId: member.id, ...dateFilter },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          })
        : Promise.resolve([]),
      includeWalletWithdrawals
        ? (this.prisma as any).walletWithdrawalRequest.findMany({
            where: { memberId: member.id, ...dateFilter },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          })
        : Promise.resolve([]),
      includeSavingsWithdrawals
        ? (this.prisma as any).savingsWithdrawalRequest.findMany({
            where: { memberId: member.id, ...dateFilter },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          })
        : Promise.resolve([]),
      includeInvestmentCancellations
        ? (this.prisma as any).investmentCancellationRequest.findMany({
            where: { memberId: member.id, ...dateFilter },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: { investment: { include: { product: true } } },
          })
        : Promise.resolve([]),
      this.prisma.transaction.count({
        where: {
          walletId: member.wallet.id,
          ...transactionTypeFilter,
          ...dateFilter,
        },
      }),
      includePaymentRequests ? this.prisma.payment.count({ where: { memberId: member.id, ...dateFilter } }) : Promise.resolve(0),
      includeWalletWithdrawals
        ? (this.prisma as any).walletWithdrawalRequest.count({ where: { memberId: member.id, ...dateFilter } })
        : Promise.resolve(0),
      includeSavingsWithdrawals
        ? (this.prisma as any).savingsWithdrawalRequest.count({ where: { memberId: member.id, ...dateFilter } })
        : Promise.resolve(0),
      includeInvestmentCancellations
        ? (this.prisma as any).investmentCancellationRequest.count({ where: { memberId: member.id, ...dateFilter } })
        : Promise.resolve(0),
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
      ...walletWithdrawals.map((request: any) => ({
        id: `wallet-withdrawal-${request.id}`,
        source: 'WALLET_WITHDRAWAL_REQUEST',
        type: 'WALLET_WITHDRAWAL',
        amount: Number(request.amount),
        status: request.status,
        reference: null,
        description:
          request.status === 'DISBURSED'
            ? `Wallet withdrawal disbursed to ${request.bankName} - ${request.accountNumber}`
            : request.status === 'REJECTED'
              ? request.rejectionReason || 'Wallet withdrawal request rejected'
              : `Wallet withdrawal request to ${request.bankName} - ${request.accountNumber}`,
        createdAt: request.createdAt,
      })),
      ...savingsWithdrawals.map((request: any) => ({
        id: `savings-withdrawal-${request.id}`,
        source: 'SAVINGS_WITHDRAWAL_REQUEST',
        type: 'SAVINGS_WITHDRAWAL',
        amount: Number(request.amount),
        status: request.status,
        reference: null,
        description:
          request.status === 'REJECTED'
            ? request.rejectionReason || 'Savings withdrawal request rejected'
            : `Savings withdrawal request to ${request.bankName} - ${request.accountNumber}`,
        createdAt: request.createdAt,
      })),
      ...investmentCancellations.map((request: any) => ({
        id: `investment-cancellation-${request.id}`,
        source: 'INVESTMENT_CANCELLATION_REQUEST',
        type: 'INVESTMENT_CANCELLATION',
        amount: Number(request.investment?.principal ?? 0),
        status: request.status,
        reference: null,
        description:
          request.status === 'REJECTED'
            ? request.rejectionReason || 'Investment cancellation request rejected'
            : `Investment cancellation request${request.investment?.product?.name ? ` for ${request.investment.product.name}` : ''}`,
        createdAt: request.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return {
      items: mergedItems,
      total:
        total +
        totalPayments +
        totalWalletWithdrawals +
        totalSavingsWithdrawals +
        totalInvestmentCancellations,
      limit,
      offset,
    };
  }

  async getMyWithdrawalRequests(userId: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const items = await (this.prisma as any).walletWithdrawalRequest.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
    });

    return { items: items.map((item: any) => ({ ...item, amount: Number(item.amount) })) };
  }

  async requestWithdrawal(userId: string, dto: RequestWalletWithdrawalDto) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: { wallet: true },
    });
    if (!member || !member.wallet) throw new NotFoundException('Wallet not found');

    if (Number(member.wallet.availableBalance) < dto.amount) {
      throw new NotFoundException('Insufficient wallet balance for this withdrawal request');
    }

    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
    if (!bankAccount || bankAccount.memberId !== member.id) {
      throw new NotFoundException('Invalid bank account selected');
    }

    const created = await (this.prisma as any).walletWithdrawalRequest.create({
      data: {
        memberId: member.id,
        walletId: member.wallet.id,
        amount: dto.amount,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
      },
    });

    await this.audit.log(userId, 'REQUEST_WALLET_WITHDRAWAL', 'WalletWithdrawalRequest', created.id, {
      amount: dto.amount,
      bankAccountId: dto.bankAccountId,
    });

    return { ...created, amount: Number(created.amount) };
  }

  async listWithdrawalRequests() {
    const items = await (this.prisma as any).walletWithdrawalRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true } },
      },
    });

    return { items: items.map((item: any) => ({ ...item, amount: Number(item.amount) })) };
  }

  async approveWithdrawal(id: string, actorId: string) {
    const request = await (this.prisma as any).walletWithdrawalRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Wallet withdrawal request not found');
    if (request.status !== 'PENDING') throw new NotFoundException('Withdrawal request is not pending');

    const updated = await (this.prisma as any).walletWithdrawalRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });

    await this.audit.log(actorId, 'APPROVE_WALLET_WITHDRAWAL', 'WalletWithdrawalRequest', id, {
      amount: Number(request.amount),
    });

    return { ...updated, amount: Number(updated.amount) };
  }

  async rejectWithdrawal(id: string, actorId: string, reason?: string) {
    const request = await (this.prisma as any).walletWithdrawalRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Wallet withdrawal request not found');
    if (request.status !== 'PENDING') throw new NotFoundException('Withdrawal request is not pending');

    const updated = await (this.prisma as any).walletWithdrawalRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason || null },
    });

    await this.audit.log(actorId, 'REJECT_WALLET_WITHDRAWAL', 'WalletWithdrawalRequest', id, { reason });

    return { ...updated, amount: Number(updated.amount) };
  }

  async disburseWithdrawal(id: string, actorId: string) {
    const request = await (this.prisma as any).walletWithdrawalRequest.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!request) throw new NotFoundException('Wallet withdrawal request not found');
    if (request.status !== 'APPROVED') throw new NotFoundException('Withdrawal request must be approved first');
    if (request.disbursedAt) throw new NotFoundException('Withdrawal request has already been disbursed');
    if (Number(request.wallet.availableBalance) < Number(request.amount)) {
      throw new NotFoundException('Member wallet balance is no longer sufficient');
    }

    const reference = `WALLET-WD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: request.walletId },
        data: { availableBalance: { decrement: request.amount }, totalCharges: { increment: request.amount } },
      });
      await tx.transaction.create({
        data: {
          walletId: request.walletId,
          type: 'WALLET_WITHDRAWAL' as any,
          amount: request.amount,
          status: 'APPROVED',
          reference,
          category: 'wallet withdrawal',
          description: `Wallet withdrawal disbursed to ${request.bankName} - ${request.accountNumber}`,
          editable: false,
          lockReason: 'Wallet withdrawal disbursements are system-generated.',
          metadata: { withdrawalRequestId: id },
        },
      });
      return (tx as any).walletWithdrawalRequest.update({
        where: { id },
        data: { status: 'DISBURSED', disbursedAt: new Date() },
      });
    });

    await this.audit.log(actorId, 'DISBURSE_WALLET_WITHDRAWAL', 'WalletWithdrawalRequest', id, {
      amount: Number(request.amount),
      reference,
    });

    return { ...updated, amount: Number(updated.amount), reference };
  }
}
