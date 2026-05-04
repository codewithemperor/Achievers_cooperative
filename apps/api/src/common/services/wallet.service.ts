import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { LoanTenorUnit, TransactionType } from '../prisma-types';

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

type SettlementRecord = {
  type: string;
  amount: number;
  targetId: string;
};

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

    const [, transaction] = await this.prisma.$transaction([
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

    const settlements = await this.settleOutstandingObligations(memberId);
    const syncedWallet = await this.getMemberWallet(memberId);

    return {
      wallet: syncedWallet,
      transaction,
      settlements,
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
      throw new BadRequestException('Insufficient balance');
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
          pendingBalance: nextBalance < 0 ? Math.abs(nextBalance) : Number(wallet.pendingBalance),
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
    const settlements: SettlementRecord[] = [];
    const wallet = await this.getMemberWallet(memberId);

    await this.settlePendingWeeklyDeductions(wallet.id);

    let refreshedWallet = await this.getMemberWallet(memberId);
    let availableBalance = Number(refreshedWallet.availableBalance);

    if (availableBalance <= 0) {
      return settlements;
    }

    const subscriptions = await this.prisma.packageSubscription.findMany({
      where: {
        memberId,
        status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] },
        OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
      },
      include: {
        package: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const subscription of subscriptions) {
      if (availableBalance <= 0) break;

      const amountDueNow = this.getPackageDueAmount(subscription);
      const amountToSpend = Math.min(
        availableBalance,
        Math.min(Number(subscription.penaltyAccrued) + amountDueNow, Number(subscription.penaltyAccrued) + Number(subscription.amountRemaining)),
      );

      if (amountToSpend <= 0) {
        continue;
      }

      const applied = await this.applyPackagePayment(memberId, subscription.id, amountToSpend, 'AUTO');
      settlements.push(...applied.settlements);
      refreshedWallet = applied.wallet;
      availableBalance = Number(refreshedWallet.availableBalance);
    }

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
      const amountDueNow = Math.min(this.getLoanDueAmount(loan as any), remainingBalance);
      const amountToDebit = Math.min(availableBalance, amountDueNow);

      if (amountToDebit <= 0) {
        continue;
      }

      const applied = await this.applyLoanRepayment(memberId, loan.id, amountToDebit, 'AUTO');
      settlements.push(applied.settlement);
      refreshedWallet = applied.wallet;
      availableBalance = Number(refreshedWallet.availableBalance);
    }

    if (availableBalance <= 0) {
      return settlements;
    }

    const pendingSavingsTransactions = await this.prisma.transaction.findMany({
      where: {
        walletId: refreshedWallet.id,
        type: 'SAVINGS',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const item of pendingSavingsTransactions) {
      if (availableBalance <= 0) break;

      const rawOutstanding = (item.metadata as Record<string, unknown> | null)?.outstandingAmount;
      const outstanding = typeof rawOutstanding === 'number' ? rawOutstanding : Number(item.amount);
      const amountToApply = Math.min(availableBalance, outstanding);
      const savingsAccountId = (item.metadata as Record<string, unknown> | null)?.savingsAccountId;

      if (amountToApply <= 0 || typeof savingsAccountId !== 'string') {
        continue;
      }

      await this.prisma.$transaction([
        this.prisma.transaction.update({
          where: { id: item.id },
          data: {
            status: amountToApply >= outstanding ? 'APPROVED' : 'PENDING',
            metadata: {
              ...((item.metadata as Record<string, unknown> | null) ?? {}),
              outstandingAmount: Math.max(outstanding - amountToApply, 0),
            } as any,
          },
        }),
        this.prisma.savingsAccount.update({
          where: { id: savingsAccountId },
          data: {
            balance: { increment: amountToApply },
          },
        }),
      ]);

      settlements.push({
        type: 'SAVINGS',
        amount: amountToApply,
        targetId: savingsAccountId,
      });

      availableBalance -= amountToApply;
    }

    return settlements;
  }

  async applyLoanRepayment(
    memberId: string,
    loanId: string,
    amount: number,
    mode: 'AUTO' | 'ADMIN' | 'MEMBER' = 'MEMBER',
  ) {
    const loan = await this.prisma.loanApplication.findUnique({ where: { id: loanId } });
    if (!loan || loan.memberId !== memberId) {
      throw new NotFoundException('Loan not found');
    }

    if (!['DISBURSED', 'IN_PROGRESS', 'OVERDUE'].includes(loan.status)) {
      throw new BadRequestException('This loan is not currently active for repayment.');
    }

    const referencePrefix = mode === 'AUTO' ? 'AUTO-LOAN' : mode === 'ADMIN' ? 'ADMIN-LOAN' : 'REPAY';
    const reference = `${referencePrefix}-${loan.id}-${Date.now()}`;

    await this.debitWallet(memberId, amount, 'LOAN_REPAYMENT', reference, {
      category: mode === 'AUTO' ? 'automatic loan repayment' : 'loan repayment',
      description:
        mode === 'AUTO'
          ? `Automatic settlement for loan ${loan.id}`
          : mode === 'ADMIN'
            ? `Admin wallet allocation for loan ${loan.id}`
            : `Loan repayment for loan ${loan.id}`,
      editable: false,
      lockReason: 'Loan repayment transactions are system-generated and cannot be edited.',
      metadata: { loanId: loan.id, autoSettled: mode === 'AUTO', adminAllocated: mode === 'ADMIN' },
    });

    const nextRemaining = Math.max(Number(loan.remainingBalance) - amount, 0);
    await this.prisma.loanApplication.update({
      where: { id: loan.id },
      data: {
        remainingBalance: nextRemaining,
        status: nextRemaining <= 0 ? 'COMPLETED' : 'IN_PROGRESS',
      },
    });

    const wallet = await this.getMemberWallet(memberId);
    return {
      wallet,
      reference,
      settlement: {
        type: 'LOAN_REPAYMENT',
        amount,
        targetId: loan.id,
      },
    };
  }

  async applyPackagePayment(
    memberId: string,
    subscriptionId: string,
    amount: number,
    mode: 'AUTO' | 'ADMIN' | 'MEMBER' = 'MEMBER',
  ) {
    const subscription = await this.prisma.packageSubscription.findUnique({
      where: { id: subscriptionId },
      include: { package: true },
    });

    if (!subscription || subscription.memberId !== memberId) {
      throw new NotFoundException('Package subscription not found');
    }

    if (!['APPROVED', 'DISBURSED', 'IN_PROGRESS'].includes(subscription.status)) {
      throw new BadRequestException('This package subscription is not active for payment.');
    }

    let remainingToSpend = amount;
    let penaltyAccrued = Number(subscription.penaltyAccrued);
    let amountRemaining = Number(subscription.amountRemaining);
    let amountPaid = Number(subscription.amountPaid);
    const settlements: SettlementRecord[] = [];

    if (penaltyAccrued > 0 && remainingToSpend > 0) {
      const penaltyPayment = Math.min(remainingToSpend, penaltyAccrued);
      await this.debitWallet(memberId, penaltyPayment, 'PACKAGE_PENALTY', `PACKAGE-PENALTY-${subscription.id}-${Date.now()}`, {
        category: mode === 'AUTO' ? 'automatic package penalty settlement' : 'package penalty settlement',
        description:
          mode === 'AUTO'
            ? `Automatic penalty settlement for package subscription ${subscription.id}`
            : `Wallet allocation for package penalty ${subscription.id}`,
        editable: false,
        lockReason: 'Package penalty transactions are system-generated and cannot be edited.',
        metadata: { subscriptionId: subscription.id, autoSettled: mode === 'AUTO', adminAllocated: mode === 'ADMIN' },
      });

      penaltyAccrued -= penaltyPayment;
      remainingToSpend -= penaltyPayment;
      settlements.push({ type: 'PACKAGE_PENALTY', amount: penaltyPayment, targetId: subscription.id });
    }

    if (amountRemaining > 0 && remainingToSpend > 0) {
      const principalPayment = Math.min(remainingToSpend, amountRemaining);
      await this.debitWallet(memberId, principalPayment, 'PACKAGE_SUBSCRIPTION', `PACKAGE-${subscription.id}-${Date.now()}`, {
        category: mode === 'AUTO' ? 'automatic package repayment' : 'package repayment',
        description:
          mode === 'AUTO'
            ? `Automatic package settlement for subscription ${subscription.id}`
            : `Wallet allocation for package subscription ${subscription.id}`,
        editable: false,
        lockReason: 'Package subscription transactions are system-generated and cannot be edited.',
        metadata: { subscriptionId: subscription.id, autoSettled: mode === 'AUTO', adminAllocated: mode === 'ADMIN' },
      });

      amountRemaining -= principalPayment;
      amountPaid += principalPayment;
      remainingToSpend -= principalPayment;
      settlements.push({ type: 'PACKAGE_SUBSCRIPTION', amount: principalPayment, targetId: subscription.id });
    }

    const nextStatus = amountRemaining <= 0 && penaltyAccrued <= 0 ? 'COMPLETED' : 'IN_PROGRESS';
    await this.prisma.packageSubscription.update({
      where: { id: subscription.id },
      data: {
        penaltyAccrued,
        amountRemaining,
        amountPaid,
        status: nextStatus,
        completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
        nextDueAt: nextStatus === 'COMPLETED' ? null : this.getNextPackageDueDate({
          amountPaid,
          approvedAt: (subscription as any).approvedAt,
          disbursedAt: (subscription as any).disbursedAt,
          package: subscription.package,
          createdAt: subscription.createdAt,
        }),
      } as any,
    });

    const wallet = await this.getMemberWallet(memberId);
    return { wallet, settlements };
  }

  async applySavingsContribution(
    memberId: string,
    amount: number,
    mode: 'AUTO' | 'ADMIN' | 'MEMBER' = 'MEMBER',
    accountId?: string,
  ) {
    let account =
      (accountId
        ? await this.prisma.savingsAccount.findUnique({ where: { id: accountId } })
        : await this.prisma.savingsAccount.findFirst({ where: { memberId } })) ?? null;

    if (account && account.memberId !== memberId) {
      throw new BadRequestException('Invalid savings account selected.');
    }

    if (!account) {
      account = await this.prisma.savingsAccount.create({
        data: {
          memberId,
          contributionFrequency: 'MONTHLY',
        },
      });
    }

    const referencePrefix = mode === 'AUTO' ? 'AUTO-SAVE' : mode === 'ADMIN' ? 'ADMIN-SAVE' : 'SAVE';
    const reference = `${referencePrefix}-${account.id}-${Date.now()}`;

    await this.debitWallet(memberId, amount, 'SAVINGS', reference, {
      category: mode === 'AUTO' ? 'automatic savings contribution' : 'savings contribution',
      description:
        mode === 'AUTO'
          ? `Automatic savings contribution for account ${account.id}`
          : mode === 'ADMIN'
            ? `Admin wallet allocation to savings account ${account.id}`
            : 'Savings contribution',
      editable: false,
      lockReason: 'Savings contribution transactions are system-generated and cannot be edited.',
      metadata: { savingsAccountId: account.id, autoSettled: mode === 'AUTO', adminAllocated: mode === 'ADMIN' },
    });

    const updated = await this.prisma.savingsAccount.update({
      where: { id: account.id },
      data: {
        balance: { increment: amount },
      },
    });

    const wallet = await this.getMemberWallet(memberId);
    return {
      wallet,
      reference,
      account: updated,
      settlement: {
        type: 'SAVINGS',
        amount,
        targetId: updated.id,
      },
    };
  }

  private getLoanDueAmount(loan: {
    amount: any;
    remainingBalance: any;
    tenorMonths: number;
    tenorUnit?: LoanTenorUnit;
    disbursedAt?: Date | null;
    submittedAt: Date;
  }) {
    if (!loan.disbursedAt || loan.tenorMonths <= 0) {
      return 0;
    }

    const totalAmount = Number(loan.amount);
    const amountPaidSoFar = Math.max(totalAmount - Number(loan.remainingBalance), 0);
    const installmentAmount = totalAmount / loan.tenorMonths;
    const dueInstallments = Math.min(
      loan.tenorMonths,
      (loan.tenorUnit ?? 'MONTHS') === 'WEEKS'
        ? this.fullWeeksBetween(loan.disbursedAt, new Date())
        : this.fullMonthsBetween(loan.disbursedAt, new Date()),
    );
    const dueAmount = installmentAmount * dueInstallments;

    return Math.max(dueAmount - amountPaidSoFar, 0);
  }

  private getPackageDueAmount(subscription: {
    amountPaid: any;
    amountRemaining: any;
    nextDueAt?: Date | null;
    approvedAt?: Date | null;
    disbursedAt?: Date | null;
    createdAt: Date;
    package: { totalAmount: any; durationMonths: number; startDate?: Date | null; endDate?: Date | null; repaymentFrequency?: string | null };
  }) {
    if (!subscription.nextDueAt || subscription.nextDueAt.getTime() > Date.now()) {
      return 0;
    }

    const totalAmount = Number(subscription.package.totalAmount);
    const anchorDate = this.getPackageScheduleAnchor(subscription);
    const totalInstallments = this.getPackageInstallmentCount(subscription.package, anchorDate ?? subscription.createdAt);
    const installmentAmount = totalInstallments > 0 ? totalAmount / totalInstallments : totalAmount;
    const dueInstallments = Math.min(
      totalInstallments,
      (subscription.package.repaymentFrequency ?? 'WEEKLY') === 'WEEKLY'
        ? this.fullWeeksBetween(anchorDate ?? subscription.createdAt, new Date())
        : this.fullMonthsBetween(anchorDate ?? subscription.createdAt, new Date()),
    );
    const dueAmount = installmentAmount * dueInstallments;

    return Math.max(Math.min(dueAmount - Number(subscription.amountPaid), Number(subscription.amountRemaining)), 0);
  }

  private getNextPackageDueDate(subscription: {
    amountPaid: number;
    approvedAt?: Date | null;
    disbursedAt?: Date | null;
    package: { totalAmount: any; durationMonths: number; startDate?: Date | null; endDate?: Date | null; repaymentFrequency?: string | null };
    createdAt: Date;
  }) {
    const totalAmount = Number(subscription.package.totalAmount);
    const anchorDate = this.getPackageScheduleAnchor(subscription);
    const totalInstallments = this.getPackageInstallmentCount(subscription.package, anchorDate ?? subscription.createdAt);
    if (totalInstallments <= 0 || subscription.amountPaid >= totalAmount) {
      return null;
    }

    const installmentAmount = totalAmount / totalInstallments;
    const paidInstallments = Math.floor(subscription.amountPaid / installmentAmount);
    const nextDueAt = new Date(anchorDate ?? subscription.createdAt);
    if ((subscription.package.repaymentFrequency ?? 'WEEKLY') === 'WEEKLY') {
      nextDueAt.setDate(nextDueAt.getDate() + (paidInstallments + 1) * 7);
    } else {
      nextDueAt.setMonth(nextDueAt.getMonth() + paidInstallments + 1);
    }
    return nextDueAt;
  }

  private getPackageInstallmentCount(
    pkg: { durationMonths: number; startDate?: Date | null; endDate?: Date | null; repaymentFrequency?: string | null },
    createdAt: Date,
  ) {
    if ((pkg.repaymentFrequency ?? 'WEEKLY') === 'WEEKLY') {
      const anchor = pkg.startDate ?? createdAt;
      const end = pkg.endDate;
      if (end && end > anchor) {
        return Math.max(Math.ceil((end.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000)), 1);
      }
      return Math.max(pkg.durationMonths * 4, 1);
    }

    return Math.max(pkg.durationMonths, 1);
  }

  private getPackageScheduleAnchor(subscription: {
    approvedAt?: Date | null;
    disbursedAt?: Date | null;
    createdAt: Date;
    package: { startDate?: Date | null };
  }) {
    const packageStartDate = subscription.package.startDate ?? null;
    const approvalAnchor = subscription.disbursedAt ?? subscription.approvedAt ?? subscription.createdAt;

    if (packageStartDate) {
      return new Date(Math.max(packageStartDate.getTime(), approvalAnchor.getTime()));
    }

    return approvalAnchor;
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

  private fullWeeksBetween(start: Date, end: Date) {
    if (end <= start) {
      return 0;
    }

    return Math.max(Math.floor((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)), 0);
  }
}
