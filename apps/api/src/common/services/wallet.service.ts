import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { LoanTenorUnit, TransactionType } from '../prisma-types';
import { FinancialPostingService } from './financial-posting.service';

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

const WEEKLY_DEDUCTION_AMOUNT_KEY = 'COOPERATIVE_DEDUCTION_AMOUNT';
const WEEKLY_DEDUCTION_DAY_KEY = 'COOPERATIVE_DEDUCTION_DAY';
const WEEKLY_OPEN_STATUSES = ['OUTSTANDING', 'PARTIAL', 'UPCOMING'];
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}

function startOfIsoDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function weeklyCycleStatus(dueDate: Date, amount: number, amountPaid: number, asOf = new Date()) {
  if (amountPaid >= amount) {
    return dueDate.getTime() > startOfIsoDay(asOf).getTime() ? 'PREPAID' : 'PAID';
  }
  if (amountPaid > 0) return 'PARTIAL';
  return dueDate.getTime() > startOfIsoDay(asOf).getTime() ? 'UPCOMING' : 'OUTSTANDING';
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialPosting: FinancialPostingService,
  ) {}

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

    const transaction = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: amount },
          totalFunded: { increment: amount },
        },
      });

      const transaction = await tx.transaction.create({
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
      });

      if (type === 'WALLET_FUNDING' || type === 'FUNDING') {
        await this.financialPosting.postWalletFunding(
          {
            memberId,
            amount,
            reference,
            sourceType: 'Transaction',
            sourceId: transaction.id,
            description: options?.description || 'Member wallet funding',
            category: options?.category,
          } as any,
          tx,
        );
      } else if (['INVESTMENT_CANCELLATION_REFUND', 'INVESTMENT_RETURN', 'ADMIN_REFUND'].includes(type)) {
        await this.financialPosting.postAssociationToWallet(
          {
            memberId,
            amount,
            reference,
            sourceType: 'Transaction',
            sourceId: transaction.id,
            description: options?.description || 'Association wallet credit',
            category: options?.category,
          },
          tx,
        );
      }

      return transaction;
    });

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

    const { updatedWallet, transaction } = await this.prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amount },
          pendingBalance: nextBalance < 0 ? Math.abs(nextBalance) : Number(wallet.pendingBalance),
        },
      });

      const transaction = await tx.transaction.create({
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
      });

      const postedAmount = status === 'APPROVED' ? amount : Math.max(amount - outstandingAmount, 0);
      if (postedAmount > 0 && this.financialPosting.isAssociationIncomeTransaction(type)) {
        await this.financialPosting.postWalletToAssociation(
          {
            memberId,
            amount: postedAmount,
            reference,
            sourceType: 'Transaction',
            sourceId: transaction.id,
            description: options?.description || 'Wallet payment to association',
            category: options?.category,
          },
          tx,
        );
      }

      return { updatedWallet, transaction };
    });

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

      const updated = await this.prisma.$transaction(async (tx) => {
        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: nextOutstanding === 0 ? 'APPROVED' : 'PENDING',
            metadata: {
              ...((transaction.metadata as Record<string, unknown> | null) ?? {}),
              outstandingAmount: nextOutstanding,
            } as any,
          },
        });

        await this.financialPosting.postWalletToAssociation(
          {
            memberId: wallet.memberId,
            amount: newlyCovered,
            reference: `${transaction.reference ?? transaction.id}-SETTLED-${Date.now()}`,
            sourceType: 'Transaction',
            sourceId: transaction.id,
            description: transaction.description || 'Settled pending wallet deduction',
            category: transaction.category,
          },
          tx,
        );

        await this.allocateWeeklySettlement(tx, wallet.memberId, transaction.id, newlyCovered);

        return updatedTransaction;
      });

      settledTransactions.push({ ...updated, settledAmount: newlyCovered });
    }

    const syncedWallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        pendingBalance: outstandingAfterFunding,
      },
    });

    return { wallet: syncedWallet, transactions: settledTransactions };
  }

  private async allocateWeeklySettlement(client: any, memberId: string, transactionId: string, amount: number) {
    if (amount <= 0) return;

    const payment = await client.weeklyDeductionPayment.create({
      data: {
        memberId,
        transactionId,
        amount,
        mode: 'SETTLEMENT',
        metadata: {
          transactionId,
          settledFromPendingWeeklyDeduction: true,
        },
      },
    });

    let remaining = amount;
    while (remaining > 0.0001) {
      const cycle = await client.weeklyDeductionCycle.findFirst({
        where: {
          memberId,
          status: { in: ['OUTSTANDING', 'PARTIAL', 'UPCOMING'] },
        },
        orderBy: { dueDate: 'asc' },
      });
      if (!cycle) break;

      const cycleAmount = Number(cycle.amount);
      const currentPaid = Number(cycle.amountPaid);
      const openAmount = Math.max(cycleAmount - currentPaid, 0);
      const allocationAmount = Math.min(openAmount, remaining);
      const nextPaid = currentPaid + allocationAmount;

      await client.weeklyDeductionAllocation.create({
        data: {
          paymentId: payment.id,
          cycleId: cycle.id,
          amount: allocationAmount,
        },
      });
      await client.weeklyDeductionCycle.update({
        where: { id: cycle.id },
        data: {
          amountPaid: nextPaid,
          status: weeklyCycleStatus(cycle.dueDate, cycleAmount, nextPaid),
        },
      });

      remaining -= allocationAmount;
    }
  }

  async settleOutstandingObligations(memberId: string) {
    const settlements: SettlementRecord[] = [];
    const wallet = await this.getMemberWallet(memberId);

    const pendingWeekly = await this.settlePendingWeeklyDeductions(wallet.id);
    settlements.push(
      ...pendingWeekly.transactions.map((transaction: any) => ({
        type: 'WEEKLY_COOPERATIVE',
        amount: Number(transaction.settledAmount ?? transaction.amount),
        targetId: transaction.id,
      })),
    );

    let refreshedWallet = await this.getMemberWallet(memberId);
    let availableBalance = Number(refreshedWallet.availableBalance);

    if (availableBalance <= 0) {
      return settlements;
    }

    const weeklySettlements = await this.settleDueWeeklyDeductions(memberId, availableBalance);
    settlements.push(...weeklySettlements);

    refreshedWallet = await this.getMemberWallet(memberId);
    availableBalance = Number(refreshedWallet.availableBalance);

    if (availableBalance <= 0) {
      return settlements;
    }

    const subscriptions = await this.prisma.packageSubscription.findMany({
      where: {
        memberId,
        status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] },
        OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
        nextDueAt: { lte: new Date() },
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
        nextRepaymentAt: { lte: new Date() },
      },
      orderBy: { submittedAt: 'asc' },
    } as any);

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

    return settlements;
  }

  private async settleDueWeeklyDeductions(memberId: string, availableBalance: number): Promise<SettlementRecord[]> {
    if (availableBalance <= 0) {
      return [];
    }

    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        fullName: true,
        membershipNumber: true,
        status: true,
        joinedAt: true,
        weeklyDeductionStartsAt: true,
      },
    });

    if (!member || member.status !== 'ACTIVE') {
      return [];
    }

    const settings = await this.getWeeklyDeductionSettings();
    if (settings.amount <= 0) {
      return [];
    }

    const today = startOfIsoDay(new Date());
    await this.ensureWeeklyCyclesForMember(member, today, settings);

    const dueCycles = await (this.prisma as any).weeklyDeductionCycle.findMany({
      where: {
        memberId,
        dueDate: { lte: today },
        status: { in: WEEKLY_OPEN_STATUSES },
      },
      orderBy: { dueDate: 'asc' },
    });
    const outstanding = dueCycles.reduce(
      (sum: number, cycle: any) => sum + Math.max(Number(cycle.amount) - Number(cycle.amountPaid), 0),
      0,
    );
    const amountToDebit = Math.min(availableBalance, outstanding);

    if (amountToDebit <= 0) {
      return [];
    }

    const runStamp = today.toISOString();
    const reference = `AUTO-WEEKLY-FUNDING-${memberId}-${runStamp.slice(0, 10)}-${Date.now()}`;
    const result = await this.debitWallet(memberId, amountToDebit, 'WEEKLY_COOPERATIVE', reference, {
      category: 'automatic weekly cooperative',
      description: `Automatic weekly cooperative settlement for ${runStamp.slice(0, 10)}`,
      editable: false,
      lockReason: 'Weekly cooperative deductions are settled automatically from wallet funding.',
      metadata: {
        deductionDate: runStamp,
        memberName: member.fullName,
        membershipNumber: member.membershipNumber,
        autoSettled: true,
        settlementPriority: 'WEEKLY',
      },
    });

    await this.allocateWeeklySettlement(this.prisma, memberId, result.transaction.id, amountToDebit);

    return [
      {
        type: 'WEEKLY_COOPERATIVE',
        amount: amountToDebit,
        targetId: result.transaction.id,
      },
    ];
  }

  private async getWeeklyDeductionSettings() {
    const [amountConfig, dayConfig] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: WEEKLY_DEDUCTION_AMOUNT_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: WEEKLY_DEDUCTION_DAY_KEY } }),
    ]);

    return {
      amount: Number(amountConfig?.value ?? 0),
      day: dayConfig?.value ?? 'SUNDAY',
    };
  }

  private async ensureWeeklyCyclesForMember(
    member: { id: string; joinedAt: Date; weeklyDeductionStartsAt?: Date | null },
    throughDate: Date,
    settings: { amount: number; day: string },
  ) {
    if (settings.amount <= 0) {
      return;
    }

    const lastCycle = await (this.prisma as any).weeklyDeductionCycle.findFirst({
      where: { memberId: member.id },
      orderBy: { dueDate: 'desc' },
    });
    const startDate = this.firstWeeklyDueOnOrAfter(
      lastCycle ? addDays(lastCycle.dueDate, 1) : startOfIsoDay(member.weeklyDeductionStartsAt ?? member.joinedAt),
      settings.day,
    );
    const endDate = startOfIsoDay(throughDate);

    if (startDate.getTime() > endDate.getTime()) {
      return;
    }

    const data = [];
    for (let dueDate = startDate; dueDate.getTime() <= endDate.getTime(); dueDate = addDays(dueDate, 7)) {
      data.push({
        memberId: member.id,
        dueDate,
        amount: settings.amount,
        amountPaid: 0,
        status: weeklyCycleStatus(dueDate, settings.amount, 0),
      });
    }

    if (data.length) {
      await (this.prisma as any).weeklyDeductionCycle.createMany({
        data,
        skipDuplicates: true,
      });
    }
  }

  private firstWeeklyDueOnOrAfter(startDate: Date, day: string) {
    const targetDay = Math.max(DAYS.indexOf(day.toUpperCase()), 0);
    const first = startOfIsoDay(startDate);
    const offset = (targetDay - first.getUTCDay() + 7) % 7;
    return addDays(first, offset);
  }

  async applyLoanRepayment(
    memberId: string,
    loanId: string,
    amount: number,
    mode: 'AUTO' | 'ADMIN' | 'MEMBER' = 'MEMBER',
  ) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      include: { member: { select: { fullName: true, membershipNumber: true } } },
    });
    if (!loan || loan.memberId !== memberId) {
      throw new NotFoundException('Loan not found');
    }

    if (!['DISBURSED', 'IN_PROGRESS', 'OVERDUE'].includes(loan.status)) {
      throw new BadRequestException('This loan is not currently active for repayment.');
    }
    const repayableBalance = Number(loan.remainingBalance);
    if (amount > repayableBalance) {
      throw new BadRequestException(`Repayment amount cannot exceed the outstanding balance of ₦${repayableBalance.toLocaleString()}.`);
    }

    const dueKey =
      mode === 'AUTO'
        ? ((loan as any).nextRepaymentAt ?? loan.dueDate ?? new Date()).toISOString().slice(0, 10)
        : String(Date.now());
    const referencePrefix = mode === 'AUTO' ? 'AUTO-LOAN' : mode === 'ADMIN' ? 'ADMIN-LOAN' : 'REPAY';
    const reference = `${referencePrefix}-${loan.id}-${dueKey}`;
    const loanName = loan.purpose || `loan for ${loan.member.fullName}`;

    if (mode === 'AUTO') {
      const existingAutoPayment = await this.prisma.transaction.findUnique({ where: { reference } });
      if (existingAutoPayment) {
        const wallet = await this.getMemberWallet(memberId);
        return {
          wallet,
          reference,
          settlement: {
            type: 'LOAN_REPAYMENT',
            amount: 0,
            targetId: loan.id,
          },
        };
      }
    }

    await this.debitWallet(memberId, amount, 'LOAN_REPAYMENT', reference, {
      category: mode === 'AUTO' ? 'automatic loan repayment' : 'loan repayment',
      description:
        mode === 'AUTO'
          ? `Automatic settlement for ${loanName}`
          : mode === 'ADMIN'
            ? `Admin wallet allocation for ${loanName}`
            : `Loan repayment for ${loanName}`,
      editable: false,
      lockReason: 'Loan repayment transactions are system-generated and cannot be edited.',
      metadata: {
        loanId: loan.id,
        loanName,
        memberName: loan.member.fullName,
        membershipNumber: loan.member.membershipNumber,
        autoSettled: mode === 'AUTO',
        adminAllocated: mode === 'ADMIN',
      },
    });

    const nextRemaining = Math.max(repayableBalance - amount, 0);
    const explicitDisbursedAmount = Number((loan as any).disbursedAmount ?? 0);
    const disbursedAmount = explicitDisbursedAmount > 0 ? explicitDisbursedAmount : Number(loan.amount);
    const isFullyRepaid = nextRemaining <= 0 && disbursedAmount >= Number(loan.amount);
    await this.prisma.loanApplication.update({
      where: { id: loan.id },
      data: {
        remainingBalance: nextRemaining,
        status: isFullyRepaid ? 'COMPLETED' : 'IN_PROGRESS',
        nextRepaymentAt: isFullyRepaid ? null : this.getNextLoanRepaymentDate({ ...loan, remainingBalance: nextRemaining } as any),
      } as any,
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
    const packageName = subscription.package.name;
    const dueKey =
      mode === 'AUTO'
        ? (subscription.nextDueAt ?? this.getNextPackageDueDate({
            amountPaid,
            approvedAt: (subscription as any).approvedAt,
            disbursedAt: (subscription as any).disbursedAt,
            package: subscription.package,
            createdAt: subscription.createdAt,
          }) ?? subscription.createdAt)
            .toISOString()
            .slice(0, 10)
        : `${Date.now()}`;

    if (penaltyAccrued > 0 && remainingToSpend > 0) {
      const penaltyPayment = Math.min(remainingToSpend, penaltyAccrued);
      const penaltyReference =
        mode === 'AUTO'
          ? `AUTO-PACKAGE-PENALTY-${subscription.id}-${dueKey}-${Math.round(penaltyAccrued * 100)}`
          : `PACKAGE-PENALTY-${subscription.id}-${Date.now()}`;
      const existingPenalty =
        mode === 'AUTO'
          ? await this.prisma.transaction.findUnique({ where: { reference: penaltyReference } })
          : null;
      let penaltyWasApplied = false;

      if (!existingPenalty) {
        try {
          await this.debitWallet(memberId, penaltyPayment, 'PACKAGE_PENALTY', penaltyReference, {
            category: mode === 'AUTO' ? 'automatic package penalty settlement' : 'package penalty settlement',
            description:
              mode === 'AUTO'
                ? `Automatic penalty settlement for ${packageName}`
                : `Wallet allocation for ${packageName} penalty`,
            editable: false,
            lockReason: 'Package penalty transactions are system-generated and cannot be edited.',
            metadata: {
              subscriptionId: subscription.id,
              packageName,
              dueAt: subscription.nextDueAt?.toISOString() ?? null,
              dueCycle: dueKey,
              autoSettled: mode === 'AUTO',
              adminAllocated: mode === 'ADMIN',
            },
          });
          penaltyWasApplied = true;
        } catch (error) {
          if (!isUniqueConstraintError(error)) {
            throw error;
          }
        }
      }

      if (penaltyWasApplied) {
        penaltyAccrued -= penaltyPayment;
        remainingToSpend -= penaltyPayment;
        settlements.push({ type: 'PACKAGE_PENALTY', amount: penaltyPayment, targetId: subscription.id });
      }
    }

    if (amountRemaining > 0 && remainingToSpend > 0) {
      const principalPayment = Math.min(remainingToSpend, amountRemaining);
      const packageReference =
        mode === 'AUTO'
          ? `AUTO-PACKAGE-${subscription.id}-${dueKey}-${Math.round(amountPaid * 100)}`
          : `PACKAGE-${subscription.id}-${Date.now()}`;
      const existingPackage =
        mode === 'AUTO'
          ? await this.prisma.transaction.findUnique({ where: { reference: packageReference } })
          : null;
      let packageWasApplied = false;

      if (!existingPackage) {
        try {
          await this.debitWallet(memberId, principalPayment, 'PACKAGE_SUBSCRIPTION', packageReference, {
            category: mode === 'AUTO' ? 'automatic package repayment' : 'package repayment',
            description:
              mode === 'AUTO'
                ? `Automatic package settlement for ${packageName}`
                : `Wallet allocation for ${packageName}`,
            editable: false,
            lockReason: 'Package subscription transactions are system-generated and cannot be edited.',
            metadata: {
              subscriptionId: subscription.id,
              packageName,
              dueAt: subscription.nextDueAt?.toISOString() ?? null,
              dueCycle: dueKey,
              autoSettled: mode === 'AUTO',
              adminAllocated: mode === 'ADMIN',
            },
          });
          packageWasApplied = true;
        } catch (error) {
          if (!isUniqueConstraintError(error)) {
            throw error;
          }
        }
      }

      if (packageWasApplied) {
        amountRemaining -= principalPayment;
        amountPaid += principalPayment;
        remainingToSpend -= principalPayment;
        settlements.push({ type: 'PACKAGE_SUBSCRIPTION', amount: principalPayment, targetId: subscription.id });
      }
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
        ? await this.prisma.savingsAccount.findUnique({ where: { id: accountId }, include: { member: true } })
        : await this.prisma.savingsAccount.findFirst({ where: { memberId }, include: { member: true } })) ?? null;

    if (account && account.memberId !== memberId) {
      throw new BadRequestException('Invalid savings account selected.');
    }

    if (!account) {
      account = await this.prisma.savingsAccount.create({
        data: {
          memberId,
          contributionFrequency: 'MONTHLY',
        },
        include: { member: true },
      });
    }

    const referencePrefix = mode === 'AUTO' ? 'AUTO-SAVE' : mode === 'ADMIN' ? 'ADMIN-SAVE' : 'SAVE';
    const reference = `${referencePrefix}-${account.id}-${Date.now()}`;
    const description =
      mode === 'AUTO'
        ? `Automatic savings contribution for ${account.member.fullName}`
        : mode === 'ADMIN'
          ? `Admin wallet allocation to ${account.member.fullName}'s savings`
          : `Savings contribution for ${account.member.fullName}`;

    await this.debitWallet(memberId, amount, 'SAVINGS', reference, {
      category: mode === 'AUTO' ? 'automatic savings contribution' : 'savings contribution',
      description,
      editable: false,
      lockReason: 'Savings contribution transactions are system-generated and cannot be edited.',
      metadata: {
        savingsAccountId: account.id,
        memberName: account.member.fullName,
        membershipNumber: account.member.membershipNumber,
        autoSettled: mode === 'AUTO',
        adminAllocated: mode === 'ADMIN',
      },
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
    disbursedAmount?: any;
    remainingBalance: any;
    tenorMonths: number;
    tenorUnit?: LoanTenorUnit;
    disbursedAt?: Date | null;
    dueDate?: Date | null;
    nextRepaymentAt?: Date | null;
    submittedAt: Date;
  }) {
    if (!loan.disbursedAt || loan.tenorMonths <= 0) {
      return 0;
    }
    if (!loan.nextRepaymentAt || loan.nextRepaymentAt.getTime() > Date.now()) {
      return 0;
    }

    const explicitDisbursedAmount = Number(loan.disbursedAmount ?? 0);
    const totalAmount = explicitDisbursedAmount > 0 ? explicitDisbursedAmount : Number(loan.amount);
    const totalInstallments = this.getLoanInstallmentCount(loan);
    const amountPaidSoFar = Math.max(totalAmount - Number(loan.remainingBalance), 0);
    const installmentAmount = totalAmount / totalInstallments;
    const dueInstallments = Math.min(
      totalInstallments,
      (loan.tenorUnit ?? 'MONTHS') === 'WEEKS'
        ? this.fullWeeksBetween(loan.disbursedAt, new Date())
        : this.fullMonthsBetween(loan.disbursedAt, new Date()),
    );
    const dueAmount = installmentAmount * dueInstallments;

    return Math.max(dueAmount - amountPaidSoFar, 0);
  }

  private getNextLoanRepaymentDate(loan: {
    amount: any;
    disbursedAmount?: any;
    remainingBalance: any;
    tenorMonths: number;
    tenorUnit?: LoanTenorUnit;
    disbursedAt?: Date | null;
    dueDate?: Date | null;
    submittedAt: Date;
  }) {
    if (!loan.disbursedAt || loan.tenorMonths <= 0 || Number(loan.remainingBalance) <= 0) {
      return null;
    }

    const explicitDisbursedAmount = Number(loan.disbursedAmount ?? 0);
    const totalAmount = explicitDisbursedAmount > 0 ? explicitDisbursedAmount : Number(loan.amount);
    const totalInstallments = this.getLoanInstallmentCount(loan);
    const amountPaidSoFar = Math.max(totalAmount - Number(loan.remainingBalance), 0);
    const installmentAmount = totalAmount / totalInstallments;
    const paidInstallments = Math.floor(amountPaidSoFar / installmentAmount);
    const nextStep = Math.min(paidInstallments + 1, totalInstallments);
    const nextDueAt = new Date(loan.disbursedAt);
    if ((loan.tenorUnit ?? 'MONTHS') === 'WEEKS') {
      nextDueAt.setDate(nextDueAt.getDate() + nextStep * 7);
    } else {
      nextDueAt.setMonth(nextDueAt.getMonth() + nextStep);
    }
    return nextDueAt;
  }

  private getLoanInstallmentCount(loan: {
    tenorMonths: number;
    tenorUnit?: LoanTenorUnit;
    disbursedAt?: Date | null;
    dueDate?: Date | null;
  }) {
    const tenorMonths = Math.max(Math.ceil(Number(loan.tenorMonths) || 1), 1);
    if ((loan.tenorUnit ?? 'MONTHS') !== 'WEEKS') {
      return tenorMonths;
    }

    const start = loan.disbursedAt ?? new Date();
    const maturity = loan.dueDate ?? this.addCalendarMonths(start, tenorMonths);
    return Math.max(Math.ceil((maturity.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)), 1);
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

    return packageStartDate ?? approvalAnchor;
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

  private addCalendarMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }
}
