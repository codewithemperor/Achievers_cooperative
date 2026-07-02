import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { LoanTenorUnit, TransactionType } from '../prisma-types';
import { FinancialPostingService } from './financial-posting.service';
import { normalizeMoney } from '../utils/money';

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
  debtRecoveryPlan?: PreparedFundingDebtRecoveryPlan;
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

type ExposureRecord = {
  phase: string;
  sourceType: string;
  sourceId: string;
  sourceKey: string;
  targetId: string;
  amount: number;
  dueAmount: number;
  dueAt?: Date | null;
};

type ObligationSettlementResult = {
  settlements: SettlementRecord[];
  exposures: ExposureRecord[];
};

type DebtExposureFrame = {
  phase: string;
  sourceType: string;
  sourceId: string;
  sourceKey: string;
  targetId: string;
  dueAmount: number;
  dueAt?: Date | null;
  trigger?: string;
  metadata?: Record<string, unknown>;
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

type WeeklyCycleAllocationPlan = {
  cycleId: string;
  dueDate: Date;
  expectedAmount: number;
  previousPaidAmount: number;
  paidAmount: number;
  nextPaidAmount: number;
  nextStatus: string;
};

type ScheduleAllocationPlan = {
  itemId: string;
  targetType?: RepaymentScheduleTargetType;
  sequence: number;
  dueDate: Date;
  expectedAmount: number;
  previousPaidAmount: number;
  paidAmount: number;
  nextPaidAmount: number;
  nextRemainingAmount: number;
  nextStatus: string;
};

type PreparedWeeklyDebtRecovery = {
  amount: number;
  outstanding: number;
  firstDueAt: Date;
  lastDueAt: Date;
  repaymentStatus: RepaymentAttemptStatus;
  dueCycleIds: string[];
  allocations: WeeklyCycleAllocationPlan[];
  member: {
    fullName?: string | null;
    membershipNumber?: string | null;
  };
};

type PreparedPackageDebtEntry = {
  type: 'PACKAGE_PENALTY' | 'PACKAGE_SUBSCRIPTION';
  subscriptionId: string;
  packageName: string;
  amount: number;
  expectedAmount: number;
  remainingAmount: number;
  dueAt: Date;
  dueKey: string;
  repaymentStatus: RepaymentAttemptStatus;
  scheduleAllocations?: ScheduleAllocationPlan[];
};

type PreparedPackageTargetUpdate = {
  subscriptionId: string;
  previousPenaltyAccrued: number;
  previousAmountRemaining: number;
  previousAmountPaid: number;
  previousStatus: string;
  penaltyAccrued: number;
  amountRemaining: number;
  amountPaid: number;
  status: string;
  completedAt: Date | null;
  nextDueAt: Date | null;
};

type PreparedPendingTransactionDebtEntry = {
  transactionId: string;
  type: TransactionType;
  reference: string | null;
  category: string | null;
  description: string | null;
  amount: number;
  outstanding: number;
  remainingAmount: number;
  repaymentStatus: RepaymentAttemptStatus;
  createdAt: Date;
};

type PreparedLoanDebtEntry = {
  loanId: string;
  loanName: string;
  amount: number;
  expectedAmount: number;
  remainingAmount: number;
  dueAt: Date;
  dueKey: string;
  repaymentStatus: RepaymentAttemptStatus;
  scheduleAllocations: ScheduleAllocationPlan[];
  member: {
    fullName?: string | null;
    membershipNumber?: string | null;
  };
  update: {
    previousRemainingBalance: number;
    previousStatus: string;
    remainingBalance: number;
    status: string;
    nextRepaymentAt: Date | null;
  };
};

type PreparedFundingDebtRecoveryPlan = {
  weekly?: PreparedWeeklyDebtRecovery | null;
  pendingAssociationTransactions: PreparedPendingTransactionDebtEntry[];
  packages: {
    entries: PreparedPackageDebtEntry[];
    updates: PreparedPackageTargetUpdate[];
  };
  loans: PreparedLoanDebtEntry[];
  debtSettlementAmount: number;
  walletCreditAmount: number;
};

const WEEKLY_DEDUCTION_AMOUNT_KEY = 'COOPERATIVE_DEDUCTION_AMOUNT';
const WEEKLY_DEDUCTION_DAY_KEY = 'COOPERATIVE_DEDUCTION_DAY';
const WEEKLY_OPEN_STATUSES = ['OUTSTANDING', 'PARTIAL', 'UPCOMING'];
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONEY_COMPLETION_TOLERANCE = 0.01;
const RECOVERABLE_PENDING_ASSOCIATION_TRANSACTION_TYPES: TransactionType[] = ['MEMBERSHIP_FEE'];

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}

function moneyKey(amount: number) {
  return Math.round(roundMoney(amount) * 100);
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
  return normalizeMoney(amount);
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
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinancialPostingService) private readonly financialPosting: FinancialPostingService,
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
    const normalizedAmount = roundMoney(amount);
    const debtRecoveryPlan = await this.prepareWalletFundingDebtRecovery(memberId, normalizedAmount);
    return this.creditWalletWithDebtRecovery(memberId, normalizedAmount, type, reference, {
      ...options,
      debtRecoveryPlan,
      metadata: {
        ...(options?.metadata ?? {}),
        trigger: options?.metadata?.trigger ?? 'WALLET_CREDIT',
      },
    });
  }

  async creditWalletWithDebtRecovery(
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
    options?: FundingDebtRecoveryOptions,
  ) {
    const normalizedAmount = roundMoney(amount);
    const debtRecoveryPlan =
      options?.debtRecoveryPlan ?? (await this.prepareWalletFundingDebtRecovery(memberId, normalizedAmount));

    return this.prisma.runTransaction(
      'wallet.creditWalletWithDebtRecovery',
      (tx) =>
        this.applyWalletFundingWithDebtRecovery(tx, memberId, normalizedAmount, type, reference, {
          ...options,
          debtRecoveryPlan,
        }),
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
    amount = roundMoney(amount);
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

    const recoveryPlan = options?.debtRecoveryPlan;
    if (!recoveryPlan) {
      throw new BadRequestException('Debt recovery plan must be prepared before applying wallet funding.');
    }
    const recovery = await this.applyPreparedDebtRecovery(
      client,
      memberId,
      wallet.id,
      amount,
      {
        referenceBase: reference ?? `FUND-${fundingTransaction.id}`,
        trigger: String(options?.metadata?.trigger ?? 'PAYMENT_APPROVAL'),
        fundingTransactionId: fundingTransaction.id,
        paymentId: options?.paymentId,
        actorId: options?.actorId,
      },
      recoveryPlan,
    );
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
          exposedDebtAmount: recovery.exposures.reduce((sum, exposure) => sum + exposure.amount, 0),
          exposureCount: recovery.exposures.length,
          exposures: recovery.exposures,
        } as any,
      },
    });

    return {
      wallet: updatedWallet,
      transaction,
      settlements: recovery.settlements,
      exposures: recovery.exposures,
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
    const normalizedAmount = roundMoney(amount);
    if (normalizedAmount <= 0) {
      throw new BadRequestException('Transaction amount must be greater than zero.');
    }
    return this.prisma.runTransaction('wallet.debitWallet', (tx) =>
      this.debitWalletInTransaction(tx, memberId, normalizedAmount, type, reference, options),
    );
  }

  async debitWalletInTransaction(
    client: any,
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
    options?: DebitWalletOptions,
  ) {
    amount = roundMoney(amount);
    if (amount <= 0) {
      throw new BadRequestException('Transaction amount must be greater than zero.');
    }
    const wallet = await this.getMemberWalletWithClient(client, memberId);
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

    const updatedWallet = await client.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { decrement: amount },
        pendingBalance: nextBalance < 0 ? Math.abs(nextBalance) : Number(wallet.pendingBalance),
      },
    });

    const transaction = await client.transaction.create({
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
        client,
      );
    }

    if (options?.repaymentAttempt) {
      await this.upsertRepaymentAttempt(client, memberId, transaction.id, reference, options.repaymentAttempt);
    }

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
    amount = roundMoney(amount);
    if (amount <= 0) {
      throw new BadRequestException('Transaction amount must be greater than zero.');
    }
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

  private weeklyExposureSourceKey(cycleId: string) {
    return `weekly:${cycleId}`;
  }

  private scheduleExposureSourceKey(targetType: RepaymentScheduleTargetType | string, itemId: string) {
    return `${targetType === 'LoanApplication' ? 'loan' : 'package'}:${itemId}`;
  }

  private packagePenaltyExposureSourceKey(subscriptionId: string) {
    return `package-penalty:${subscriptionId}`;
  }

  private openExposureAmount(exposure: any) {
    if (!exposure) return 0;
    return roundMoney(Math.max(Number(exposure.amountExposed ?? 0) - Number(exposure.amountCleared ?? 0), 0));
  }

  private async exposeDebtFrames(
    client: any,
    memberId: string,
    frames: DebtExposureFrame[],
  ): Promise<ExposureRecord[]> {
    const validFrames = frames
      .map((frame) => ({ ...frame, dueAmount: roundMoney(Math.max(Number(frame.dueAmount ?? 0), 0)) }))
      .filter((frame: DebtExposureFrame) => frame.dueAmount > 0);
    if (!validFrames.length) return [];

    const wallet = await this.getMemberWalletWithClient(client, memberId);
    const exposures: ExposureRecord[] = [];

    for (const frame of validFrames) {
      const existing = await (client as any).walletDebtExposure.findUnique({
        where: { sourceKey: frame.sourceKey },
      });
      const openAmount = this.openExposureAmount(existing);
      const newlyExposedAmount = roundMoney(Math.max(frame.dueAmount - openAmount, 0));

      if (newlyExposedAmount <= 0) {
        continue;
      }
      let appliedExposureAmount = newlyExposedAmount;

      const metadata = {
        ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
        ...(frame.metadata ?? {}),
        dueAmount: frame.dueAmount,
        newlyExposedAmount,
      };

      try {
        if (existing) {
          await (client as any).walletDebtExposure.update({
            where: { id: existing.id },
            data: {
              amountExposed: { increment: newlyExposedAmount },
              status: 'OPEN',
              trigger: frame.trigger ?? existing.trigger,
              dueAt: frame.dueAt ?? existing.dueAt,
              clearedAt: null,
              metadata: metadata as any,
            },
          });
        } else {
          await (client as any).walletDebtExposure.create({
            data: {
              memberId,
              walletId: wallet.id,
              phase: frame.phase,
              sourceType: frame.sourceType,
              sourceId: frame.sourceId,
              sourceKey: frame.sourceKey,
              dueAt: frame.dueAt ?? null,
              amountExposed: newlyExposedAmount,
              amountCleared: 0,
              status: 'OPEN',
              trigger: frame.trigger,
              metadata: metadata as any,
            },
          });
        }
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        const retryExisting = await (client as any).walletDebtExposure.findUnique({
          where: { sourceKey: frame.sourceKey },
        });
        if (!retryExisting) {
          throw error;
        }
        const retryOpenAmount = this.openExposureAmount(retryExisting);
        const retryDelta = roundMoney(Math.max(frame.dueAmount - retryOpenAmount, 0));
        if (retryDelta <= 0) {
          continue;
        }
        appliedExposureAmount = retryDelta;
        await (client as any).walletDebtExposure.update({
          where: { id: retryExisting.id },
          data: {
            amountExposed: { increment: retryDelta },
            status: 'OPEN',
            trigger: frame.trigger ?? retryExisting.trigger,
            dueAt: frame.dueAt ?? retryExisting.dueAt,
            clearedAt: null,
            metadata: {
              ...((retryExisting?.metadata as Record<string, unknown> | null) ?? {}),
              ...(frame.metadata ?? {}),
              dueAmount: frame.dueAmount,
              newlyExposedAmount: retryDelta,
            } as any,
          },
        });
      }

      const latestWallet = await client.wallet.findUnique({ where: { id: wallet.id } });
      await client.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: appliedExposureAmount },
          pendingBalance: roundMoney(Number(latestWallet?.pendingBalance ?? 0) + appliedExposureAmount),
        },
      });

      exposures.push({
        phase: frame.phase,
        sourceType: frame.sourceType,
        sourceId: frame.sourceId,
        sourceKey: frame.sourceKey,
        targetId: frame.targetId,
        amount: appliedExposureAmount,
        dueAmount: frame.dueAmount,
        dueAt: frame.dueAt ?? null,
      });
    }

    return exposures;
  }

  private exposeDebtFramesInTransaction(memberId: string, frames: DebtExposureFrame[]) {
    return this.prisma.runTransaction(
      'wallet.exposeDebtFrames',
      (tx) => this.exposeDebtFrames(tx, memberId, frames),
      { maxWait: 5000, timeout: 15000 },
    );
  }

  private async clearDebtExposure(client: any, sourceKey: string, amount: number) {
    const amountToClear = roundMoney(Math.max(amount, 0));
    if (amountToClear <= 0) return 0;

    const exposure = await (client as any).walletDebtExposure.findUnique({
      where: { sourceKey },
    });
    const openAmount = this.openExposureAmount(exposure);
    if (!exposure || openAmount <= 0) {
      return 0;
    }

    const clearedAmount = roundMoney(Math.min(openAmount, amountToClear));
    const nextOpenAmount = roundMoney(openAmount - clearedAmount);

    await (client as any).walletDebtExposure.update({
      where: { id: exposure.id },
      data: {
        amountCleared: { increment: clearedAmount },
        status: nextOpenAmount <= 0 ? 'CLEARED' : 'OPEN',
        clearedAt: nextOpenAmount <= 0 ? new Date() : null,
        metadata: {
          ...((exposure.metadata as Record<string, unknown> | null) ?? {}),
          lastClearedAmount: clearedAmount,
          lastClearedAt: new Date().toISOString(),
        } as any,
      },
    });

    const wallet = await client.wallet.findUnique({ where: { id: exposure.walletId } });
    await client.wallet.update({
      where: { id: exposure.walletId },
      data: {
        availableBalance: { increment: clearedAmount },
        pendingBalance: roundMoney(Math.max(Number(wallet?.pendingBalance ?? 0) - clearedAmount, 0)),
      },
    });

    return clearedAmount;
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

      const updated = await this.prisma.runTransaction('wallet.settlePendingWeeklyDeduction', async (tx) => {
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
      await this.clearDebtExposure(client, this.weeklyExposureSourceKey(cycle.id), allocationAmount);

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
      await this.clearDebtExposure(client, this.scheduleExposureSourceKey(targetType, item.id), payment);

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

  private async exposeDueWeeklyDebt(
    member: { id: string; fullName?: string | null; membershipNumber?: string | null },
    trigger?: string,
  ) {
    const today = startOfIsoDay(new Date());
    const cycles = await (this.prisma as any).weeklyDeductionCycle.findMany({
      where: {
        memberId: member.id,
        dueDate: { lte: today },
        status: { in: WEEKLY_OPEN_STATUSES },
      },
      orderBy: { dueDate: 'asc' },
    });

    const frames = cycles
      .map((cycle: any) => {
        const dueAmount = roundMoney(Math.max(Number(cycle.amount) - Number(cycle.amountPaid), 0));
        return {
          phase: 'WEEKLY_DEDUCTION',
          sourceType: 'WeeklyDeductionCycle',
          sourceId: cycle.id,
          sourceKey: this.weeklyExposureSourceKey(cycle.id),
          targetId: cycle.id,
          dueAmount,
          dueAt: cycle.dueDate,
          trigger: trigger ?? 'CRON',
          metadata: {
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            cycleId: cycle.id,
            expectedAmount: Number(cycle.amount),
            paidAmount: Number(cycle.amountPaid),
            remainingAmount: dueAmount,
            dueAt: cycle.dueDate?.toISOString?.() ?? null,
          },
        } satisfies DebtExposureFrame;
      })
      .filter((frame: DebtExposureFrame) => frame.dueAmount > 0);

    return this.exposeDebtFramesInTransaction(member.id, frames);
  }

  private async exposeDuePackageDebt(memberId: string, subscriptionId: string, trigger?: string) {
    const subscription = (await this.prisma.packageSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        package: true,
        member: { select: { fullName: true, membershipNumber: true } },
      } as any,
    } as any)) as any;
    if (!subscription || subscription.memberId !== memberId) {
      return [];
    }

    await this.ensurePackageRepaymentSchedule(subscription.id);
    const scheduleDue = await this.getScheduleDueAmount(this.prisma, 'PackageSubscription', subscription.id, true);
    const packageName = subscription.package?.name ?? 'package';
    const frames: DebtExposureFrame[] = [];
    const penaltyAccrued = roundMoney(Math.max(Number(subscription.penaltyAccrued ?? 0), 0));
    const penaltyDueAt = scheduleDue.dueAt ?? subscription.nextDueAt ?? subscription.createdAt ?? new Date();

    if (penaltyAccrued > 0) {
      frames.push({
        phase: 'PACKAGE_PENALTY',
        sourceType: 'PackageSubscriptionPenalty',
        sourceId: subscription.id,
        sourceKey: this.packagePenaltyExposureSourceKey(subscription.id),
        targetId: subscription.id,
        dueAmount: penaltyAccrued,
        dueAt: penaltyDueAt,
        trigger: trigger ?? 'CRON',
        metadata: {
          subscriptionId: subscription.id,
          packageName,
          memberName: subscription.member?.fullName,
          membershipNumber: subscription.member?.membershipNumber,
          remainingAmount: penaltyAccrued,
          dueAt: penaltyDueAt?.toISOString?.() ?? null,
        },
      });
    }

    let amountRemainingCap = roundMoney(Math.max(Number(subscription.amountRemaining ?? 0), 0));
    for (const item of scheduleDue.items) {
      if (amountRemainingCap <= 0) break;
      const dueAmount = roundMoney(Math.min(Number(item.remainingAmount), amountRemainingCap));
      if (dueAmount <= 0) continue;
      frames.push({
        phase: 'PACKAGE',
        sourceType: 'RepaymentScheduleItem',
        sourceId: item.id,
        sourceKey: this.scheduleExposureSourceKey('PackageSubscription', item.id),
        targetId: subscription.id,
        dueAmount,
        dueAt: item.dueDate,
        trigger: trigger ?? 'CRON',
        metadata: {
          subscriptionId: subscription.id,
          packageName,
          sequence: item.sequence,
          memberName: subscription.member?.fullName,
          membershipNumber: subscription.member?.membershipNumber,
          expectedAmount: Number(item.expectedAmount),
          paidAmount: Number(item.paidAmount),
          remainingAmount: dueAmount,
          dueAt: item.dueDate?.toISOString?.() ?? null,
        },
      });
      amountRemainingCap = roundMoney(amountRemainingCap - dueAmount);
    }

    return this.exposeDebtFramesInTransaction(memberId, frames);
  }

  private async exposeDueLoanDebt(memberId: string, loanId: string, trigger?: string) {
    const loan = (await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      include: { member: { select: { fullName: true, membershipNumber: true } } },
    } as any)) as any;
    if (!loan || loan.memberId !== memberId) {
      return [];
    }

    await this.ensureLoanRepaymentSchedule(loan.id);
    const scheduleDue = await this.getScheduleDueAmount(this.prisma, 'LoanApplication', loan.id, true);
    const loanName = loan.purpose || `loan for ${loan.member?.fullName ?? 'member'}`;
    const frames: DebtExposureFrame[] = [];
    let remainingBalanceCap = roundMoney(Math.max(Number(loan.remainingBalance ?? 0), 0));

    for (const item of scheduleDue.items) {
      if (remainingBalanceCap <= 0) break;
      const dueAmount = roundMoney(Math.min(Number(item.remainingAmount), remainingBalanceCap));
      if (dueAmount <= 0) continue;
      frames.push({
        phase: 'LOAN',
        sourceType: 'RepaymentScheduleItem',
        sourceId: item.id,
        sourceKey: this.scheduleExposureSourceKey('LoanApplication', item.id),
        targetId: loan.id,
        dueAmount,
        dueAt: item.dueDate,
        trigger: trigger ?? 'CRON',
        metadata: {
          loanId: loan.id,
          loanName,
          sequence: item.sequence,
          memberName: loan.member?.fullName,
          membershipNumber: loan.member?.membershipNumber,
          expectedAmount: Number(item.expectedAmount),
          paidAmount: Number(item.paidAmount),
          remainingAmount: dueAmount,
          dueAt: item.dueDate?.toISOString?.() ?? null,
        },
      });
      remainingBalanceCap = roundMoney(remainingBalanceCap - dueAmount);
    }

    return this.exposeDebtFramesInTransaction(memberId, frames);
  }

  private async collectDueDebtExposureFrames(
    client: any,
    memberId: string,
    trigger?: string,
  ): Promise<DebtExposureFrame[]> {
    const member = await client.member.findUnique({
      where: { id: memberId },
      select: { id: true, fullName: true, membershipNumber: true, status: true },
    });
    if (!member || member.status !== 'ACTIVE') {
      return [];
    }

    const today = startOfIsoDay(new Date());
    const dueBefore = addDays(today, 1);
    const frames: DebtExposureFrame[] = [];

    const weeklyCycles = await (client as any).weeklyDeductionCycle.findMany({
      where: {
        memberId,
        dueDate: { lte: today },
        status: { in: WEEKLY_OPEN_STATUSES },
      },
      orderBy: { dueDate: 'asc' },
    });
    for (const cycle of weeklyCycles) {
      const dueAmount = roundMoney(Math.max(Number(cycle.amount) - Number(cycle.amountPaid), 0));
      if (dueAmount <= 0) continue;
      frames.push({
        phase: 'WEEKLY_DEDUCTION',
        sourceType: 'WeeklyDeductionCycle',
        sourceId: cycle.id,
        sourceKey: this.weeklyExposureSourceKey(cycle.id),
        targetId: cycle.id,
        dueAmount,
        dueAt: cycle.dueDate,
        trigger: trigger ?? 'CRON',
        metadata: {
          memberName: member.fullName,
          membershipNumber: member.membershipNumber,
          cycleId: cycle.id,
          expectedAmount: Number(cycle.amount),
          paidAmount: Number(cycle.amountPaid),
          remainingAmount: dueAmount,
          dueAt: cycle.dueDate?.toISOString?.() ?? null,
        },
      });
    }

    const packageSubscriptions = await client.packageSubscription.findMany({
      where: {
        memberId,
        status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] },
        OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
      },
      include: { package: true },
      orderBy: { createdAt: 'asc' },
    } as any);
    const packageItems = await (client as any).repaymentScheduleItem.findMany({
      where: {
        memberId,
        targetType: 'PackageSubscription',
        dueDate: { lt: dueBefore },
        remainingAmount: { gt: 0 },
      },
      orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
    });
    const packageItemsByTarget = new Map<string, any[]>();
    for (const item of packageItems) {
      packageItemsByTarget.set(item.targetId, [...(packageItemsByTarget.get(item.targetId) ?? []), item]);
    }

    for (const subscription of packageSubscriptions as any[]) {
      const packageName = subscription.package?.name ?? 'package';
      const dueItems = packageItemsByTarget.get(subscription.id) ?? [];
      const penaltyAccrued = roundMoney(Math.max(Number(subscription.penaltyAccrued ?? 0), 0));
      const firstDueAt = dueItems[0]?.dueDate ?? subscription.nextDueAt ?? subscription.createdAt ?? new Date();

      if (penaltyAccrued > 0) {
        frames.push({
          phase: 'PACKAGE_PENALTY',
          sourceType: 'PackageSubscriptionPenalty',
          sourceId: subscription.id,
          sourceKey: this.packagePenaltyExposureSourceKey(subscription.id),
          targetId: subscription.id,
          dueAmount: penaltyAccrued,
          dueAt: firstDueAt,
          trigger: trigger ?? 'CRON',
          metadata: {
            subscriptionId: subscription.id,
            packageName,
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            remainingAmount: penaltyAccrued,
            dueAt: firstDueAt?.toISOString?.() ?? null,
          },
        });
      }

      let amountRemainingCap = roundMoney(Math.max(Number(subscription.amountRemaining ?? 0), 0));
      for (const item of dueItems) {
        if (amountRemainingCap <= 0) break;
        const dueAmount = roundMoney(Math.min(Number(item.remainingAmount), amountRemainingCap));
        if (dueAmount <= 0) continue;
        frames.push({
          phase: 'PACKAGE',
          sourceType: 'RepaymentScheduleItem',
          sourceId: item.id,
          sourceKey: this.scheduleExposureSourceKey('PackageSubscription', item.id),
          targetId: subscription.id,
          dueAmount,
          dueAt: item.dueDate,
          trigger: trigger ?? 'CRON',
          metadata: {
            subscriptionId: subscription.id,
            packageName,
            sequence: item.sequence,
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            expectedAmount: Number(item.expectedAmount),
            paidAmount: Number(item.paidAmount),
            remainingAmount: dueAmount,
            dueAt: item.dueDate?.toISOString?.() ?? null,
          },
        });
        amountRemainingCap = roundMoney(amountRemainingCap - dueAmount);
      }
    }

    const loans = await client.loanApplication.findMany({
      where: {
        memberId,
        status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE'] },
        remainingBalance: { gt: 0 },
      },
      orderBy: { submittedAt: 'asc' },
    } as any);
    const loanItems = await (client as any).repaymentScheduleItem.findMany({
      where: {
        memberId,
        targetType: 'LoanApplication',
        dueDate: { lt: dueBefore },
        remainingAmount: { gt: 0 },
      },
      orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
    });
    const loanItemsByTarget = new Map<string, any[]>();
    for (const item of loanItems) {
      loanItemsByTarget.set(item.targetId, [...(loanItemsByTarget.get(item.targetId) ?? []), item]);
    }

    for (const loan of loans as any[]) {
      const dueItems = loanItemsByTarget.get(loan.id) ?? [];
      const loanName = loan.purpose || `loan for ${member.fullName}`;
      let remainingBalanceCap = roundMoney(Math.max(Number(loan.remainingBalance ?? 0), 0));
      for (const item of dueItems) {
        if (remainingBalanceCap <= 0) break;
        const dueAmount = roundMoney(Math.min(Number(item.remainingAmount), remainingBalanceCap));
        if (dueAmount <= 0) continue;
        frames.push({
          phase: 'LOAN',
          sourceType: 'RepaymentScheduleItem',
          sourceId: item.id,
          sourceKey: this.scheduleExposureSourceKey('LoanApplication', item.id),
          targetId: loan.id,
          dueAmount,
          dueAt: item.dueDate,
          trigger: trigger ?? 'CRON',
          metadata: {
            loanId: loan.id,
            loanName,
            sequence: item.sequence,
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            expectedAmount: Number(item.expectedAmount),
            paidAmount: Number(item.paidAmount),
            remainingAmount: dueAmount,
            dueAt: item.dueDate?.toISOString?.() ?? null,
          },
        });
        remainingBalanceCap = roundMoney(remainingBalanceCap - dueAmount);
      }
    }

    return frames.filter((frame) => frame.dueAmount > 0);
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

  async prepareWalletFundingDebtRecovery(
    memberId: string,
    fundingAmount: number,
  ): Promise<PreparedFundingDebtRecoveryPlan> {
    fundingAmount = roundMoney(fundingAmount);
    let remainingFunding = roundMoney(Math.max(fundingAmount, 0));
    const plan: PreparedFundingDebtRecoveryPlan = {
      weekly: null,
      pendingAssociationTransactions: [],
      packages: { entries: [], updates: [] },
      loans: [],
      debtSettlementAmount: 0,
      walletCreditAmount: remainingFunding,
    };

    const weekly = await this.prepareWeeklyDebtRecovery(memberId, remainingFunding);
    if (weekly) {
      plan.weekly = weekly;
      remainingFunding = roundMoney(remainingFunding - weekly.amount);
    }

    if (remainingFunding > 0) {
      plan.pendingAssociationTransactions = await this.preparePendingAssociationTransactionRecovery(memberId, remainingFunding);
      const pendingAssociationTotal = plan.pendingAssociationTransactions.reduce((sum, entry) => sum + entry.amount, 0);
      remainingFunding = roundMoney(remainingFunding - pendingAssociationTotal);
    }

    if (remainingFunding > 0) {
      plan.packages = await this.preparePackageDebtRecovery(memberId, remainingFunding);
      const packageTotal = plan.packages.entries.reduce((sum, entry) => sum + entry.amount, 0);
      remainingFunding = roundMoney(remainingFunding - packageTotal);
    }

    if (remainingFunding > 0) {
      plan.loans = await this.prepareLoanDebtRecovery(memberId, remainingFunding);
      const loanTotal = plan.loans.reduce((sum, entry) => sum + entry.amount, 0);
      remainingFunding = roundMoney(remainingFunding - loanTotal);
    }

    plan.walletCreditAmount = roundMoney(Math.max(remainingFunding, 0));
    plan.debtSettlementAmount = roundMoney(Math.max(fundingAmount - plan.walletCreditAmount, 0));

    return plan;
  }

  private async preparePendingAssociationTransactionRecovery(memberId: string, availableAmount: number) {
    let remainingFunding = roundMoney(Math.max(availableAmount, 0));
    const entries: PreparedPendingTransactionDebtEntry[] = [];
    if (remainingFunding <= 0) {
      return entries;
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { memberId } });
    if (!wallet) {
      return entries;
    }

    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        type: { in: RECOVERABLE_PENDING_ASSOCIATION_TRANSACTION_TYPES as any },
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const transaction of pendingTransactions) {
      if (remainingFunding <= 0) {
        break;
      }

      const metadata = (transaction.metadata as Record<string, unknown> | null) ?? {};
      const rawOutstanding = metadata.outstandingAmount;
      const outstanding = roundMoney(
        typeof rawOutstanding === 'number' ? rawOutstanding : Math.max(Number(transaction.amount), 0),
      );
      const amount = roundMoney(Math.min(remainingFunding, outstanding));
      if (amount <= 0 || outstanding <= 0) {
        continue;
      }

      entries.push({
        transactionId: transaction.id,
        type: transaction.type,
        reference: transaction.reference,
        category: transaction.category,
        description: transaction.description,
        amount,
        outstanding,
        remainingAmount: roundMoney(Math.max(outstanding - amount, 0)),
        repaymentStatus: this.repaymentAttemptStatus(amount, outstanding),
        createdAt: transaction.createdAt,
      });
      remainingFunding = roundMoney(remainingFunding - amount);
    }

    return entries;
  }

  private async prepareWeeklyDebtRecovery(memberId: string, availableAmount: number) {
    if (availableAmount <= 0) {
      return null;
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
      return null;
    }

    const settings = await this.getWeeklyDeductionSettings();
    if (settings.amount <= 0) {
      return null;
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
    const outstanding = roundMoney(
      dueCycles.reduce((sum: number, cycle: any) => sum + Math.max(Number(cycle.amount) - Number(cycle.amountPaid), 0), 0),
    );
    const amountToApply = roundMoney(Math.min(Math.max(availableAmount, 0), outstanding));

    if (outstanding <= 0 || amountToApply <= 0) {
      return null;
    }

    const allocations = this.buildWeeklyAllocationPlan(dueCycles, amountToApply);
    const firstDueAt = dueCycles[0]?.dueDate ?? today;
    const lastDueAt = dueCycles[dueCycles.length - 1]?.dueDate ?? today;

    return {
      amount: amountToApply,
      outstanding,
      firstDueAt,
      lastDueAt,
      repaymentStatus: this.repaymentAttemptStatus(amountToApply, outstanding),
      dueCycleIds: dueCycles.map((cycle: any) => cycle.id),
      allocations,
      member: {
        fullName: member.fullName,
        membershipNumber: member.membershipNumber,
      },
    } satisfies PreparedWeeklyDebtRecovery;
  }

  private async preparePackageDebtRecovery(memberId: string, availableAmount: number) {
    const entries: PreparedPackageDebtEntry[] = [];
    const updates: PreparedPackageTargetUpdate[] = [];
    let remainingFunding = roundMoney(Math.max(availableAmount, 0));
    if (remainingFunding <= 0) {
      return { entries, updates };
    }

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
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const candidates = [];
    for (const subscription of subscriptions as any[]) {
      const scheduleItems = await this.ensurePackageRepaymentSchedule(subscription.id);
      const principalDue = this.getScheduleDueAmountFromItems(scheduleItems, true);
      const amountDueNow = Math.min(principalDue.amount, Number(subscription.amountRemaining));
      const expectedAmount = Math.min(
        Number(subscription.penaltyAccrued) + amountDueNow,
        Number(subscription.penaltyAccrued) + Number(subscription.amountRemaining),
      );
      if (expectedAmount <= 0) {
        continue;
      }

      candidates.push({
        subscription,
        scheduleItems,
        amountDueNow,
        expectedAmount,
        dueAt: principalDue.dueAt ?? subscription.nextDueAt ?? subscription.createdAt ?? new Date(),
        dueItems: principalDue.items,
      });
    }
    candidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    for (const candidate of candidates) {
      if (remainingFunding <= 0) {
        break;
      }

      const { subscription, scheduleItems, amountDueNow, expectedAmount, dueAt, dueItems } = candidate;
      let remainingToSpend = roundMoney(Math.min(remainingFunding, expectedAmount));
      let penaltyAccrued = Number(subscription.penaltyAccrued);
      let amountRemaining = Number(subscription.amountRemaining);
      let amountPaid = Number(subscription.amountPaid);
      const packageName = subscription.package.name;
      const dueKey = dueAt.toISOString().slice(0, 10);
      const allocationsForTarget: ScheduleAllocationPlan[] = [];

      if (penaltyAccrued > 0 && remainingToSpend > 0) {
        const penaltyPayment = roundMoney(Math.min(remainingToSpend, penaltyAccrued));
        const expectedPenaltyAmount = penaltyAccrued;
        penaltyAccrued = roundMoney(penaltyAccrued - penaltyPayment);
        remainingToSpend = roundMoney(remainingToSpend - penaltyPayment);
        remainingFunding = roundMoney(remainingFunding - penaltyPayment);

        entries.push({
          type: 'PACKAGE_PENALTY',
          subscriptionId: subscription.id,
          packageName,
          amount: penaltyPayment,
          expectedAmount: expectedPenaltyAmount,
          remainingAmount: roundMoney(Math.max(expectedPenaltyAmount - penaltyPayment, 0)),
          dueAt,
          dueKey,
          repaymentStatus: this.repaymentAttemptStatus(penaltyPayment, expectedPenaltyAmount),
        });
      }

      if (amountRemaining > 0 && remainingToSpend > 0) {
        const principalPayment = roundMoney(Math.min(remainingToSpend, amountRemaining));
        const expectedPrincipalAmount = Math.max(Math.min(amountDueNow, amountRemaining), principalPayment);
        const allocationPlan = this.buildScheduleAllocationPlan(dueItems, principalPayment);
        allocationsForTarget.push(...allocationPlan.allocations);

        const totals = this.getScheduleTotalsAfterAllocations(scheduleItems, allocationsForTarget);
        amountRemaining = totals.remaining;
        amountPaid = totals.paid;
        remainingToSpend = roundMoney(remainingToSpend - principalPayment);
        remainingFunding = roundMoney(remainingFunding - principalPayment);

        entries.push({
          type: 'PACKAGE_SUBSCRIPTION',
          subscriptionId: subscription.id,
          packageName,
          amount: principalPayment,
          expectedAmount: expectedPrincipalAmount,
          remainingAmount: roundMoney(Math.max(expectedPrincipalAmount - principalPayment, 0)),
          dueAt,
          dueKey,
          repaymentStatus: this.repaymentAttemptStatus(principalPayment, expectedPrincipalAmount),
          scheduleAllocations: allocationPlan.allocations,
        });
      }

      const subscriptionWasTouched =
        roundMoney(Number(subscription.penaltyAccrued) - penaltyAccrued) > 0 ||
        roundMoney(Number(subscription.amountRemaining) - amountRemaining) > 0;
      if (subscriptionWasTouched) {
        const totals = this.getScheduleTotalsAfterAllocations(scheduleItems, allocationsForTarget);
        const nextStatus = amountRemaining <= 0 && penaltyAccrued <= 0 ? 'COMPLETED' : 'IN_PROGRESS';
        updates.push({
          subscriptionId: subscription.id,
          previousPenaltyAccrued: Number(subscription.penaltyAccrued),
          previousAmountRemaining: Number(subscription.amountRemaining),
          previousAmountPaid: Number(subscription.amountPaid),
          previousStatus: subscription.status,
          penaltyAccrued,
          amountRemaining,
          amountPaid,
          status: nextStatus,
          completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
          nextDueAt: nextStatus === 'COMPLETED' ? null : totals.nextDueAt,
        });
      }
    }

    return { entries, updates };
  }

  private async prepareLoanDebtRecovery(memberId: string, availableAmount: number) {
    const entries: PreparedLoanDebtEntry[] = [];
    let remainingFunding = roundMoney(Math.max(availableAmount, 0));
    if (remainingFunding <= 0) {
      return entries;
    }

    const activeLoans = await this.prisma.loanApplication.findMany({
      where: {
        memberId,
        member: { status: 'ACTIVE' },
        status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE'] },
        remainingBalance: { gt: 0 },
      },
      include: { member: { select: { fullName: true, membershipNumber: true } } },
      orderBy: [{ submittedAt: 'asc' }],
    });

    const candidates = [];
    for (const loan of activeLoans as any[]) {
      const remainingBalance = Number(loan.remainingBalance);
      const scheduleItems = await this.ensureLoanRepaymentSchedule(loan.id);
      const principalDue = this.getScheduleDueAmountFromItems(scheduleItems, true);
      const expectedAmount = Math.min(principalDue.amount, remainingBalance);
      if (expectedAmount <= 0) {
        continue;
      }

      candidates.push({
        loan,
        scheduleItems,
        expectedAmount,
        dueAt: principalDue.dueAt ?? loan.nextRepaymentAt ?? loan.dueDate ?? loan.submittedAt ?? new Date(),
        dueItems: principalDue.items,
      });
    }
    candidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    for (const candidate of candidates) {
      if (remainingFunding <= 0) {
        break;
      }

      const { loan, scheduleItems, expectedAmount, dueAt, dueItems } = candidate;
      const amountToApply = roundMoney(Math.min(remainingFunding, expectedAmount));
      if (expectedAmount <= 0 || amountToApply <= 0) {
        continue;
      }

      const allocationPlan = this.buildScheduleAllocationPlan(dueItems, amountToApply);
      const totals = this.getScheduleTotalsAfterAllocations(scheduleItems, allocationPlan.allocations);
      const nextRemainingBalance = roundMoney(Math.max(totals.remaining, 0));
      const isFullyRepaid = nextRemainingBalance <= MONEY_COMPLETION_TOLERANCE;
      const dueKey = dueAt.toISOString().slice(0, 10);
      const loanName = loan.purpose || `loan for ${loan.member.fullName}`;

      entries.push({
        loanId: loan.id,
        loanName,
        amount: amountToApply,
        expectedAmount,
        remainingAmount: roundMoney(Math.max(expectedAmount - amountToApply, 0)),
        dueAt,
        dueKey,
        repaymentStatus: this.repaymentAttemptStatus(amountToApply, expectedAmount),
        scheduleAllocations: allocationPlan.allocations,
        member: {
          fullName: loan.member.fullName,
          membershipNumber: loan.member.membershipNumber,
        },
        update: {
          previousRemainingBalance: Number(loan.remainingBalance),
          previousStatus: loan.status,
          remainingBalance: isFullyRepaid ? 0 : nextRemainingBalance,
          status: isFullyRepaid ? 'COMPLETED' : 'IN_PROGRESS',
          nextRepaymentAt: isFullyRepaid ? null : totals.nextDueAt,
        },
      });

      remainingFunding = roundMoney(remainingFunding - amountToApply);
    }

    return entries;
  }

  private async applyPreparedDebtRecovery(
    client: any,
    memberId: string,
    walletId: string,
    fundingAmount: number,
    context: DebtRecoveryContext,
    plan: PreparedFundingDebtRecoveryPlan,
  ) {
    const settlements: SettlementRecord[] = [];

    if (plan.weekly?.amount) {
      const weekly = plan.weekly;
      const reference = `${context.referenceBase}-WEEKLY`;
      const transaction = await this.createDebtRecoveryTransaction(client, {
        memberId,
        walletId,
        type: 'WEEKLY_COOPERATIVE',
        amount: weekly.amount,
        reference,
        category: 'admin payment debt recovery',
        description: 'Debt recovery from approved wallet funding for weekly deductions',
        metadata: {
          fundingTransactionId: context.fundingTransactionId,
          paymentId: context.paymentId,
          deductionDate: startOfIsoDay(new Date()).toISOString(),
          memberName: weekly.member.fullName,
          membershipNumber: weekly.member.membershipNumber,
          trigger: context.trigger,
          adminAllocated: true,
          settlementPriority: 'WEEKLY',
          repaymentPhase: 'WEEKLY_DEDUCTION',
          repaymentStatus: weekly.repaymentStatus,
          expectedAmount: weekly.outstanding,
          paidAmount: weekly.amount,
          remainingAmount: roundMoney(Math.max(weekly.outstanding - weekly.amount, 0)),
          dueFrom: weekly.firstDueAt.toISOString(),
          dueTo: weekly.lastDueAt.toISOString(),
          dueCycleIds: weekly.dueCycleIds,
        },
        repaymentAttempt: {
          phase: 'WEEKLY_DEDUCTION',
          targetType: 'WeeklyDeduction',
          targetId: memberId,
          expectedAmount: weekly.outstanding,
          paidAmount: weekly.amount,
          remainingAmount: roundMoney(Math.max(weekly.outstanding - weekly.amount, 0)),
          status: weekly.repaymentStatus,
          mode: 'ADMIN',
          dueAt: weekly.firstDueAt,
          metadata: {
            fundingTransactionId: context.fundingTransactionId,
            paymentId: context.paymentId,
            dueFrom: weekly.firstDueAt.toISOString(),
            dueTo: weekly.lastDueAt.toISOString(),
            dueCycleIds: weekly.dueCycleIds,
            trigger: context.trigger,
          },
        },
        actorId: context.actorId,
      });

      await this.applyWeeklyAllocationPlan(client, memberId, transaction.id, weekly);
      settlements.push({
        type: 'WEEKLY_COOPERATIVE',
        amount: weekly.amount,
        targetId: transaction.id,
        transactionId: transaction.id,
        reference: transaction.reference,
        expectedAmount: weekly.outstanding,
        remainingAmount: roundMoney(Math.max(weekly.outstanding - weekly.amount, 0)),
        repaymentStatus: weekly.repaymentStatus,
      });
    }

    let pendingAssociationSequence = 0;
    for (const entry of plan.pendingAssociationTransactions) {
      const reference = context.referenceBase + '-PENDING-' + ++pendingAssociationSequence;
      const nextOutstanding = entry.remainingAmount;
      const updatedTransaction = await client.transaction.update({
        where: { id: entry.transactionId },
        data: {
          status: nextOutstanding <= 0 ? 'APPROVED' : 'PENDING',
          metadata: {
            outstandingAmount: nextOutstanding,
            recoveredAmount: entry.amount,
            recoveredFromFundingTransactionId: context.fundingTransactionId,
            recoveredAt: new Date().toISOString(),
          } as any,
        },
      });

      await client.wallet.update({
        where: { id: walletId },
        data: {
          availableBalance: { increment: entry.amount },
          pendingBalance: { decrement: entry.amount },
        },
      });

      await this.financialPosting.postWalletToAssociation(
        {
          memberId,
          amount: entry.amount,
          reference,
          sourceType: 'Transaction',
          sourceId: entry.transactionId,
          description: entry.description || 'Settled pending association fee',
          actorId: context.actorId,
          category: entry.category,
        },
        client,
      );

      await this.upsertRepaymentAttempt(client, memberId, entry.transactionId, reference, {
        phase: entry.type,
        targetType: 'Transaction',
        targetId: entry.transactionId,
        expectedAmount: entry.outstanding,
        paidAmount: entry.amount,
        remainingAmount: entry.remainingAmount,
        status: entry.repaymentStatus,
        mode: 'ADMIN',
        dueAt: entry.createdAt,
        metadata: {
          fundingTransactionId: context.fundingTransactionId,
          paymentId: context.paymentId,
          trigger: context.trigger,
          sourceTransactionId: updatedTransaction.id,
        },
      });

      settlements.push({
        type: entry.type,
        amount: entry.amount,
        targetId: entry.transactionId,
        transactionId: entry.transactionId,
        reference,
        expectedAmount: entry.outstanding,
        remainingAmount: entry.remainingAmount,
        repaymentStatus: entry.repaymentStatus,
      });
    }

    let packageSequence = 0;
    for (const entry of plan.packages.entries) {
      const reference =
        entry.type === 'PACKAGE_PENALTY'
          ? `${context.referenceBase}-PKG-PEN-${++packageSequence}`
          : `${context.referenceBase}-PKG-${++packageSequence}`;
      const transaction = await this.createDebtRecoveryTransaction(client, {
        memberId,
        walletId,
        type: entry.type,
        amount: entry.amount,
        reference,
        category:
          entry.type === 'PACKAGE_PENALTY'
            ? 'admin payment package penalty recovery'
            : 'admin payment package recovery',
        description:
          entry.type === 'PACKAGE_PENALTY'
            ? `Debt recovery from approved wallet funding for ${entry.packageName} penalty`
            : `Debt recovery from approved wallet funding for ${entry.packageName}`,
        metadata: {
          fundingTransactionId: context.fundingTransactionId,
          paymentId: context.paymentId,
          subscriptionId: entry.subscriptionId,
          packageName: entry.packageName,
          dueAt: entry.dueAt.toISOString(),
          dueCycle: entry.dueKey,
          adminAllocated: true,
          trigger: context.trigger,
          repaymentPhase: entry.type === 'PACKAGE_PENALTY' ? 'PACKAGE_PENALTY' : 'PACKAGE',
          repaymentStatus: entry.repaymentStatus,
          expectedAmount: entry.expectedAmount,
          paidAmount: entry.amount,
          remainingAmount: entry.remainingAmount,
        },
        repaymentAttempt: {
          phase: entry.type === 'PACKAGE_PENALTY' ? 'PACKAGE_PENALTY' : 'PACKAGE',
          targetType: 'PackageSubscription',
          targetId: entry.subscriptionId,
          expectedAmount: entry.expectedAmount,
          paidAmount: entry.amount,
          remainingAmount: entry.remainingAmount,
          status: entry.repaymentStatus,
          mode: 'ADMIN',
          dueAt: entry.dueAt,
          metadata: {
            fundingTransactionId: context.fundingTransactionId,
            paymentId: context.paymentId,
            packageName: entry.packageName,
            dueCycle: entry.dueKey,
            trigger: context.trigger,
          },
        },
        actorId: context.actorId,
      });

      if (entry.type === 'PACKAGE_SUBSCRIPTION' && entry.scheduleAllocations?.length) {
        await this.applyScheduleAllocationPlan(client, entry.scheduleAllocations);
      } else if (entry.type === 'PACKAGE_PENALTY') {
        await this.clearDebtExposure(client, this.packagePenaltyExposureSourceKey(entry.subscriptionId), entry.amount);
      }

      settlements.push({
        type: entry.type,
        amount: entry.amount,
        targetId: entry.subscriptionId,
        transactionId: transaction.id,
        reference: transaction.reference,
        expectedAmount: entry.expectedAmount,
        remainingAmount: entry.remainingAmount,
        repaymentStatus: entry.repaymentStatus,
      });
    }

    for (const update of plan.packages.updates) {
      const result = await client.packageSubscription.updateMany({
        where: {
          id: update.subscriptionId,
          penaltyAccrued: update.previousPenaltyAccrued,
          amountRemaining: update.previousAmountRemaining,
          amountPaid: update.previousAmountPaid,
          status: update.previousStatus,
        },
        data: {
          penaltyAccrued: update.penaltyAccrued,
          amountRemaining: update.amountRemaining,
          amountPaid: update.amountPaid,
          status: update.status,
          completedAt: update.completedAt,
          nextDueAt: update.nextDueAt,
        },
      });
      if (result.count < 1) {
        throw new BadRequestException('Package repayment balance changed during approval. Please retry the approval.');
      }
    }

    let loanSequence = 0;
    for (const loan of plan.loans) {
      const reference = `${context.referenceBase}-LOAN-${++loanSequence}`;
      const transaction = await this.createDebtRecoveryTransaction(client, {
        memberId,
        walletId,
        type: 'LOAN_REPAYMENT',
        amount: loan.amount,
        reference,
        category: 'admin payment loan recovery',
        description: `Debt recovery from approved wallet funding for ${loan.loanName}`,
        metadata: {
          fundingTransactionId: context.fundingTransactionId,
          paymentId: context.paymentId,
          loanId: loan.loanId,
          loanName: loan.loanName,
          memberName: loan.member.fullName,
          membershipNumber: loan.member.membershipNumber,
          adminAllocated: true,
          trigger: context.trigger,
          repaymentPhase: 'LOAN',
          repaymentStatus: loan.repaymentStatus,
          expectedAmount: loan.expectedAmount,
          paidAmount: loan.amount,
          remainingAmount: loan.remainingAmount,
          dueAt: loan.dueAt.toISOString(),
          dueCycle: loan.dueKey,
        },
        repaymentAttempt: {
          phase: 'LOAN',
          targetType: 'LoanApplication',
          targetId: loan.loanId,
          expectedAmount: loan.expectedAmount,
          paidAmount: loan.amount,
          remainingAmount: loan.remainingAmount,
          status: loan.repaymentStatus,
          mode: 'ADMIN',
          dueAt: loan.dueAt,
          metadata: {
            fundingTransactionId: context.fundingTransactionId,
            paymentId: context.paymentId,
            loanName: loan.loanName,
            dueCycle: loan.dueKey,
            trigger: context.trigger,
          },
        },
        actorId: context.actorId,
      });

      await this.applyScheduleAllocationPlan(client, loan.scheduleAllocations);
      const loanUpdate = await client.loanApplication.updateMany({
        where: {
          id: loan.loanId,
          remainingBalance: loan.update.previousRemainingBalance,
          status: loan.update.previousStatus,
        },
        data: {
          remainingBalance: loan.update.remainingBalance,
          status: loan.update.status,
          nextRepaymentAt: loan.update.nextRepaymentAt,
        },
      });
      if (loanUpdate.count < 1) {
        throw new BadRequestException('Loan repayment balance changed during approval. Please retry the approval.');
      }

      settlements.push({
        type: 'LOAN_REPAYMENT',
        amount: loan.amount,
        targetId: loan.loanId,
        transactionId: transaction.id,
        reference: transaction.reference,
        expectedAmount: loan.expectedAmount,
        remainingAmount: loan.remainingAmount,
        repaymentStatus: loan.repaymentStatus,
      });
    }

    const exposureFrames = await this.collectDueDebtExposureFrames(client, memberId, context.trigger);
    const exposures = await this.exposeDebtFrames(client, memberId, exposureFrames);
    const debtSettlementAmount = roundMoney(settlements.reduce((sum, settlement) => sum + settlement.amount, 0));
    return {
      settlements,
      exposures,
      debtSettlementAmount,
      walletCreditAmount: roundMoney(Math.max(fundingAmount - debtSettlementAmount, 0)),
    };
  }

  private buildWeeklyAllocationPlan(cycles: any[], amount: number) {
    let remaining = roundMoney(Math.max(amount, 0));
    const allocations: WeeklyCycleAllocationPlan[] = [];

    for (const cycle of cycles) {
      if (remaining <= 0) {
        break;
      }

      const cycleAmount = Number(cycle.amount);
      const previousPaidAmount = Number(cycle.amountPaid);
      const openAmount = Math.max(cycleAmount - previousPaidAmount, 0);
      const paidAmount = roundMoney(Math.min(openAmount, remaining));
      if (paidAmount <= 0) {
        continue;
      }

      const nextPaidAmount = roundMoney(previousPaidAmount + paidAmount);
      allocations.push({
        cycleId: cycle.id,
        dueDate: cycle.dueDate,
        expectedAmount: cycleAmount,
        previousPaidAmount,
        paidAmount,
        nextPaidAmount,
        nextStatus: weeklyCycleStatus(cycle.dueDate, cycleAmount, nextPaidAmount),
      });
      remaining = roundMoney(remaining - paidAmount);
    }

    return allocations;
  }

  private buildScheduleAllocationPlan(items: any[], amount: number) {
    let remaining = roundMoney(Math.max(amount, 0));
    const allocations: ScheduleAllocationPlan[] = [];

    for (const item of items) {
      if (remaining <= 0) {
        break;
      }

      const expectedAmount = Number(item.expectedAmount);
      const previousPaidAmount = Number(item.paidAmount);
      const openAmount = Math.max(Number(item.remainingAmount), 0);
      const paidAmount = roundMoney(Math.min(openAmount, remaining));
      if (paidAmount <= 0) {
        continue;
      }

      const nextPaidAmount = roundMoney(previousPaidAmount + paidAmount);
      const nextRemainingAmount = roundMoney(Math.max(expectedAmount - nextPaidAmount, 0));
      allocations.push({
        itemId: item.id,
        targetType: item.targetType,
        sequence: item.sequence,
        dueDate: item.dueDate,
        expectedAmount,
        previousPaidAmount,
        paidAmount,
        nextPaidAmount,
        nextRemainingAmount,
        nextStatus: this.scheduleItemStatus(item.dueDate, expectedAmount, nextPaidAmount),
      });
      remaining = roundMoney(remaining - paidAmount);
    }

    return {
      allocations,
      appliedAmount: roundMoney(amount - remaining),
      unallocatedAmount: remaining,
    };
  }

  private getScheduleDueAmountFromItems(items: any[], dueOnly = true) {
    const dueBefore = addDays(startOfIsoDay(new Date()), 1);
    const dueItems = [...items]
      .filter((item) => Number(item.remainingAmount) > 0)
      .filter((item) => !dueOnly || item.dueDate.getTime() < dueBefore.getTime())
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.sequence - b.sequence);

    return {
      amount: roundMoney(dueItems.reduce((sum, item) => sum + Number(item.remainingAmount), 0)),
      dueAt: dueItems[0]?.dueDate ?? null,
      items: dueItems,
    };
  }

  private getScheduleTotalsAfterAllocations(items: any[], allocations: ScheduleAllocationPlan[]) {
    const allocationByItem = new Map(allocations.map((allocation) => [allocation.itemId, allocation]));
    let expected = 0;
    let paid = 0;
    let remaining = 0;
    let nextDueAt: Date | null = null;

    for (const item of [...items].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.sequence - b.sequence)) {
      const allocation = allocationByItem.get(item.id);
      const itemExpected = Number(item.expectedAmount);
      const itemPaid = allocation ? allocation.nextPaidAmount : Number(item.paidAmount);
      const itemRemaining = allocation ? allocation.nextRemainingAmount : Number(item.remainingAmount);

      expected = roundMoney(expected + itemExpected);
      paid = roundMoney(paid + itemPaid);
      remaining = roundMoney(remaining + itemRemaining);

      if (!nextDueAt && itemRemaining > 0) {
        nextDueAt = item.dueDate;
      }
    }

    return { expected, paid, remaining, nextDueAt };
  }

  private async applyWeeklyAllocationPlan(
    client: any,
    memberId: string,
    transactionId: string,
    plan: PreparedWeeklyDebtRecovery,
  ) {
    if (plan.amount <= 0 || !plan.allocations.length) return;

    const payment = await client.weeklyDeductionPayment.create({
      data: {
        memberId,
        transactionId,
        amount: plan.amount,
        mode: 'SETTLEMENT',
        metadata: {
          transactionId,
          settledFromFundingDebtRecovery: true,
        },
      },
    });

    await client.weeklyDeductionAllocation.createMany({
      data: plan.allocations.map((allocation) => ({
        paymentId: payment.id,
        cycleId: allocation.cycleId,
        amount: allocation.paidAmount,
      })),
      skipDuplicates: true,
    });

    await Promise.all(
      plan.allocations.map(async (allocation) => {
        const result = await client.weeklyDeductionCycle.updateMany({
          where: {
            id: allocation.cycleId,
            amountPaid: allocation.previousPaidAmount,
          },
          data: {
            amountPaid: allocation.nextPaidAmount,
            status: allocation.nextStatus,
          },
        });
        if (result.count < 1) {
          throw new BadRequestException('Weekly deduction balance changed during approval. Please retry the approval.');
        }
        await this.clearDebtExposure(client, this.weeklyExposureSourceKey(allocation.cycleId), allocation.paidAmount);
      }),
    );
  }

  private async applyScheduleAllocationPlan(client: any, allocations: ScheduleAllocationPlan[]) {
    if (!allocations.length) return;

    await Promise.all(
      allocations.map(async (allocation) => {
        const result = await (client as any).repaymentScheduleItem.updateMany({
          where: {
            id: allocation.itemId,
            paidAmount: allocation.previousPaidAmount,
            remainingAmount: roundMoney(Math.max(allocation.expectedAmount - allocation.previousPaidAmount, 0)),
          },
          data: {
            paidAmount: allocation.nextPaidAmount,
            remainingAmount: allocation.nextRemainingAmount,
            status: allocation.nextStatus,
          },
        });
        if (result.count < 1) {
          throw new BadRequestException('Repayment schedule balance changed during approval. Please retry the approval.');
        }
        if (allocation.targetType) {
          await this.clearDebtExposure(
            client,
            this.scheduleExposureSourceKey(allocation.targetType, allocation.itemId),
            allocation.paidAmount,
          );
        }
      }),
    );
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
    input.amount = roundMoney(input.amount);
    if (input.amount <= 0) {
      throw new BadRequestException('Debt recovery transaction amount must be greater than zero.');
    }

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
    options: { recordAttempts?: boolean; trigger?: string; exposeDebt?: boolean } = {},
  ): Promise<SettlementRecord[]> {
    return (await this.settleWeeklyObligationsDetailed(memberId, options)).settlements;
  }

  async settleWeeklyObligationsDetailed(
    memberId: string,
    options: { recordAttempts?: boolean; trigger?: string; exposeDebt?: boolean } = {},
  ): Promise<ObligationSettlementResult> {
    const wallet = await this.getMemberWallet(memberId);
    return this.settleDueWeeklyDeductionsDetailed(memberId, Number(wallet.availableBalance), options);
  }

  async settlePackageObligations(
    memberId: string,
    options: { recordAttempts?: boolean; trigger?: string; exposeDebt?: boolean } = {},
  ): Promise<SettlementRecord[]> {
    return (await this.settlePackageObligationsDetailed(memberId, options)).settlements;
  }

  async settlePackageObligationsDetailed(
    memberId: string,
    options: { recordAttempts?: boolean; trigger?: string; exposeDebt?: boolean } = {},
  ): Promise<ObligationSettlementResult> {
    const settlements: SettlementRecord[] = [];
    const exposures: ExposureRecord[] = [];
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
      const { subscription, expectedAmount } = candidate;
      const amountToSpend = Math.min(Math.max(availableBalance, 0), expectedAmount);

      if (amountToSpend <= 0) {
        if (options.exposeDebt !== false) {
          exposures.push(...(await this.exposeDuePackageDebt(memberId, subscription.id, options.trigger)));
        }
        continue;
      }

      const applied = await this.applyPackagePayment(memberId, subscription.id, amountToSpend, 'AUTO', {
        expectedAmount,
        trigger: options.trigger,
      });
      settlements.push(...applied.settlements);
      if (options.exposeDebt !== false && amountToSpend < expectedAmount) {
        exposures.push(...(await this.exposeDuePackageDebt(memberId, subscription.id, options.trigger)));
      }
      refreshedWallet = applied.wallet;
      availableBalance = Number(refreshedWallet.availableBalance);
    }

    return { settlements, exposures };
  }

  async settleLoanObligations(
    memberId: string,
    options: { recordAttempts?: boolean; trigger?: string; exposeDebt?: boolean } = {},
  ): Promise<SettlementRecord[]> {
    return (await this.settleLoanObligationsDetailed(memberId, options)).settlements;
  }

  async settleLoanObligationsDetailed(
    memberId: string,
    options: { recordAttempts?: boolean; trigger?: string; exposeDebt?: boolean } = {},
  ): Promise<ObligationSettlementResult> {
    const settlements: SettlementRecord[] = [];
    const exposures: ExposureRecord[] = [];
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
      const { loan, expectedAmount } = candidate;
      const amountToDebit = Math.min(Math.max(availableBalance, 0), expectedAmount);

      if (amountToDebit <= 0) {
        if (options.exposeDebt !== false) {
          exposures.push(...(await this.exposeDueLoanDebt(memberId, loan.id, options.trigger)));
        }
        continue;
      }

      const applied = await this.applyLoanRepayment(memberId, loan.id, amountToDebit, 'AUTO', {
        expectedAmount,
        trigger: options.trigger,
      });
      settlements.push(applied.settlement);
      if (options.exposeDebt !== false && amountToDebit < expectedAmount) {
        exposures.push(...(await this.exposeDueLoanDebt(memberId, loan.id, options.trigger)));
      }
      refreshedWallet = applied.wallet;
      availableBalance = Number(refreshedWallet.availableBalance);
    }

    return { settlements, exposures };
  }

  private async settleDueWeeklyDeductionsDetailed(
    memberId: string,
    availableBalance: number,
    options: { recordAttempts?: boolean; trigger?: string; exposeDebt?: boolean } = {},
  ): Promise<ObligationSettlementResult> {
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
      return { settlements: [], exposures: [] };
    }

    const settings = await this.getWeeklyDeductionSettings();
    if (settings.amount <= 0) {
      return { settlements: [], exposures: [] };
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
      return { settlements: [], exposures: [] };
    }

    if (amountToDebit <= 0) {
      return {
        settlements: [],
        exposures: options.exposeDebt !== false ? await this.exposeDueWeeklyDebt(member, options.trigger) : [],
      };
    }

    const runStamp = today.toISOString();
    const firstDueCycle = dueCycles[0];
    const reference = firstDueCycle
      ? `WEEKLY-${memberId}-${firstDueCycle.id}-${moneyKey(Number(firstDueCycle.amountPaid ?? 0))}`
      : `WEEKLY-${memberId}-${runStamp.slice(0, 10)}`;
    const repaymentStatus = this.repaymentAttemptStatus(amountToDebit, outstanding);
    let result: Awaited<ReturnType<WalletService['debitWalletInTransaction']>>;
    try {
      result = await this.prisma.runTransaction('wallet.settleDueWeeklyDeductions', async (tx) => {
        const debit = await this.debitWalletInTransaction(tx, memberId, amountToDebit, 'WEEKLY_COOPERATIVE', reference, {
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

        await this.allocateWeeklySettlement(tx, memberId, debit.transaction.id, amountToDebit);
        return debit;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { settlements: [], exposures: [] };
      }
      throw error;
    }

    const remainingAmount = roundMoney(Math.max(outstanding - amountToDebit, 0));

    return {
      settlements: [
        {
          type: 'WEEKLY_COOPERATIVE',
          amount: amountToDebit,
          targetId: result.transaction.id,
          expectedAmount: outstanding,
          remainingAmount,
          repaymentStatus,
        },
      ],
      exposures:
        options.exposeDebt !== false && remainingAmount > 0
          ? await this.exposeDueWeeklyDebt(member, options.trigger)
          : [],
    };
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
    amount = roundMoney(amount);
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
    const loanDisbursedAmount = Number((loan as any).disbursedAmount ?? 0);
    const loanTotalAmount = loanDisbursedAmount > 0 ? loanDisbursedAmount : Number(loan.amount);
    const amountPaidSoFar = Math.max(loanTotalAmount - repayableBalance, 0);
    const firstDueItem = scheduleDue.items[0] ?? null;
    const dueKey = firstDueItem
      ? `${firstDueItem.id}-${moneyKey(Number(firstDueItem.paidAmount ?? 0))}`
      : `${dueAt.toISOString().slice(0, 10)}-${moneyKey(amountPaidSoFar)}`;
    const reference = `LOAN-REPAY-${loan.id}-${dueKey}`;
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

    let result: { wallet: any };
    try {
      result = await this.prisma.runTransaction('wallet.applyLoanRepayment', async (tx) => {
        await this.debitWalletInTransaction(tx, memberId, amount, 'LOAN_REPAYMENT', reference, {
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

        await this.allocateRepaymentSchedule(tx, 'LoanApplication', loan.id, amount, mode === 'AUTO');
        const scheduleTotals = await this.getScheduleTotals(tx, 'LoanApplication', loan.id);
        const nextRemaining = roundMoney(Math.max(scheduleTotals.remaining, 0));
        const isFullyRepaid = nextRemaining <= MONEY_COMPLETION_TOLERANCE;
        await tx.loanApplication.update({
          where: { id: loan.id },
          data: {
            remainingBalance: isFullyRepaid ? 0 : nextRemaining,
            status: isFullyRepaid ? 'COMPLETED' : 'IN_PROGRESS',
            nextRepaymentAt: isFullyRepaid ? null : await this.nextOpenScheduleDueDate(tx, 'LoanApplication', loan.id),
          } as any,
        });

        return { wallet: await this.getMemberWalletWithClient(tx, memberId) };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        if (mode === 'AUTO') {
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
        throw new BadRequestException('This loan repayment was already processed. Please refresh the loan details.');
      }
      throw error;
    }

    return {
      wallet: result.wallet,
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
    amount = roundMoney(amount);
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
    const firstPrincipalItem = scheduleDue.items[0] ?? null;
    const dueKey = firstPrincipalItem
      ? `${firstPrincipalItem.id}-${moneyKey(Number(firstPrincipalItem.paidAmount ?? 0))}`
      : `${dueAt.toISOString().slice(0, 10)}-${moneyKey(amountPaid)}`;

    try {
      return await this.prisma.runTransaction('wallet.applyPackagePayment', async (tx) => {
        let remainingToApply = remainingToSpend;
        let nextPenaltyAccrued = penaltyAccrued;
        let nextAmountRemaining = amountRemaining;
        let nextAmountPaid = amountPaid;
        const appliedSettlements: SettlementRecord[] = [];

        if (nextPenaltyAccrued > 0 && remainingToApply > 0) {
          const penaltyPayment = Math.min(remainingToApply, nextPenaltyAccrued);
          const expectedPenaltyAmount = nextPenaltyAccrued;
          const penaltyRepaymentStatus = this.repaymentAttemptStatus(penaltyPayment, expectedPenaltyAmount);
          const penaltyReference = `PACKAGE-PENALTY-${subscription.id}-${moneyKey(nextPenaltyAccrued)}`;
          const existingPenalty =
            mode === 'AUTO'
              ? await tx.transaction.findUnique({ where: { reference: penaltyReference } })
              : null;

          if (!existingPenalty) {
            await this.debitWalletInTransaction(tx, memberId, penaltyPayment, 'PACKAGE_PENALTY', penaltyReference, {
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

            await this.clearDebtExposure(tx, this.packagePenaltyExposureSourceKey(subscription.id), penaltyPayment);
            nextPenaltyAccrued = roundMoney(nextPenaltyAccrued - penaltyPayment);
            remainingToApply = roundMoney(remainingToApply - penaltyPayment);
            appliedSettlements.push({
              type: 'PACKAGE_PENALTY',
              amount: penaltyPayment,
              targetId: subscription.id,
              expectedAmount: expectedPenaltyAmount,
              remainingAmount: Math.max(expectedPenaltyAmount - penaltyPayment, 0),
              repaymentStatus: penaltyRepaymentStatus,
            });
          }
        }

        if (nextAmountRemaining > 0 && remainingToApply > 0) {
          const principalPayment = Math.min(remainingToApply, nextAmountRemaining);
          const expectedPrincipalAmount = Math.max(Math.min(principalDueAtStart, nextAmountRemaining), principalPayment);
          const principalRepaymentStatus = this.repaymentAttemptStatus(principalPayment, expectedPrincipalAmount);
          const packageReference = `PACKAGE-${subscription.id}-${dueKey}`;
          const existingPackage =
            mode === 'AUTO'
              ? await tx.transaction.findUnique({ where: { reference: packageReference } })
              : null;

          if (!existingPackage) {
            await this.debitWalletInTransaction(tx, memberId, principalPayment, 'PACKAGE_SUBSCRIPTION', packageReference, {
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

            await this.allocateRepaymentSchedule(tx, 'PackageSubscription', subscription.id, principalPayment, mode === 'AUTO');
            const scheduleTotals = await this.getScheduleTotals(tx, 'PackageSubscription', subscription.id);
            nextAmountRemaining = scheduleTotals.remaining;
            nextAmountPaid = scheduleTotals.paid;
            remainingToApply = roundMoney(remainingToApply - principalPayment);
            appliedSettlements.push({
              type: 'PACKAGE_SUBSCRIPTION',
              amount: principalPayment,
              targetId: subscription.id,
              expectedAmount: expectedPrincipalAmount || expectedTotalAmount,
              remainingAmount: Math.max((expectedPrincipalAmount || expectedTotalAmount) - principalPayment, 0),
              repaymentStatus: principalRepaymentStatus,
            });
          }
        }

        const nextStatus = nextAmountRemaining <= 0 && nextPenaltyAccrued <= 0 ? 'COMPLETED' : 'IN_PROGRESS';
        await tx.packageSubscription.update({
          where: { id: subscription.id },
          data: {
            penaltyAccrued: nextPenaltyAccrued,
            amountRemaining: nextAmountRemaining,
            amountPaid: nextAmountPaid,
            status: nextStatus,
            completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
            nextDueAt: nextStatus === 'COMPLETED' ? null : await this.nextOpenScheduleDueDate(tx, 'PackageSubscription', subscription.id),
          } as any,
        });

        return {
          wallet: await this.getMemberWalletWithClient(tx, memberId),
          settlements: appliedSettlements,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        if (mode === 'AUTO') {
          return { wallet: await this.getMemberWallet(memberId), settlements: [] };
        }
        throw new BadRequestException('This package payment was already processed. Please refresh the package details.');
      }
      throw error;
    }
  }

  async applySavingsContribution(
    memberId: string,
    amount: number,
    mode: 'AUTO' | 'ADMIN' | 'MEMBER' = 'MEMBER',
    accountId?: string,
  ) {
    amount = roundMoney(amount);
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

    const reference = `SAVINGS-${account.id}-${moneyKey(Number(account.balance ?? 0))}`;
    const description =
      mode === 'AUTO'
        ? `Automatic savings contribution for ${account.member.fullName}`
        : mode === 'ADMIN'
          ? `Admin wallet allocation to ${account.member.fullName}'s savings`
          : `Savings contribution for ${account.member.fullName}`;

    let result: { wallet: any; account: any };
    try {
      result = await this.prisma.runTransaction('wallet.applySavingsContribution', async (tx) => {
        await this.debitWalletInTransaction(tx, memberId, amount, 'SAVINGS', reference, {
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

        const updated = await tx.savingsAccount.update({
          where: { id: account.id },
          data: {
            balance: { increment: amount },
          },
        });

        return {
          wallet: await this.getMemberWalletWithClient(tx, memberId),
          account: updated,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        if (mode === 'AUTO') {
          const wallet = await this.getMemberWallet(memberId);
          return {
            wallet,
            reference,
            account,
            settlement: {
              type: 'SAVINGS',
              amount: 0,
              targetId: account.id,
            },
          };
        }
        throw new BadRequestException('This savings contribution was already processed. Please refresh the savings details.');
      }
      throw error;
    }

    return {
      wallet: result.wallet,
      reference,
      account: result.account,
      settlement: {
        type: 'SAVINGS',
        amount,
        targetId: result.account.id,
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
