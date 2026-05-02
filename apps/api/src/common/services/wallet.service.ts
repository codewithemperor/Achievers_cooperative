import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { TransactionType } from '../prisma-types';

interface TransactionOptions {
  category?: string;
  description?: string;
  editable?: boolean;
  lockReason?: string;
  metadata?: Record<string, unknown>;
}

interface DebitWalletOptions extends TransactionOptions {
  allowNegative?: boolean;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getMemberWallet(memberId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { memberId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { memberId },
      });
    }

    return wallet;
  }

  async getBalance(memberId: string) {
    const wallet = await this.getMemberWallet(memberId);
    return {
      availableBalance: Number(wallet.availableBalance),
      pendingBalance: Number(wallet.pendingBalance),
      currency: wallet.currency,
    };
  }

  async creditWallet(
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
    options?: TransactionOptions,
  ) {
    const wallet = await this.getMemberWallet(memberId);

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: amount },
          totalFunded: { increment: amount },
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          status: 'APPROVED',
          reference,
          category: options?.category,
          description: options?.description,
          editable: options?.editable ?? false,
          lockReason: options?.lockReason,
          metadata: options?.metadata as any,
        },
      }),
    ]);

    const settled = await this.settlePendingWeeklyDeductions(wallet.id);

    return {
      wallet: settled.wallet,
      transaction,
      settledTransactions: settled.transactions,
    };
  }

  async debitWallet(
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
    options?: DebitWalletOptions,
  ) {
    const wallet = await this.getMemberWallet(memberId);
    const previousBalance = Number(wallet.availableBalance);
    const nextBalance = previousBalance - amount;

    if (!options?.allowNegative && previousBalance < amount) {
      throw new Error('Insufficient balance');
    }

    const outstandingAmount = nextBalance < 0 ? Math.abs(nextBalance) : 0;
    const status = outstandingAmount > 0 ? 'PENDING' : 'APPROVED';
    const metadata = {
      ...(options?.metadata ?? {}),
      outstandingAmount,
    };

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amount },
          pendingBalance: nextBalance < 0 ? Math.abs(nextBalance) : 0,
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          status,
          reference,
          category: options?.category,
          description: options?.description,
          editable: options?.editable ?? false,
          lockReason: options?.lockReason,
          metadata: metadata as any,
        },
      }),
    ]);

    return { wallet: updatedWallet, transaction };
  }

  async settlePendingWeeklyDeductions(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      return { wallet: null, transactions: [] };
    }

    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        walletId,
        type: 'WEEKLY_COOPERATIVE',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!pendingTransactions.length) {
      const syncedWallet = await this.prisma.wallet.update({
        where: { id: walletId },
        data: { pendingBalance: Number(wallet.availableBalance) < 0 ? Math.abs(Number(wallet.availableBalance)) : 0 },
      });

      return { wallet: syncedWallet, transactions: [] };
    }

    const outstandingAfterFunding = Number(wallet.availableBalance) < 0 ? Math.abs(Number(wallet.availableBalance)) : 0;
    let coveredAmount =
      pendingTransactions.reduce((sum, transaction) => {
        const raw = (transaction.metadata as Record<string, unknown> | null)?.outstandingAmount;
        return sum + (typeof raw === 'number' ? raw : 0);
      }, 0) - outstandingAfterFunding;

    if (coveredAmount <= 0) {
      const syncedWallet = await this.prisma.wallet.update({
        where: { id: walletId },
        data: { pendingBalance: outstandingAfterFunding },
      });

      return { wallet: syncedWallet, transactions: [] };
    }

    const settledTransactions = [];
    for (const transaction of pendingTransactions) {
      if (coveredAmount <= 0) {
        break;
      }

      const currentOutstanding = Number(
        ((transaction.metadata as Record<string, unknown> | null)?.outstandingAmount as number | undefined) ?? 0,
      );

      if (currentOutstanding <= 0) {
        continue;
      }

      const nextOutstanding = Math.max(currentOutstanding - coveredAmount, 0);
      const newlyCovered = currentOutstanding - nextOutstanding;
      coveredAmount -= newlyCovered;

      const updated = await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: nextOutstanding === 0 ? 'APPROVED' : 'PENDING',
          metadata: {
            ...((transaction.metadata as Record<string, unknown> | null) ?? {}),
            outstandingAmount: nextOutstanding,
          } as any,
        },
      });

      settledTransactions.push(updated);
    }

    const syncedWallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        pendingBalance: outstandingAfterFunding,
      },
    });

    return { wallet: syncedWallet, transactions: settledTransactions };
  }

  async settleOutstandingObligations(memberId: string) {
    const wallet = await this.getMemberWallet(memberId);
    let availableBalance = Number(wallet.availableBalance);
    const settlements: Array<{ type: string; amount: number; targetId: string }> = [];

    if (availableBalance <= 0) {
      return settlements;
    }

    const activeLoans = await this.prisma.loanApplication.findMany({
      where: {
        memberId,
        status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE'] },
        remainingBalance: { gt: 0 },
      },
      orderBy: { submittedAt: 'asc' },
    });

    for (const loan of activeLoans) {
      if (availableBalance <= 0) break;

      const remainingBalance = Number(loan.remainingBalance);
      const amountDueNow = Math.min(this.getLoanDueAmount(loan), remainingBalance);
      const amountToDebit = Math.min(availableBalance, amountDueNow);
      if (amountToDebit <= 0) continue;

      await this.debitWallet(memberId, amountToDebit, 'LOAN_REPAYMENT', `AUTO-LOAN-${loan.id}-${Date.now()}`, {
        category: 'automatic loan repayment',
        description: `Automatic settlement for loan ${loan.id}`,
        editable: false,
        lockReason: 'Auto-settled from wallet funding.',
        metadata: { loanId: loan.id, autoSettled: true },
      });

      const nextRemaining = remainingBalance - amountToDebit;
      await this.prisma.loanApplication.update({
        where: { id: loan.id },
        data: {
          remainingBalance: nextRemaining,
          status: nextRemaining <= 0 ? 'COMPLETED' : 'IN_PROGRESS',
        },
      });

      settlements.push({ type: 'LOAN_REPAYMENT', amount: amountToDebit, targetId: loan.id });
      availableBalance -= amountToDebit;
    }

    if (availableBalance <= 0) {
      return settlements;
    }

    const subscriptions = await this.prisma.packageSubscription.findMany({
      where: {
        memberId,
        OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
      },
      include: {
        package: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const subscription of subscriptions) {
      if (availableBalance <= 0) break;

      let penaltyAccrued = Number(subscription.penaltyAccrued);
      let amountRemaining = Number(subscription.amountRemaining);
      const amountDueNow = Math.min(this.getPackageDueAmount(subscription), amountRemaining);

      if (penaltyAccrued > 0 && availableBalance > 0) {
        const penaltyPayment = Math.min(availableBalance, penaltyAccrued);
        await this.debitWallet(memberId, penaltyPayment, 'PACKAGE_PENALTY', `AUTO-PENALTY-${subscription.id}-${Date.now()}`, {
          category: 'automatic package penalty settlement',
          description: `Automatic penalty settlement for package subscription ${subscription.id}`,
          editable: false,
          lockReason: 'Auto-settled from wallet funding.',
          metadata: { subscriptionId: subscription.id, autoSettled: true },
        });

        penaltyAccrued -= penaltyPayment;
        availableBalance -= penaltyPayment;
        settlements.push({ type: 'PACKAGE_PENALTY', amount: penaltyPayment, targetId: subscription.id });
      }

      if (amountDueNow > 0 && availableBalance > 0) {
        const packagePayment = Math.min(availableBalance, amountDueNow);
        await this.debitWallet(memberId, packagePayment, 'PACKAGE_SUBSCRIPTION', `AUTO-PACKAGE-${subscription.id}-${Date.now()}`, {
          category: 'automatic package repayment',
          description: `Automatic package settlement for subscription ${subscription.id}`,
          editable: false,
          lockReason: 'Auto-settled from wallet funding.',
          metadata: { subscriptionId: subscription.id, autoSettled: true },
        });

        amountRemaining -= packagePayment;
        availableBalance -= packagePayment;
        settlements.push({ type: 'PACKAGE_SUBSCRIPTION', amount: packagePayment, targetId: subscription.id });
      }

      await this.prisma.packageSubscription.update({
        where: { id: subscription.id },
        data: {
          penaltyAccrued,
          amountRemaining,
          status: amountRemaining <= 0 && penaltyAccrued <= 0 ? 'COMPLETED' : 'ACTIVE',
          nextDueAt:
            amountRemaining <= 0 && penaltyAccrued <= 0
              ? null
              : this.getNextPackageDueDate(subscription),
        },
      });
    }

    return settlements;
  }

  private getLoanDueAmount(loan: {
    amount: any;
    remainingBalance: any;
    tenorMonths: number;
    disbursedAt?: Date | null;
    submittedAt: Date;
  }) {
    if (!loan.disbursedAt || loan.tenorMonths <= 0) {
      return 0;
    }

    const totalAmount = Number(loan.amount);
    const amountPaidSoFar = Math.max(totalAmount - Number(loan.remainingBalance), 0);
    const installmentAmount = totalAmount / loan.tenorMonths;
    const dueInstallments = Math.min(loan.tenorMonths, this.fullMonthsBetween(loan.disbursedAt, new Date()));
    const dueAmount = installmentAmount * dueInstallments;

    return Math.max(dueAmount - amountPaidSoFar, 0);
  }

  private getPackageDueAmount(subscription: {
    amountPaid: any;
    amountRemaining: any;
    nextDueAt?: Date | null;
    createdAt: Date;
    package: { totalAmount: any; durationMonths: number };
  }) {
    if (!subscription.nextDueAt || subscription.nextDueAt.getTime() > Date.now() || subscription.package.durationMonths <= 0) {
      return 0;
    }

    const totalAmount = Number(subscription.package.totalAmount);
    const installmentAmount = totalAmount / subscription.package.durationMonths;
    const dueInstallments = Math.min(
      subscription.package.durationMonths,
      this.fullMonthsBetween(subscription.createdAt, new Date()),
    );
    const dueAmount = installmentAmount * dueInstallments;

    return Math.max(dueAmount - Number(subscription.amountPaid), 0);
  }

  private getNextPackageDueDate(subscription: {
    amountPaid: any;
    package: { totalAmount: any; durationMonths: number };
    createdAt: Date;
  }) {
    const totalAmount = Number(subscription.package.totalAmount);
    const durationMonths = subscription.package.durationMonths;
    if (durationMonths <= 0 || Number(subscription.amountPaid) >= totalAmount) {
      return null;
    }

    const installmentAmount = totalAmount / durationMonths;
    const paidInstallments = Math.floor(Number(subscription.amountPaid) / installmentAmount);
    const nextDueAt = new Date(subscription.createdAt);
    nextDueAt.setMonth(nextDueAt.getMonth() + paidInstallments + 1);
    return nextDueAt;
  }

  private fullMonthsBetween(start: Date, end: Date) {
    if (end <= start) {
      return 0;
    }

    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) {
      months -= 1;
    }
    return Math.max(months, 0);
  }
}
