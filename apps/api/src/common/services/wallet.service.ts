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
  repaymentAttempt?: RepaymentAttemptOptions;
}

interface DebitWalletOptions extends TransactionOptions {
  allowNegative?: boolean;
}

interface FundingDebtRecoveryOptions extends TransactionOptions {
  actorId?: string;
  paymentId?: string;
}

type SettlementRecord = {
  type: string;
  amount: number;
  targetId: string;
  transactionId?: string;
  reference?: string | null;
  expectedAmount?: number;
  remainingAmount?: number;
  repaymentStatus?: RepaymentAttemptStatus;
};

type DebtRecoveryContext = {
  referenceBase: string;
  trigger: string;
  fundingTransactionId: string;
  paymentId?: string;
  actorId?: string;
};

type RepaymentAttemptStatus = 'COMPLETED' | 'PARTIAL' | 'UNPAID';
type RepaymentScheduleTargetType = 'PackageSubscription' | 'LoanApplication';

type RepaymentAttemptOptions = {
  phase: string;
  targetType: string;
  targetId?: string | null;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: RepaymentAttemptStatus;
  mode: 'AUTO' | 'ADMIN' | 'MEMBER' | string;
  dueAt?: Date | null;
  metadata?: Record<string, unknown>;
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

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
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

  private async getMemberWalletWithClient(client: any, memberId: string) {
    let wallet = await client.wallet.findUnique({
      where: { memberId },
    });

    if (!wallet) {
      wallet = await client.wallet.create({
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

  async creditWalletWithDebtRecovery(
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
    options?: FundingDebtRecoveryOptions,
  ) {
    return this.prisma.$transaction((tx) =>
      this.applyWalletFundingWithDebtRecovery(tx, memberId, amount, type, reference, options),
    );
  }

  async applyWalletFundingWithDebtRecovery(
    client: any,
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
    options?: FundingDebtRecoveryOptions,
  ) {
    const wallet = await this.getMemberWalletWithClient(client, memberId);
    const fundingMetadata = {
      ...(options?.metadata ?? {}),
      paymentId: options?.paymentId,
      debtRecoveryApplied: true,
    };

    const fundingTransaction = await client.transaction.create({
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
        metadata: fundingMetadata as any,
      },
    });

    if (type === 'WALLET_FUNDING' || type === 'FUNDING') {
      await this.financialPosting.postWalletFunding(
        {
          memberId,
          amount,
          reference,
          sourceType: 'Transaction',
          sourceId: fundingTransaction.id,
          description: options?.description || 'Member wallet funding',
          actorId: options?.actorId,
        },
        client,
      );
    } else if (['INVESTMENT_CANCELLATION_REFUND', 'INVESTMENT_RETURN', 'ADMIN_REFUND'].includes(type)) {
      await this.financialPosting.postAssociationToWallet(
        {
          memberId,
          amount,
          reference,
          sourceType: 'Transaction',
          sourceId: fundingTransaction.id,
          description: options?.description || 'Association wallet credit',
          actorId: options?.actorId,
          category: options?.category,
        },
        client,
      );
    }

    const recovery = await this.settleOverdueDebtsFromFunding(client, memberId, wallet.id, amount, {
      referenceBase: reference ?? `FUND-${fundingTransaction.id}`,
      trigger: String(options?.metadata?.trigger ?? 'PAYMENT_APPROVAL'),
      fundingTransactionId: fundingTransaction.id,
      paymentId: options?.paymentId,
      actorId: options?.actorId,
    });
    const debtSettlementAmount = recovery.debtSettlementAmount;
    const walletCreditAmount = recovery.walletCreditAmount;

    const updatedWallet = await client.wallet.update({
      where: { id: wallet.id },
      data: {
        ...(walletCreditAmount > 0 ? { availableBalance: { increment: walletCreditAmount } } : {}),
        totalFunded: { increment: amount },
      },
    });

    const transaction = await client.transaction.update({
      where: { id: fundingTransaction.id },
      data: {
        metadata: {
          ...fundingMetadata,
          debtSettlementAmount,
          walletCreditAmount,
          settlementCount: recovery.settlements.length,
          settlements: recovery.settlements,
        } as any,
      },
    });

    return {
      wallet: updatedWallet,
      transaction,
      settlements: recovery.settlements,
      debtSettlementAmount,
      walletCreditAmount,
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

      if (options?.repaymentAttempt) {
        await this.upsertRepaymentAttempt(tx, memberId, transaction.id, reference, options.repaymentAttempt);
      }

      return { updatedWallet, transaction };
    });

    return { wallet: updatedWallet, transaction };
  }

  async recordRepaymentAttempt(
    memberId: string,
    type: TransactionType,
    amount: number,
    reference: string,
    options: TransactionOptions,
  ) {
    const wallet = await this.getMemberWallet(memberId);
    const existing = await this.prisma.transaction.findUnique({ where: { reference } });
    if (existing) {
      if (options.repaymentAttempt) {
        await this.upsertRepaymentAttempt(this.prisma, memberId, existing.id, reference, options.repaymentAttempt);
      }
      return { wallet, transaction: existing };
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount,
        status: 'APPROVED',
        reference,
        category: options.category,
        description: options.description,
        editable: options.editable ?? false,
        lockReason: options.lockReason,
        metadata: options.metadata as any,
      },
    });

    if (options.repaymentAttempt) {
      await this.upsertRepaymentAttempt(this.prisma, memberId, transaction.id, reference, options.repaymentAttempt);
    }

    return { wallet, transaction };
  }

  private async upsertRepaymentAttempt(
    client: any,
    memberId: string,
    transactionId: string | null,
    reference: string | undefined,
    attempt: RepaymentAttemptOptions,
  ) {
    const data = {
      memberId,
      transactionId,
      phase: attempt.phase,
      targetType: attempt.targetType,
      targetId: attempt.targetId ?? null,
      expectedAmount: attempt.expectedAmount,
      paidAmount: attempt.paidAmount,
      remainingAmount: attempt.remainingAmount,
      status: attempt.status,
      mode: attempt.mode,
      reference: reference ?? null,
      dueAt: attempt.dueAt ?? null,
      metadata: attempt.metadata as any,
    };

    if (reference) {
      return (client as any).repaymentAttempt.upsert({
        where: { reference },
        update: {
          ...data,
          updatedAt: new Date(),
        },
        create: data,
      });
    }

    return (client as any).repaymentAttempt.create({ data });
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

  async ensurePackageRepaymentSchedule(subscriptionId: string, client: any = this.prisma) {
    const existing = await (client as any).repaymentScheduleItem.findMany({
      where: { targetType: 'PackageSubscription', targetId: subscriptionId },
      orderBy: [{ sequence: 'asc' }],
    });
    if (existing.length) {
      await this.refreshScheduleStatuses(client, 'PackageSubscription', subscriptionId);
      return (client as any).repaymentScheduleItem.findMany({
        where: { targetType: 'PackageSubscription', targetId: subscriptionId },
        orderBy: [{ sequence: 'asc' }],
      });
    }

    return this.rebuildPackageRepaymentSchedule(subscriptionId, client);
  }

  async rebuildPackageRepaymentSchedule(subscriptionId: string, client: any = this.prisma) {
    const subscription = await client.packageSubscription.findUnique({
      where: { id: subscriptionId },
      include: { package: true },
    });
    if (!subscription) {
      throw new NotFoundException('Package subscription not found');
    }

    const rows = this.buildPackageScheduleRows(subscription);
    await (client as any).repaymentScheduleItem.deleteMany({
      where: { targetType: 'PackageSubscription', targetId: subscriptionId },
    });
    if (rows.length) {
      await (client as any).repaymentScheduleItem.createMany({ data: rows });
    }

    const nextDueAt = await this.nextOpenScheduleDueDate(client, 'PackageSubscription', subscriptionId);
    if (['APPROVED', 'DISBURSED', 'IN_PROGRESS', 'COMPLETED'].includes(subscription.status)) {
      await client.packageSubscription.update({
        where: { id: subscriptionId },
        data: { nextDueAt },
      });
    }

    return (client as any).repaymentScheduleItem.findMany({
      where: { targetType: 'PackageSubscription', targetId: subscriptionId },
      orderBy: [{ sequence: 'asc' }],
    });
  }

  async ensureLoanRepaymentSchedule(loanId: string, client: any = this.prisma) {
    const existing = await (client as any).repaymentScheduleItem.findMany({
      where: { targetType: 'LoanApplication', targetId: loanId },
      orderBy: [{ sequence: 'asc' }],
    });
    if (existing.length) {
      await this.refreshScheduleStatuses(client, 'LoanApplication', loanId);
      return (client as any).repaymentScheduleItem.findMany({
        where: { targetType: 'LoanApplication', targetId: loanId },
        orderBy: [{ sequence: 'asc' }],
      });
    }

    return this.rebuildLoanRepaymentSchedule(loanId, client);
  }

  async rebuildLoanRepaymentSchedule(loanId: string, client: any = this.prisma) {
    const loan = await client.loanApplication.findUnique({
      where: { id: loanId },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const rows = this.buildLoanScheduleRows(loan);
    await (client as any).repaymentScheduleItem.deleteMany({
      where: { targetType: 'LoanApplication', targetId: loanId },
    });
    if (rows.length) {
      await (client as any).repaymentScheduleItem.createMany({ data: rows });
    }

    const nextRepaymentAt = await this.nextOpenScheduleDueDate(client, 'LoanApplication', loanId);
    if (['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(loan.status)) {
      await client.loanApplication.update({
        where: { id: loanId },
        data: { nextRepaymentAt },
      });
    }

    return (client as any).repaymentScheduleItem.findMany({
      where: { targetType: 'LoanApplication', targetId: loanId },
      orderBy: [{ sequence: 'asc' }],
    });
  }

  serializeRepaymentScheduleItem(item: any) {
    return {
      id: item.id,
      installment: item.sequence,
      sequence: item.sequence,
      dueDate: item.dueDate,
      amount: Number(item.expectedAmount),
      expectedAmount: Number(item.expectedAmount),
      paidAmount: Number(item.paidAmount),
      remainingAmount: Number(item.remainingAmount),
      status: item.status,
      metadata: item.metadata ?? {},
    };
  }

  private buildPackageScheduleRows(subscription: any) {
    if (!subscription.package) {
      return [];
    }

    const totalAmount = Number(subscription.package.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return [];
    }

    const frequency = String(subscription.package.repaymentFrequency ?? 'WEEKLY').toUpperCase();
    const anchor = this.getPackageScheduleAnchor(subscription) ?? subscription.createdAt ?? new Date();
    const installmentCount = this.getPackageInstallmentCount(subscription.package, anchor);
    const installments = this.splitInstallments(totalAmount, installmentCount);
    const totalPaid = subscription.status === 'COMPLETED' ? totalAmount : Math.max(Number(subscription.amountPaid ?? 0), 0);
    let remainingPaid = totalPaid;

    return installments.map((expectedAmount, index) => {
      const dueDate = this.addScheduleStep(anchor, frequency === 'MONTHLY' ? 'MONTHS' : 'WEEKS', index + 1);
      const paidAmount = roundMoney(Math.min(Math.max(remainingPaid, 0), expectedAmount));
      remainingPaid = roundMoney(remainingPaid - paidAmount);

      return {
        memberId: subscription.memberId,
        targetType: 'PackageSubscription',
        targetId: subscription.id,
        sequence: index + 1,
        dueDate,
        expectedAmount,
        paidAmount,
        remainingAmount: roundMoney(Math.max(expectedAmount - paidAmount, 0)),
        status: this.scheduleItemStatus(dueDate, expectedAmount, paidAmount),
        metadata: {
          packageId: subscription.package.id,
          packageName: subscription.package.name,
          repaymentFrequency: frequency,
        } as any,
      };
    });
  }

  private buildLoanScheduleRows(loan: any) {
    const activeLoan = ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(loan.status);
    const disbursedAmount = Number(loan.disbursedAmount ?? 0);
    const totalAmount = activeLoan ? (disbursedAmount > 0 ? disbursedAmount : Number(loan.amount)) : 0;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return [];
    }

    const tenorUnit = ((loan.tenorUnit ?? 'MONTHS') as LoanTenorUnit) === 'WEEKS' ? 'WEEKS' : 'MONTHS';
    const anchor = loan.disbursedAt ?? loan.approvedAt ?? loan.submittedAt ?? new Date();
    const maturity = loan.dueDate ?? this.addCalendarMonths(anchor, Math.max(Number(loan.tenorMonths) || 1, 1));
    const installmentCount =
      tenorUnit === 'WEEKS'
        ? Math.max(Math.ceil((maturity.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000)), 1)
        : Math.max(Math.ceil(Number(loan.tenorMonths) || 1), 1);
    const installments = this.splitInstallments(totalAmount, installmentCount);
    const paidSoFar = loan.status === 'COMPLETED' ? totalAmount : Math.max(totalAmount - Number(loan.remainingBalance ?? 0), 0);
    let remainingPaid = paidSoFar;

    return installments.map((expectedAmount, index) => {
      const dueDate = this.addScheduleStep(anchor, tenorUnit, index + 1);
      const paidAmount = roundMoney(Math.min(Math.max(remainingPaid, 0), expectedAmount));
      remainingPaid = roundMoney(remainingPaid - paidAmount);

      return {
        memberId: loan.memberId,
        targetType: 'LoanApplication',
        targetId: loan.id,
        sequence: index + 1,
        dueDate,
        expectedAmount,
        paidAmount,
        remainingAmount: roundMoney(Math.max(expectedAmount - paidAmount, 0)),
        status: this.scheduleItemStatus(dueDate, expectedAmount, paidAmount),
        metadata: {
          loanPurpose: loan.purpose,
          tenorUnit,
        } as any,
      };
    });
  }

  private splitInstallments(totalAmount: number, count: number) {
    const frameCount = Math.max(Math.ceil(count || 1), 1);
    const total = roundMoney(totalAmount);
    const regular = roundMoney(total / frameCount);
    let allocated = 0;

    return Array.from({ length: frameCount }, (_, index) => {
      const amount = index === frameCount - 1 ? roundMoney(total - allocated) : regular;
      allocated = roundMoney(allocated + amount);
      return amount;
    });
  }

  private scheduleItemStatus(dueDate: Date, expectedAmount: number, paidAmount: number, asOf = new Date()) {
    if (paidAmount >= expectedAmount) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL';
    return startOfIsoDay(dueDate).getTime() <= startOfIsoDay(asOf).getTime() ? 'OVERDUE' : 'UPCOMING';
  }

  private async getScheduleDueAmount(
    client: any,
    targetType: RepaymentScheduleTargetType,
    targetId: string,
    dueOnly = true,
  ) {
    const dueBefore = addDays(startOfIsoDay(new Date()), 1);
    const items = await (client as any).repaymentScheduleItem.findMany({
      where: {
        targetType,
        targetId,
        remainingAmount: { gt: 0 },
        ...(dueOnly ? { dueDate: { lt: dueBefore } } : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
    });

    return {
      amount: roundMoney(items.reduce((sum: number, item: any) => sum + Number(item.remainingAmount), 0)),
      dueAt: items[0]?.dueDate ?? null,
      items,
    };
  }

  private async refreshScheduleStatuses(client: any, targetType: RepaymentScheduleTargetType, targetId: string) {
    const items = await (client as any).repaymentScheduleItem.findMany({
      where: { targetType, targetId },
      select: { id: true, dueDate: true, expectedAmount: true, paidAmount: true, status: true },
    });

    await Promise.all(
      items.map((item: any) => {
        const nextStatus = this.scheduleItemStatus(item.dueDate, Number(item.expectedAmount), Number(item.paidAmount));
        if (nextStatus === item.status) return null;
        return (client as any).repaymentScheduleItem.update({
          where: { id: item.id },
          data: { status: nextStatus },
        });
      }),
    );
  }

  private async allocateRepaymentSchedule(
    client: any,
    targetType: RepaymentScheduleTargetType,
    targetId: string,
    amount: number,
    dueOnly = false,
  ) {
    let remaining = roundMoney(Math.max(amount, 0));
    const schedule = await this.getScheduleDueAmount(client, targetType, targetId, dueOnly);
    const allocations: Array<{ itemId: string; sequence: number; dueDate: Date; amount: number; remainingAmount: number }> = [];

    for (const item of schedule.items) {
      if (remaining <= 0) break;

      const expectedAmount = Number(item.expectedAmount);
      const currentPaid = Number(item.paidAmount);
      const openAmount = Math.max(Number(item.remainingAmount), 0);
      const payment = roundMoney(Math.min(openAmount, remaining));
      if (payment <= 0) continue;

      const nextPaid = roundMoney(currentPaid + payment);
      const nextRemaining = roundMoney(Math.max(expectedAmount - nextPaid, 0));
      await (client as any).repaymentScheduleItem.update({
        where: { id: item.id },
        data: {
          paidAmount: nextPaid,
          remainingAmount: nextRemaining,
          status: this.scheduleItemStatus(item.dueDate, expectedAmount, nextPaid),
        },
      });

      allocations.push({
        itemId: item.id,
        sequence: item.sequence,
        dueDate: item.dueDate,
        amount: payment,
        remainingAmount: nextRemaining,
      });
      remaining = roundMoney(remaining - payment);
    }

    return {
      allocations,
      expectedAmount: schedule.amount,
      dueAt: schedule.dueAt,
      appliedAmount: roundMoney(amount - remaining),
      unallocatedAmount: remaining,
    };
  }

  private async getScheduleTotals(client: any, targetType: RepaymentScheduleTargetType, targetId: string) {
    const items = await (client as any).repaymentScheduleItem.findMany({
      where: { targetType, targetId },
      select: { expectedAmount: true, paidAmount: true, remainingAmount: true },
    });

    return items.reduce(
      (totals: { expected: number; paid: number; remaining: number }, item: any) => ({
        expected: roundMoney(totals.expected + Number(item.expectedAmount)),
        paid: roundMoney(totals.paid + Number(item.paidAmount)),
        remaining: roundMoney(totals.remaining + Number(item.remainingAmount)),
      }),
      { expected: 0, paid: 0, remaining: 0 },
    );
  }

  private async nextOpenScheduleDueDate(client: any, targetType: RepaymentScheduleTargetType, targetId: string) {
    const item = await (client as any).repaymentScheduleItem.findFirst({
      where: { targetType, targetId, remainingAmount: { gt: 0 } },
      orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
      select: { dueDate: true },
    });

    return item?.dueDate ?? null;
  }

  private addScheduleStep(date: Date, unit: 'WEEKS' | 'MONTHS', steps: number) {
    const next = new Date(date);
    if (unit === 'WEEKS') {
      next.setDate(next.getDate() + steps * 7);
      return next;
    }

    next.setMonth(next.getMonth() + steps);
    return next;
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

    const weeklySettlements = await this.settleWeeklyObligations(memberId);
    settlements.push(...weeklySettlements);

    refreshedWallet = await this.getMemberWallet(memberId);
    availableBalance = Number(refreshedWallet.availableBalance);

    if (availableBalance <= 0) {
      return settlements;
    }

    const packageSettlements = await this.settlePackageObligations(memberId);
    settlements.push(...packageSettlements);

    refreshedWallet = await this.getMemberWallet(memberId);
    availableBalance = Number(refreshedWallet.availableBalance);
    if (availableBalance <= 0) {
      return settlements;
    }

    const loanSettlements = await this.settleLoanObligations(memberId);
    settlements.push(...loanSettlements);

    return settlements;
  }

  private async settleOverdueDebtsFromFunding(
    client: any,
    memberId: string,
    walletId: string,
    fundingAmount: number,
    context: DebtRecoveryContext,
  ) {
    const settlements: SettlementRecord[] = [];
    let remainingFunding = roundMoney(Math.max(fundingAmount, 0));

    const weeklySettlements = await this.applyWeeklyDebtRecovery(client, memberId, walletId, remainingFunding, context);
    settlements.push(...weeklySettlements);
    remainingFunding = roundMoney(
      remainingFunding - weeklySettlements.reduce((sum, settlement) => sum + settlement.amount, 0),
    );

    if (remainingFunding > 0) {
      const packageSettlements = await this.applyPackageDebtRecovery(client, memberId, walletId, remainingFunding, context);
      settlements.push(...packageSettlements);
      remainingFunding = roundMoney(
        remainingFunding - packageSettlements.reduce((sum, settlement) => sum + settlement.amount, 0),
      );
    }

    if (remainingFunding > 0) {
      const loanSettlements = await this.applyLoanDebtRecovery(client, memberId, walletId, remainingFunding, context);
      settlements.push(...loanSettlements);
      remainingFunding = roundMoney(
        remainingFunding - loanSettlements.reduce((sum, settlement) => sum + settlement.amount, 0),
      );
    }

    const walletCreditAmount = roundMoney(Math.max(remainingFunding, 0));
    return {
      settlements,
      debtSettlementAmount: roundMoney(fundingAmount - walletCreditAmount),
      walletCreditAmount,
    };
  }

  private async applyWeeklyDebtRecovery(
    client: any,
    memberId: string,
    walletId: string,
    availableAmount: number,
    context: DebtRecoveryContext,
  ): Promise<SettlementRecord[]> {
    if (availableAmount <= 0) {
      return [];
    }

    const member = await client.member.findUnique({
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

    const settings = await this.getWeeklyDeductionSettings(client);
    if (settings.amount <= 0) {
      return [];
    }

    const today = startOfIsoDay(new Date());
    await this.ensureWeeklyCyclesForMember(member, today, settings, client);

    const dueCycles = await client.weeklyDeductionCycle.findMany({
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
    const amountToApply = roundMoney(Math.min(Math.max(availableAmount, 0), outstanding));

    if (outstanding <= 0 || amountToApply <= 0) {
      return [];
    }

    const firstDueAt = dueCycles[0]?.dueDate ?? today;
    const lastDueAt = dueCycles[dueCycles.length - 1]?.dueDate ?? today;
    const repaymentStatus = this.repaymentAttemptStatus(amountToApply, outstanding);
    const reference = `${context.referenceBase}-WEEKLY`;
    const transaction = await this.createDebtRecoveryTransaction(client, {
      memberId,
      walletId,
      type: 'WEEKLY_COOPERATIVE',
      amount: amountToApply,
      reference,
      category: 'admin payment debt recovery',
      description: `Debt recovery from approved wallet funding for weekly deductions`,
      metadata: {
        fundingTransactionId: context.fundingTransactionId,
        paymentId: context.paymentId,
        deductionDate: today.toISOString(),
        memberName: member.fullName,
        membershipNumber: member.membershipNumber,
        trigger: context.trigger,
        adminAllocated: true,
        settlementPriority: 'WEEKLY',
        repaymentPhase: 'WEEKLY_DEDUCTION',
        repaymentStatus,
        expectedAmount: outstanding,
        paidAmount: amountToApply,
        remainingAmount: Math.max(outstanding - amountToApply, 0),
        dueFrom: firstDueAt.toISOString(),
        dueTo: lastDueAt.toISOString(),
        dueCycleIds: dueCycles.map((cycle: any) => cycle.id),
      },
      repaymentAttempt: {
        phase: 'WEEKLY_DEDUCTION',
        targetType: 'WeeklyDeduction',
        targetId: memberId,
        expectedAmount: outstanding,
        paidAmount: amountToApply,
        remainingAmount: Math.max(outstanding - amountToApply, 0),
        status: repaymentStatus,
        mode: 'ADMIN',
        dueAt: firstDueAt,
        metadata: {
          fundingTransactionId: context.fundingTransactionId,
          paymentId: context.paymentId,
          dueFrom: firstDueAt.toISOString(),
          dueTo: lastDueAt.toISOString(),
          dueCycleIds: dueCycles.map((cycle: any) => cycle.id),
          trigger: context.trigger,
        },
      },
      actorId: context.actorId,
    });

    await this.allocateWeeklySettlement(client, memberId, transaction.id, amountToApply);

    return [
      {
        type: 'WEEKLY_COOPERATIVE',
        amount: amountToApply,
        targetId: transaction.id,
        transactionId: transaction.id,
        reference: transaction.reference,
        expectedAmount: outstanding,
        remainingAmount: Math.max(outstanding - amountToApply, 0),
        repaymentStatus,
      },
    ];
  }

  private async applyPackageDebtRecovery(
    client: any,
    memberId: string,
    walletId: string,
    availableAmount: number,
    context: DebtRecoveryContext,
  ): Promise<SettlementRecord[]> {
    const settlements: SettlementRecord[] = [];
    let remainingFunding = roundMoney(Math.max(availableAmount, 0));
    if (remainingFunding <= 0) {
      return settlements;
    }

    const subscriptions = await client.packageSubscription.findMany({
      where: {
        memberId,
        member: { status: 'ACTIVE' },
        status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] },
        OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
      },
      include: {
        package: true,
        member: { select: { fullName: true, membershipNumber: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const packageCandidates = [];
    for (const subscription of subscriptions as any[]) {
      await this.ensurePackageRepaymentSchedule(subscription.id, client);
      const principalDue = await this.getScheduleDueAmount(client, 'PackageSubscription', subscription.id, true);
      const amountDueNow = Math.min(principalDue.amount, Number(subscription.amountRemaining));
      const expectedAmount = Math.min(
        Number(subscription.penaltyAccrued) + amountDueNow,
        Number(subscription.penaltyAccrued) + Number(subscription.amountRemaining),
      );
      if (expectedAmount <= 0) {
        continue;
      }
      packageCandidates.push({
        subscription,
        amountDueNow,
        expectedAmount,
        dueAt: principalDue.dueAt ?? subscription.nextDueAt ?? subscription.createdAt ?? new Date(),
      });
    }
    packageCandidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    let sequence = 0;
    for (const candidate of packageCandidates) {
      if (remainingFunding <= 0) {
        break;
      }

      const { subscription, amountDueNow, expectedAmount, dueAt } = candidate;
      let remainingToSpend = roundMoney(Math.min(remainingFunding, expectedAmount));
      let penaltyAccrued = Number(subscription.penaltyAccrued);
      let amountRemaining = Number(subscription.amountRemaining);
      let amountPaid = Number(subscription.amountPaid);
      const packageName = subscription.package.name;
      const dueKey = dueAt.toISOString().slice(0, 10);

      if (penaltyAccrued > 0 && remainingToSpend > 0) {
        const penaltyPayment = roundMoney(Math.min(remainingToSpend, penaltyAccrued));
        const expectedPenaltyAmount = penaltyAccrued;
        const repaymentStatus = this.repaymentAttemptStatus(penaltyPayment, expectedPenaltyAmount);
        const reference = `${context.referenceBase}-PKG-PEN-${++sequence}`;
        const transaction = await this.createDebtRecoveryTransaction(client, {
          memberId,
          walletId,
          type: 'PACKAGE_PENALTY',
          amount: penaltyPayment,
          reference,
          category: 'admin payment package penalty recovery',
          description: `Debt recovery from approved wallet funding for ${packageName} penalty`,
          metadata: {
            fundingTransactionId: context.fundingTransactionId,
            paymentId: context.paymentId,
            subscriptionId: subscription.id,
            packageName,
            dueAt: dueAt.toISOString(),
            dueCycle: dueKey,
            adminAllocated: true,
            trigger: context.trigger,
            repaymentPhase: 'PACKAGE_PENALTY',
            repaymentStatus,
            expectedAmount: expectedPenaltyAmount,
            paidAmount: penaltyPayment,
            remainingAmount: Math.max(expectedPenaltyAmount - penaltyPayment, 0),
          },
          repaymentAttempt: {
            phase: 'PACKAGE_PENALTY',
            targetType: 'PackageSubscription',
            targetId: subscription.id,
            expectedAmount: expectedPenaltyAmount,
            paidAmount: penaltyPayment,
            remainingAmount: Math.max(expectedPenaltyAmount - penaltyPayment, 0),
            status: repaymentStatus,
            mode: 'ADMIN',
            dueAt,
            metadata: {
              fundingTransactionId: context.fundingTransactionId,
              paymentId: context.paymentId,
              packageName,
              dueCycle: dueKey,
              trigger: context.trigger,
            },
          },
          actorId: context.actorId,
        });

        penaltyAccrued = roundMoney(penaltyAccrued - penaltyPayment);
        remainingToSpend = roundMoney(remainingToSpend - penaltyPayment);
        remainingFunding = roundMoney(remainingFunding - penaltyPayment);
        settlements.push({
          type: 'PACKAGE_PENALTY',
          amount: penaltyPayment,
          targetId: subscription.id,
          transactionId: transaction.id,
          reference: transaction.reference,
          expectedAmount: expectedPenaltyAmount,
          remainingAmount: Math.max(expectedPenaltyAmount - penaltyPayment, 0),
          repaymentStatus,
        });
      }

      if (amountRemaining > 0 && remainingToSpend > 0) {
        const principalPayment = roundMoney(Math.min(remainingToSpend, amountRemaining));
        const expectedPrincipalAmount = Math.max(Math.min(amountDueNow, amountRemaining), principalPayment);
        const repaymentStatus = this.repaymentAttemptStatus(principalPayment, expectedPrincipalAmount);
        const reference = `${context.referenceBase}-PKG-${++sequence}`;
        const transaction = await this.createDebtRecoveryTransaction(client, {
          memberId,
          walletId,
          type: 'PACKAGE_SUBSCRIPTION',
          amount: principalPayment,
          reference,
          category: 'admin payment package recovery',
          description: `Debt recovery from approved wallet funding for ${packageName}`,
          metadata: {
            fundingTransactionId: context.fundingTransactionId,
            paymentId: context.paymentId,
            subscriptionId: subscription.id,
            packageName,
            dueAt: dueAt.toISOString(),
            dueCycle: dueKey,
            adminAllocated: true,
            trigger: context.trigger,
            repaymentPhase: 'PACKAGE',
            repaymentStatus,
            expectedAmount: expectedPrincipalAmount,
            paidAmount: principalPayment,
            remainingAmount: Math.max(expectedPrincipalAmount - principalPayment, 0),
          },
          repaymentAttempt: {
            phase: 'PACKAGE',
            targetType: 'PackageSubscription',
            targetId: subscription.id,
            expectedAmount: expectedPrincipalAmount,
            paidAmount: principalPayment,
            remainingAmount: Math.max(expectedPrincipalAmount - principalPayment, 0),
            status: repaymentStatus,
            mode: 'ADMIN',
            dueAt,
            metadata: {
              fundingTransactionId: context.fundingTransactionId,
              paymentId: context.paymentId,
              packageName,
              dueCycle: dueKey,
              trigger: context.trigger,
            },
          },
          actorId: context.actorId,
        });

        await this.allocateRepaymentSchedule(client, 'PackageSubscription', subscription.id, principalPayment, true);
        const scheduleTotals = await this.getScheduleTotals(client, 'PackageSubscription', subscription.id);
        amountRemaining = scheduleTotals.remaining;
        amountPaid = scheduleTotals.paid;
        remainingToSpend = roundMoney(remainingToSpend - principalPayment);
        remainingFunding = roundMoney(remainingFunding - principalPayment);
        settlements.push({
          type: 'PACKAGE_SUBSCRIPTION',
          amount: principalPayment,
          targetId: subscription.id,
          transactionId: transaction.id,
          reference: transaction.reference,
          expectedAmount: expectedPrincipalAmount,
          remainingAmount: Math.max(expectedPrincipalAmount - principalPayment, 0),
          repaymentStatus,
        });
      }

      const subscriptionWasTouched =
        roundMoney(Number(subscription.penaltyAccrued) - penaltyAccrued) > 0 ||
        roundMoney(Number(subscription.amountRemaining) - amountRemaining) > 0;
      if (subscriptionWasTouched) {
        const nextStatus = amountRemaining <= 0 && penaltyAccrued <= 0 ? 'COMPLETED' : 'IN_PROGRESS';
        await client.packageSubscription.update({
          where: { id: subscription.id },
          data: {
            penaltyAccrued,
            amountRemaining,
            amountPaid,
            status: nextStatus,
            completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
            nextDueAt: nextStatus === 'COMPLETED' ? null : await this.nextOpenScheduleDueDate(client, 'PackageSubscription', subscription.id),
          },
        });
      }
    }

    return settlements;
  }

  private async applyLoanDebtRecovery(
    client: any,
    memberId: string,
    walletId: string,
    availableAmount: number,
    context: DebtRecoveryContext,
  ): Promise<SettlementRecord[]> {
    const settlements: SettlementRecord[] = [];
    let remainingFunding = roundMoney(Math.max(availableAmount, 0));
    if (remainingFunding <= 0) {
      return settlements;
    }

    const activeLoans = await client.loanApplication.findMany({
      where: {
        memberId,
        member: { status: 'ACTIVE' },
        status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE'] },
        remainingBalance: { gt: 0 },
      },
      include: { member: { select: { fullName: true, membershipNumber: true } } },
      orderBy: [{ submittedAt: 'asc' }],
    });

    const loanCandidates = [];
    for (const loan of activeLoans as any[]) {
      const remainingBalance = Number(loan.remainingBalance);
      await this.ensureLoanRepaymentSchedule(loan.id, client);
      const principalDue = await this.getScheduleDueAmount(client, 'LoanApplication', loan.id, true);
      const expectedAmount = Math.min(principalDue.amount, remainingBalance);
      if (expectedAmount <= 0) {
        continue;
      }
      loanCandidates.push({
        loan,
        remainingBalance,
        expectedAmount,
        dueAt: principalDue.dueAt ?? loan.nextRepaymentAt ?? loan.dueDate ?? loan.submittedAt ?? new Date(),
      });
    }
    loanCandidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    let sequence = 0;
    for (const candidate of loanCandidates) {
      if (remainingFunding <= 0) {
        break;
      }

      const { loan, remainingBalance, expectedAmount, dueAt } = candidate;
      const amountToApply = roundMoney(Math.min(remainingFunding, expectedAmount));
      if (expectedAmount <= 0 || amountToApply <= 0) {
        continue;
      }

      const dueKey = dueAt.toISOString().slice(0, 10);
      const loanName = loan.purpose || `loan for ${loan.member.fullName}`;
      const repaymentStatus = this.repaymentAttemptStatus(amountToApply, expectedAmount);
      const reference = `${context.referenceBase}-LOAN-${++sequence}`;
      const transaction = await this.createDebtRecoveryTransaction(client, {
        memberId,
        walletId,
        type: 'LOAN_REPAYMENT',
        amount: amountToApply,
        reference,
        category: 'admin payment loan recovery',
        description: `Debt recovery from approved wallet funding for ${loanName}`,
        metadata: {
          fundingTransactionId: context.fundingTransactionId,
          paymentId: context.paymentId,
          loanId: loan.id,
          loanName,
          memberName: loan.member.fullName,
          membershipNumber: loan.member.membershipNumber,
          adminAllocated: true,
          trigger: context.trigger,
          repaymentPhase: 'LOAN',
          repaymentStatus,
          expectedAmount,
          paidAmount: amountToApply,
          remainingAmount: Math.max(expectedAmount - amountToApply, 0),
          dueAt: dueAt.toISOString(),
          dueCycle: dueKey,
        },
        repaymentAttempt: {
          phase: 'LOAN',
          targetType: 'LoanApplication',
          targetId: loan.id,
          expectedAmount,
          paidAmount: amountToApply,
          remainingAmount: Math.max(expectedAmount - amountToApply, 0),
          status: repaymentStatus,
          mode: 'ADMIN',
          dueAt,
          metadata: {
            fundingTransactionId: context.fundingTransactionId,
            paymentId: context.paymentId,
            loanName,
            dueCycle: dueKey,
            trigger: context.trigger,
          },
        },
        actorId: context.actorId,
      });

      await this.allocateRepaymentSchedule(client, 'LoanApplication', loan.id, amountToApply, true);
      const scheduleTotals = await this.getScheduleTotals(client, 'LoanApplication', loan.id);
      const nextRemaining = roundMoney(Math.max(remainingBalance - amountToApply, 0));
      const explicitDisbursedAmount = Number(loan.disbursedAmount ?? 0);
      const disbursedAmount = explicitDisbursedAmount > 0 ? explicitDisbursedAmount : Number(loan.amount);
      const isFullyRepaid = nextRemaining <= 0 && disbursedAmount >= Number(loan.amount);
      await client.loanApplication.update({
        where: { id: loan.id },
        data: {
          remainingBalance: scheduleTotals.remaining,
          status: isFullyRepaid ? 'COMPLETED' : 'IN_PROGRESS',
          nextRepaymentAt: isFullyRepaid ? null : await this.nextOpenScheduleDueDate(client, 'LoanApplication', loan.id),
        },
      });

      remainingFunding = roundMoney(remainingFunding - amountToApply);
      settlements.push({
        type: 'LOAN_REPAYMENT',
        amount: amountToApply,
        targetId: loan.id,
        transactionId: transaction.id,
        reference: transaction.reference,
        expectedAmount,
        remainingAmount: Math.max(expectedAmount - amountToApply, 0),
        repaymentStatus,
      });
    }

    return settlements;
  }

  private async createDebtRecoveryTransaction(
    client: any,
    input: {
      memberId: string;
      walletId: string;
      type: TransactionType;
      amount: number;
      reference: string;
      category: string;
      description: string;
      metadata: Record<string, unknown>;
      repaymentAttempt: RepaymentAttemptOptions;
      actorId?: string;
    },
  ) {
    const transaction = await client.transaction.create({
      data: {
        walletId: input.walletId,
        type: input.type,
        amount: input.amount,
        status: 'APPROVED',
        reference: input.reference,
        category: input.category,
        description: input.description,
        editable: false,
        lockReason: 'Debt recovery transactions are system-generated from approved wallet funding.',
        metadata: input.metadata as any,
      },
    });

    if (this.financialPosting.isAssociationIncomeTransaction(input.type)) {
      await this.financialPosting.postWalletToAssociation(
        {
          memberId: input.memberId,
          amount: input.amount,
          reference: input.reference,
          sourceType: 'Transaction',
          sourceId: transaction.id,
          description: input.description,
          actorId: input.actorId,
          category: input.category,
        },
        client,
      );
    }

    await this.upsertRepaymentAttempt(client, input.memberId, transaction.id, input.reference, input.repaymentAttempt);

    return transaction;
  }

  async settleWeeklyObligations(
    memberId: string,
    options: { recordAttempts?: boolean; trigger?: string } = {},
  ): Promise<SettlementRecord[]> {
    const wallet = await this.getMemberWallet(memberId);
    return this.settleDueWeeklyDeductions(memberId, Number(wallet.availableBalance), options);
  }

  async settlePackageObligations(
    memberId: string,
    options: { recordAttempts?: boolean; trigger?: string } = {},
  ): Promise<SettlementRecord[]> {
    const settlements: SettlementRecord[] = [];
    let refreshedWallet = await this.getMemberWallet(memberId);
    let availableBalance = Number(refreshedWallet.availableBalance);

    const subscriptions = await this.prisma.packageSubscription.findMany({
      where: {
        memberId,
        member: { status: 'ACTIVE' },
        status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] },
        OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
      },
      include: {
        package: true,
        member: { select: { fullName: true, membershipNumber: true } },
      } as any,
      orderBy: { createdAt: 'asc' },
    } as any);

    const packageCandidates = [];
    for (const subscription of subscriptions as any[]) {
      await this.ensurePackageRepaymentSchedule(subscription.id);
      const principalDue = await this.getScheduleDueAmount(this.prisma, 'PackageSubscription', subscription.id, true);
      const amountDueNow = Math.min(principalDue.amount, Number(subscription.amountRemaining));
      const expectedAmount = Math.min(
        Number(subscription.penaltyAccrued) + amountDueNow,
        Number(subscription.penaltyAccrued) + Number(subscription.amountRemaining),
      );

      if (expectedAmount <= 0) {
        continue;
      }
      packageCandidates.push({
        subscription,
        expectedAmount,
        dueAt: principalDue.dueAt ?? subscription.nextDueAt ?? subscription.createdAt ?? new Date(),
      });
    }
    packageCandidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    for (const candidate of packageCandidates) {
      const { subscription, expectedAmount, dueAt } = candidate;
      const amountToSpend = Math.min(Math.max(availableBalance, 0), expectedAmount);

      if (amountToSpend <= 0) {
        if (options.recordAttempts) {
          const dueKey = dueAt.toISOString().slice(0, 10);
          const attemptKey = startOfIsoDay(new Date()).toISOString().slice(0, 10);
          const reference = `AUTO-PACKAGE-ATTEMPT-${subscription.id}-${dueKey}-${attemptKey}`;
          const repaymentStatus = this.repaymentAttemptStatus(0, expectedAmount);
          const result = await this.recordRepaymentAttempt(memberId, 'PACKAGE_SUBSCRIPTION', 0, reference, {
            category: 'automatic package repayment',
            description: `Automatic package repayment attempt for ${subscription.package.name}`,
            editable: false,
            lockReason: 'Package repayment attempts are system-generated and cannot be edited.',
            metadata: {
              subscriptionId: subscription.id,
              packageName: subscription.package.name,
              memberName: subscription.member?.fullName,
              membershipNumber: subscription.member?.membershipNumber,
              dueAt: dueAt.toISOString(),
              dueCycle: dueKey,
              trigger: options.trigger ?? 'CRON',
              autoSettled: true,
              repaymentPhase: 'PACKAGE',
              repaymentStatus,
              expectedAmount,
              paidAmount: 0,
              remainingAmount: expectedAmount,
            },
            repaymentAttempt: {
              phase: 'PACKAGE',
              targetType: 'PackageSubscription',
              targetId: subscription.id,
              expectedAmount,
              paidAmount: 0,
              remainingAmount: expectedAmount,
              status: repaymentStatus,
              mode: 'AUTO',
              dueAt,
              metadata: {
                packageName: subscription.package.name,
                dueCycle: dueKey,
                trigger: options.trigger ?? 'CRON',
              },
            },
          });
          settlements.push({
            type: 'PACKAGE_SUBSCRIPTION',
            amount: 0,
            targetId: result.transaction.id,
            expectedAmount,
            remainingAmount: expectedAmount,
            repaymentStatus,
          });
        }
        continue;
      }

      const applied = await this.applyPackagePayment(memberId, subscription.id, amountToSpend, 'AUTO', {
        expectedAmount,
        trigger: options.trigger,
      });
      settlements.push(...applied.settlements);
      refreshedWallet = applied.wallet;
      availableBalance = Number(refreshedWallet.availableBalance);
    }

    return settlements;
  }

  async settleLoanObligations(
    memberId: string,
    options: { recordAttempts?: boolean; trigger?: string } = {},
  ): Promise<SettlementRecord[]> {
    const settlements: SettlementRecord[] = [];
    let refreshedWallet = await this.getMemberWallet(memberId);
    let availableBalance = Number(refreshedWallet.availableBalance);

    const activeLoans = await this.prisma.loanApplication.findMany({
      where: {
        memberId,
        member: { status: 'ACTIVE' },
        status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE'] },
        remainingBalance: { gt: 0 },
      },
      include: { member: { select: { fullName: true, membershipNumber: true } } },
      orderBy: { submittedAt: 'asc' },
    } as any);

    const loanCandidates = [];
    for (const loan of activeLoans as any[]) {
      const remainingBalance = Number(loan.remainingBalance);
      await this.ensureLoanRepaymentSchedule(loan.id);
      const principalDue = await this.getScheduleDueAmount(this.prisma, 'LoanApplication', loan.id, true);
      const expectedAmount = Math.min(principalDue.amount, remainingBalance);

      if (expectedAmount <= 0) {
        continue;
      }
      loanCandidates.push({
        loan,
        expectedAmount,
        dueAt: principalDue.dueAt ?? (loan as any).nextRepaymentAt ?? loan.dueDate ?? loan.submittedAt ?? new Date(),
      });
    }
    loanCandidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    for (const candidate of loanCandidates) {
      const { loan, expectedAmount, dueAt } = candidate;
      const amountToDebit = Math.min(Math.max(availableBalance, 0), expectedAmount);

      if (amountToDebit <= 0) {
        if (options.recordAttempts) {
          const dueKey = dueAt.toISOString().slice(0, 10);
          const attemptKey = startOfIsoDay(new Date()).toISOString().slice(0, 10);
          const reference = `AUTO-LOAN-ATTEMPT-${loan.id}-${dueKey}-${attemptKey}`;
          const loanName = loan.purpose || `loan for ${loan.member.fullName}`;
          const repaymentStatus = this.repaymentAttemptStatus(0, expectedAmount);
          const result = await this.recordRepaymentAttempt(memberId, 'LOAN_REPAYMENT', 0, reference, {
            category: 'automatic loan repayment',
            description: `Automatic loan repayment attempt for ${loanName}`,
            editable: false,
            lockReason: 'Loan repayment attempts are system-generated and cannot be edited.',
            metadata: {
              loanId: loan.id,
              loanName,
              memberName: loan.member.fullName,
              membershipNumber: loan.member.membershipNumber,
              dueAt: dueAt.toISOString(),
              dueCycle: dueKey,
              trigger: options.trigger ?? 'CRON',
              autoSettled: true,
              repaymentPhase: 'LOAN',
              repaymentStatus,
              expectedAmount,
              paidAmount: 0,
              remainingAmount: expectedAmount,
            },
            repaymentAttempt: {
              phase: 'LOAN',
              targetType: 'LoanApplication',
              targetId: loan.id,
              expectedAmount,
              paidAmount: 0,
              remainingAmount: expectedAmount,
              status: repaymentStatus,
              mode: 'AUTO',
              dueAt,
              metadata: {
                loanName,
                dueCycle: dueKey,
                trigger: options.trigger ?? 'CRON',
              },
            },
          });
          settlements.push({
            type: 'LOAN_REPAYMENT',
            amount: 0,
            targetId: result.transaction.id,
            expectedAmount,
            remainingAmount: expectedAmount,
            repaymentStatus,
          });
        }
        continue;
      }

      const applied = await this.applyLoanRepayment(memberId, loan.id, amountToDebit, 'AUTO', {
        expectedAmount,
        trigger: options.trigger,
      });
      settlements.push(applied.settlement);
      refreshedWallet = applied.wallet;
      availableBalance = Number(refreshedWallet.availableBalance);
    }

    return settlements;
  }

  private async settleDueWeeklyDeductions(
    memberId: string,
    availableBalance: number,
    options: { recordAttempts?: boolean; trigger?: string } = {},
  ): Promise<SettlementRecord[]> {
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
    const amountToDebit = Math.min(Math.max(availableBalance, 0), outstanding);

    if (outstanding <= 0) {
      return [];
    }

    if (amountToDebit <= 0) {
      if (options.recordAttempts) {
        const firstDueAt = dueCycles[0]?.dueDate ?? today;
        const lastDueAt = dueCycles[dueCycles.length - 1]?.dueDate ?? today;
        const dueKey = firstDueAt.toISOString().slice(0, 10);
        const attemptKey = today.toISOString().slice(0, 10);
        const reference = `AUTO-WEEKLY-ATTEMPT-${memberId}-${dueKey}-${attemptKey}`;
        const repaymentStatus = this.repaymentAttemptStatus(0, outstanding);
        const result = await this.recordRepaymentAttempt(memberId, 'WEEKLY_COOPERATIVE', 0, reference, {
          category: 'automatic weekly cooperative',
          description: `Automatic weekly cooperative repayment attempt for ${dueKey}`,
          editable: false,
          lockReason: 'Weekly cooperative repayment attempts are system-generated and cannot be edited.',
          metadata: {
            deductionDate: today.toISOString(),
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            trigger: options.trigger ?? 'CRON',
            autoSettled: true,
            settlementPriority: 'WEEKLY',
            repaymentPhase: 'WEEKLY_DEDUCTION',
            repaymentStatus,
            expectedAmount: outstanding,
            paidAmount: 0,
            remainingAmount: outstanding,
            dueFrom: firstDueAt.toISOString(),
            dueTo: lastDueAt.toISOString(),
            dueCycleIds: dueCycles.map((cycle: any) => cycle.id),
          },
          repaymentAttempt: {
            phase: 'WEEKLY_DEDUCTION',
            targetType: 'WeeklyDeduction',
            targetId: memberId,
            expectedAmount: outstanding,
            paidAmount: 0,
            remainingAmount: outstanding,
            status: repaymentStatus,
            mode: 'AUTO',
            dueAt: firstDueAt,
            metadata: {
              dueFrom: firstDueAt.toISOString(),
              dueTo: lastDueAt.toISOString(),
              dueCycleIds: dueCycles.map((cycle: any) => cycle.id),
              trigger: options.trigger ?? 'CRON',
            },
          },
        });
        return [
          {
            type: 'WEEKLY_COOPERATIVE',
            amount: 0,
            targetId: result.transaction.id,
            expectedAmount: outstanding,
            remainingAmount: outstanding,
            repaymentStatus,
          },
        ];
      }
      return [];
    }

    const runStamp = today.toISOString();
    const reference = `AUTO-WEEKLY-FUNDING-${memberId}-${runStamp.slice(0, 10)}-${Date.now()}`;
    const repaymentStatus = this.repaymentAttemptStatus(amountToDebit, outstanding);
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
        trigger: options.trigger ?? 'SYSTEM',
        repaymentPhase: 'WEEKLY_DEDUCTION',
        repaymentStatus,
        expectedAmount: outstanding,
        paidAmount: amountToDebit,
        remainingAmount: Math.max(outstanding - amountToDebit, 0),
        dueFrom: dueCycles[0]?.dueDate?.toISOString?.() ?? null,
        dueTo: dueCycles[dueCycles.length - 1]?.dueDate?.toISOString?.() ?? null,
        dueCycleIds: dueCycles.map((cycle: any) => cycle.id),
      },
      repaymentAttempt: {
        phase: 'WEEKLY_DEDUCTION',
        targetType: 'WeeklyDeduction',
        targetId: memberId,
        expectedAmount: outstanding,
        paidAmount: amountToDebit,
        remainingAmount: Math.max(outstanding - amountToDebit, 0),
        status: repaymentStatus,
        mode: 'AUTO',
        dueAt: dueCycles[0]?.dueDate ?? today,
        metadata: {
          dueFrom: dueCycles[0]?.dueDate?.toISOString?.() ?? null,
          dueTo: dueCycles[dueCycles.length - 1]?.dueDate?.toISOString?.() ?? null,
          dueCycleIds: dueCycles.map((cycle: any) => cycle.id),
          trigger: options.trigger ?? 'SYSTEM',
        },
      },
    });

    await this.allocateWeeklySettlement(this.prisma, memberId, result.transaction.id, amountToDebit);

    return [
      {
        type: 'WEEKLY_COOPERATIVE',
        amount: amountToDebit,
        targetId: result.transaction.id,
        expectedAmount: outstanding,
        remainingAmount: Math.max(outstanding - amountToDebit, 0),
        repaymentStatus,
      },
    ];
  }

  private repaymentAttemptStatus(paidAmount: number, expectedAmount: number): RepaymentAttemptStatus {
    if (expectedAmount <= 0 || paidAmount >= expectedAmount) {
      return 'COMPLETED';
    }
    return paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
  }

  private async getWeeklyDeductionSettings(client: any = this.prisma) {
    const [amountConfig, dayConfig] = await Promise.all([
      client.systemConfig.findUnique({ where: { key: WEEKLY_DEDUCTION_AMOUNT_KEY } }),
      client.systemConfig.findUnique({ where: { key: WEEKLY_DEDUCTION_DAY_KEY } }),
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
    client: any = this.prisma,
  ) {
    if (settings.amount <= 0) {
      return;
    }

    const lastCycle = await client.weeklyDeductionCycle.findFirst({
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
      await client.weeklyDeductionCycle.createMany({
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
    options: { expectedAmount?: number; trigger?: string } = {},
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

    await this.ensureLoanRepaymentSchedule(loan.id);
    const scheduleDue = await this.getScheduleDueAmount(this.prisma, 'LoanApplication', loan.id, mode === 'AUTO');
    const dueAt = scheduleDue.dueAt ?? (loan as any).nextRepaymentAt ?? loan.dueDate ?? new Date();
    const dueKey = mode === 'AUTO' ? dueAt.toISOString().slice(0, 10) : String(Date.now());
    const referencePrefix = mode === 'AUTO' ? 'AUTO-LOAN' : mode === 'ADMIN' ? 'ADMIN-LOAN' : 'REPAY';
    const loanDisbursedAmount = Number((loan as any).disbursedAmount ?? 0);
    const loanTotalAmount = loanDisbursedAmount > 0 ? loanDisbursedAmount : Number(loan.amount);
    const amountPaidSoFar = Math.max(loanTotalAmount - repayableBalance, 0);
    const reference =
      mode === 'AUTO'
        ? `${referencePrefix}-${loan.id}-${dueKey}-${Math.round(amountPaidSoFar * 100)}`
        : `${referencePrefix}-${loan.id}-${dueKey}`;
    const loanName = loan.purpose || `loan for ${loan.member.fullName}`;
    const expectedAmount = Math.max(options.expectedAmount ?? scheduleDue.amount ?? amount, amount);
    const repaymentStatus = this.repaymentAttemptStatus(amount, expectedAmount);

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
        trigger: options.trigger ?? mode,
        repaymentPhase: 'LOAN',
        repaymentStatus,
        expectedAmount,
        paidAmount: amount,
        remainingAmount: Math.max(expectedAmount - amount, 0),
        dueAt: dueAt.toISOString(),
        dueCycle: dueKey,
      },
      repaymentAttempt: {
        phase: 'LOAN',
        targetType: 'LoanApplication',
        targetId: loan.id,
        expectedAmount,
        paidAmount: amount,
        remainingAmount: Math.max(expectedAmount - amount, 0),
        status: repaymentStatus,
        mode,
        dueAt,
        metadata: {
          loanName,
          dueCycle: dueKey,
          trigger: options.trigger ?? mode,
        },
      },
    });

    await this.allocateRepaymentSchedule(this.prisma, 'LoanApplication', loan.id, amount, mode === 'AUTO');
    const scheduleTotals = await this.getScheduleTotals(this.prisma, 'LoanApplication', loan.id);
    const nextRemaining = scheduleTotals.remaining;
    const explicitDisbursedAmount = Number((loan as any).disbursedAmount ?? 0);
    const disbursedAmount = explicitDisbursedAmount > 0 ? explicitDisbursedAmount : Number(loan.amount);
    const isFullyRepaid = nextRemaining <= 0 && disbursedAmount >= Number(loan.amount);
    await this.prisma.loanApplication.update({
      where: { id: loan.id },
      data: {
        remainingBalance: nextRemaining,
        status: isFullyRepaid ? 'COMPLETED' : 'IN_PROGRESS',
        nextRepaymentAt: isFullyRepaid ? null : await this.nextOpenScheduleDueDate(this.prisma, 'LoanApplication', loan.id),
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
        expectedAmount,
        remainingAmount: Math.max(expectedAmount - amount, 0),
        repaymentStatus,
      },
    };
  }

  async applyPackagePayment(
    memberId: string,
    subscriptionId: string,
    amount: number,
    mode: 'AUTO' | 'ADMIN' | 'MEMBER' = 'MEMBER',
    options: { expectedAmount?: number; trigger?: string } = {},
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
    await this.ensurePackageRepaymentSchedule(subscription.id);
    const scheduleDue = await this.getScheduleDueAmount(this.prisma, 'PackageSubscription', subscription.id, mode === 'AUTO');
    const principalDueAtStart = Math.min(scheduleDue.amount, amountRemaining);
    const dueAt = scheduleDue.dueAt ?? subscription.nextDueAt ?? subscription.createdAt ?? new Date();
    const expectedTotalAmount = Math.max(options.expectedAmount ?? penaltyAccrued + principalDueAtStart, amount);
    const dueKey = mode === 'AUTO' ? dueAt.toISOString().slice(0, 10) : `${Date.now()}`;

    if (penaltyAccrued > 0 && remainingToSpend > 0) {
      const penaltyPayment = Math.min(remainingToSpend, penaltyAccrued);
      const expectedPenaltyAmount = penaltyAccrued;
      const penaltyRepaymentStatus = this.repaymentAttemptStatus(penaltyPayment, expectedPenaltyAmount);
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
              dueAt: dueAt.toISOString(),
              dueCycle: dueKey,
              autoSettled: mode === 'AUTO',
              adminAllocated: mode === 'ADMIN',
              trigger: options.trigger ?? mode,
              repaymentPhase: 'PACKAGE_PENALTY',
              repaymentStatus: penaltyRepaymentStatus,
              expectedAmount: expectedPenaltyAmount,
              paidAmount: penaltyPayment,
              remainingAmount: Math.max(expectedPenaltyAmount - penaltyPayment, 0),
            },
            repaymentAttempt: {
              phase: 'PACKAGE_PENALTY',
              targetType: 'PackageSubscription',
              targetId: subscription.id,
              expectedAmount: expectedPenaltyAmount,
              paidAmount: penaltyPayment,
              remainingAmount: Math.max(expectedPenaltyAmount - penaltyPayment, 0),
              status: penaltyRepaymentStatus,
              mode,
              dueAt,
              metadata: {
                packageName,
                dueCycle: dueKey,
                trigger: options.trigger ?? mode,
              },
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
        settlements.push({
          type: 'PACKAGE_PENALTY',
          amount: penaltyPayment,
          targetId: subscription.id,
          expectedAmount: expectedPenaltyAmount,
          remainingAmount: Math.max(expectedPenaltyAmount - penaltyPayment, 0),
          repaymentStatus: penaltyRepaymentStatus,
        });
      }
    }

    if (amountRemaining > 0 && remainingToSpend > 0) {
      const principalPayment = Math.min(remainingToSpend, amountRemaining);
      const expectedPrincipalAmount = Math.max(Math.min(principalDueAtStart, amountRemaining), principalPayment);
      const principalRepaymentStatus = this.repaymentAttemptStatus(principalPayment, expectedPrincipalAmount);
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
              dueAt: dueAt.toISOString(),
              dueCycle: dueKey,
              autoSettled: mode === 'AUTO',
              adminAllocated: mode === 'ADMIN',
              trigger: options.trigger ?? mode,
              repaymentPhase: 'PACKAGE',
              repaymentStatus: principalRepaymentStatus,
              expectedAmount: expectedPrincipalAmount || expectedTotalAmount,
              paidAmount: principalPayment,
              remainingAmount: Math.max((expectedPrincipalAmount || expectedTotalAmount) - principalPayment, 0),
            },
            repaymentAttempt: {
              phase: 'PACKAGE',
              targetType: 'PackageSubscription',
              targetId: subscription.id,
              expectedAmount: expectedPrincipalAmount || expectedTotalAmount,
              paidAmount: principalPayment,
              remainingAmount: Math.max((expectedPrincipalAmount || expectedTotalAmount) - principalPayment, 0),
              status: principalRepaymentStatus,
              mode,
              dueAt,
              metadata: {
                packageName,
                dueCycle: dueKey,
                trigger: options.trigger ?? mode,
              },
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
        await this.allocateRepaymentSchedule(this.prisma, 'PackageSubscription', subscription.id, principalPayment, mode === 'AUTO');
        const scheduleTotals = await this.getScheduleTotals(this.prisma, 'PackageSubscription', subscription.id);
        amountRemaining = scheduleTotals.remaining;
        amountPaid = scheduleTotals.paid;
        remainingToSpend -= principalPayment;
        settlements.push({
          type: 'PACKAGE_SUBSCRIPTION',
          amount: principalPayment,
          targetId: subscription.id,
          expectedAmount: expectedPrincipalAmount || expectedTotalAmount,
          remainingAmount: Math.max((expectedPrincipalAmount || expectedTotalAmount) - principalPayment, 0),
          repaymentStatus: principalRepaymentStatus,
        });
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
        nextDueAt: nextStatus === 'COMPLETED' ? null : await this.nextOpenScheduleDueDate(this.prisma, 'PackageSubscription', subscription.id),
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
