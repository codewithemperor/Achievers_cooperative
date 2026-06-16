import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { NotificationService } from '../../common/services/notification.service';
import { AuditService } from '../../common/services/audit.service';
import { FinancialPostingService } from '../../common/services/financial-posting.service';
import { ApplyLoanDto, DisburseLoanDto, IncreaseLoanAmountDto, QueryLoansDto, RepayLoanDto } from './dto/index';
import type { LoanStatus, LoanTenorUnit } from '../../common/prisma-types';
import { normalizePagination } from '../../common/pagination';
import { formatMoney, normalizeMoney } from '../../common/utils/money';

const LOAN_BOND_AMOUNT_KEY = 'LOAN_BOND_AMOUNT';
const DEFAULT_LOAN_BOND_AMOUNT = 2000;
const MONEY_COMPLETION_TOLERANCE = 0.01;

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}

type LoanLike = {
  amount: any;
  disbursedAmount?: any;
  remainingBalance: any;
  tenorMonths: number;
  tenorUnit?: LoanTenorUnit;
  submittedAt: Date;
  approvedAt?: Date | null;
  disbursedAt?: Date | null;
  rejectedAt?: Date | null;
  dueDate?: Date | null;
  nextRepaymentAt?: Date | null;
  loanBondRequired?: boolean;
  loanBondAmount?: any;
  loanBondPaidAt?: Date | null;
  loanBondTransactionId?: string | null;
  status: LoanStatus;
};

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly financialPosting: FinancialPostingService,
  ) {}

  // ─── Apply for a loan ──────────────────────────────────────────────
  async apply(userId: string, dto: ApplyLoanDto) {
    const amount = normalizeMoney(dto.amount);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const member =
      user?.role === 'SUPER_ADMIN' && dto.memberId
        ? await this.prisma.member.findUnique({ where: { id: dto.memberId } })
        : await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    // ── Block multiple active loans ──
    const activeStatuses: LoanStatus[] = ['APPROVED', 'DISBURSED', 'IN_PROGRESS', 'OVERDUE'];
    const existingActiveLoan = await this.prisma.loanApplication.findFirst({
      where: {
        memberId: member.id,
        status: { in: activeStatuses },
      },
      orderBy: { submittedAt: 'desc' },
    });

    if (existingActiveLoan && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        `You already have an active loan application (#${member.membershipNumber}). Please complete your current loan before applying for a new one.`,
      );
    }

    // ── Guarantor validations ──
    if (dto.guarantorOneId && dto.guarantorOneId === member.id) {
      throw new BadRequestException('A member cannot guarantee their own loan.');
    }
    if (dto.guarantorTwoId && dto.guarantorTwoId === member.id) {
      throw new BadRequestException('A member cannot guarantee their own loan.');
    }
    if (dto.guarantorOneId && dto.guarantorTwoId && dto.guarantorOneId === dto.guarantorTwoId) {
      throw new BadRequestException('Select two different guarantors.');
    }
    if (dto.guarantorOneId) {
      const guarantor = await this.prisma.member.findUnique({ where: { id: dto.guarantorOneId } });
      if (!guarantor) throw new NotFoundException('Selected guarantor 1 does not exist.');
    }
    if (dto.guarantorTwoId) {
      const guarantor = await this.prisma.member.findUnique({ where: { id: dto.guarantorTwoId } });
      if (!guarantor) throw new NotFoundException('Selected guarantor 2 does not exist.');
    }

    // ── Bank account validation (optional) ──
    if (dto.bankAccountId) {
      const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
      if (!bankAccount || bankAccount.memberId !== member.id) {
        throw new BadRequestException('Invalid bank account selected.');
      }
    }

    const repaymentSchedule = this.resolveRepaymentSchedule(
      dto.tenorMonths,
      (dto.tenorUnit ?? 'WEEKS') as LoanTenorUnit,
      new Date(),
    );

    const loan = await this.prisma.loanApplication.create({
      data: {
        memberId: member.id,
        guarantorOneId: dto.guarantorOneId,
        guarantorTwoId: dto.guarantorTwoId,
        amount,
        tenorMonths: repaymentSchedule.tenorMonths,
        tenorUnit: repaymentSchedule.tenorUnit,
        purpose: dto.purpose,
        disbursedAmount: 0,
        remainingBalance: 0,
        loanBondRequired: true,
        bankAccountId: dto.bankAccountId,
      } as any,
    });

    await this.audit.log(userId, 'APPLY_LOAN', 'LoanApplication', loan.id, {
      amount,
      tenorMonths: dto.tenorMonths,
      tenorUnit: dto.tenorUnit ?? 'WEEKS',
      repaymentInstallments: repaymentSchedule.installments,
    });

    return {
      ...loan,
      amount: Number(loan.amount),
      message: `Loan application for ₦${Number(loan.amount).toLocaleString()} from ${member.fullName} has been submitted successfully. Your application is currently being reviewed.`,
    };
  }

  // ─── List loans ────────────────────────────────────────────────────
  async findAll(userId: string, query: QueryLoansDto) {
    const { status, from, to } = query;
    const { page, limit, skip } = normalizePagination(query);

    let memberId: string | undefined;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'MEMBER') {
      const member = await this.prisma.member.findUnique({ where: { userId } });
      memberId = member?.id;
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (memberId) where.memberId = memberId;
    if (from || to) {
      where.submittedAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    // Check for overdue loans and update statuses
    await this.updateOverdueLoans();

    const [items, total] = await Promise.all([
      this.prisma.loanApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          member: {
            include: {
              user: { select: { email: true } },
            },
          },
          guarantorOne: { select: { id: true, fullName: true, membershipNumber: true } },
          guarantorTwo: { select: { id: true, fullName: true, membershipNumber: true } },
          bankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
          activities: {
            where: { type: 'AMOUNT_INCREASE' },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.loanApplication.count({ where }),
    ]);

    return {
      items: items.map((l) => {
        const amount = Number(l.amount);
        const disbursedAmount = this.resolveDisbursedAmount(l);
        const remainingBalance = this.shouldExposeRemainingBalance(l.status) ? Number(l.remainingBalance) : 0;
        const loanBondRequired = this.loanRequiresBond(l);
        const loanBondAmount = loanBondRequired ? this.resolveStoredLoanBondAmount(l) ?? 0 : 0;
        const loanBondPaid = loanBondRequired && this.isLoanBondPaid(l);
        return {
          ...l,
          amount,
          approvedAmount: amount,
          disbursedAmount,
          remainingToDisburse: Math.max(amount - disbursedAmount, 0),
          tenorUnit: (l as any).tenorUnit ?? 'MONTHS',
          remainingBalance,
          amountPaidSoFar: this.shouldExposeRemainingBalance(l.status)
            ? Math.max(disbursedAmount - remainingBalance, 0)
            : 0,
          repaymentProgress: this.calculateRepaymentProgress(l),
          loanBondRequired,
          loanBondAmount,
          loanBondPaidAt: (l as any).loanBondPaidAt ?? null,
          loanBondTransactionId: (l as any).loanBondTransactionId ?? null,
          loanBondPaid,
          canPayLoanBond: loanBondRequired && l.status === 'APPROVED' && !loanBondPaid,
          canDisburse:
            ['APPROVED', 'DISBURSED', 'IN_PROGRESS'].includes(l.status) &&
            (!loanBondRequired || loanBondPaid) &&
            Math.max(amount - disbursedAmount, 0) > 0,
          canEdit: l.status === 'PENDING',
          canDelete: l.status === 'PENDING',
        };
      }),
      total,
      page,
      limit,
    };
  }

  // ─── Get single loan ───────────────────────────────────────────────
  async findOne(id: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: { select: { email: true } },
            wallet: true,
          },
        },
        guarantorOne: { select: { id: true, fullName: true, membershipNumber: true } },
        guarantorTwo: { select: { id: true, fullName: true, membershipNumber: true } },
        bankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
        activities: {
          include: {
            actor: { select: { id: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!loan) throw new NotFoundException('Loan application not found');

    const relatedTransactions = loan.member.wallet
      ? await this.prisma.transaction.findMany({
          where: {
            walletId: loan.member.wallet.id,
            metadata: { path: ['loanId'], equals: loan.id },
            type: { in: ['LOAN_BOND', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'ADMIN_REFUND'] as any },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const repaymentAttempts = await (this.prisma as any).repaymentAttempt.findMany({
      where: {
        targetType: 'LoanApplication',
        targetId: loan.id,
      },
      orderBy: { attemptedAt: 'desc' },
      include: { transaction: true },
    });

    const amount = Number(loan.amount);
    const disbursedAmount = this.resolveDisbursedAmount(loan);
    const remainingToDisburse = Math.max(amount - disbursedAmount, 0);
    const loanBondRequired = this.loanRequiresBond(loan);
    const storedLoanBondAmount = this.resolveStoredLoanBondAmount(loan);
    const loanBondAmount = loanBondRequired ? storedLoanBondAmount ?? (await this.getLoanBondAmount()) : 0;
    const loanBondPaid = loanBondRequired && this.isLoanBondPaid(loan);
    const remainingBalance = this.shouldExposeRemainingBalance(loan.status) ? Number(loan.remainingBalance) : 0;
    const amountPaidSoFar = this.shouldExposeRemainingBalance(loan.status) ? Math.max(disbursedAmount - remainingBalance, 0) : 0;
    const repaymentProgress = this.calculateRepaymentProgress(loan);
    const schedulePrincipal = disbursedAmount > 0 ? disbursedAmount : amount;
    const scheduleAnchorDate = loan.disbursedAt ?? loan.approvedAt ?? loan.submittedAt;
    const scheduleMaturityDate = loan.dueDate ?? this.addCalendarMonths(scheduleAnchorDate, Math.max(loan.tenorMonths, 1));
    const installmentCount = this.resolveInstallmentCount(
      scheduleAnchorDate,
      scheduleMaturityDate,
      loan.tenorMonths,
      ((loan as any).tenorUnit ?? 'MONTHS') as LoanTenorUnit,
    );
    const installmentAmount = installmentCount > 0 ? schedulePrincipal / installmentCount : schedulePrincipal;
    let paymentSchedule = Array.from({ length: installmentCount }).map((_, index) => {
      const dueDate = this.addTenorStep(scheduleAnchorDate, ((loan as any).tenorUnit ?? 'MONTHS') as LoanTenorUnit, index + 1);
      const dueAmount = Math.round(installmentAmount * 100) / 100;
      const cumulativeDue = dueAmount * (index + 1);
      const isLoanLive = ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(loan.status);

      let status = 'UPCOMING';
      if (!isLoanLive) {
        status = loan.status === 'REJECTED' ? 'CANCELLED' : 'PENDING';
      } else if (amountPaidSoFar >= cumulativeDue || loan.status === 'COMPLETED') {
        status = 'PAID';
      } else if (dueDate.getTime() < Date.now()) {
        status = 'OVERDUE';
      }

      return {
        installment: index + 1,
        dueDate,
        amount: dueAmount,
        expectedAmount: dueAmount,
        paidAmount: status === 'PAID' ? dueAmount : 0,
        remainingAmount: status === 'PAID' ? 0 : dueAmount,
        status,
      };
    });

    if (this.shouldExposeRemainingBalance(loan.status)) {
      const persistedSchedule = await this.walletService.ensureLoanRepaymentSchedule(loan.id);
      if (persistedSchedule.length) {
        paymentSchedule = persistedSchedule.map((item: any) => this.walletService.serializeRepaymentScheduleItem(item));
      }
    }
    const nextRepaymentAt =
      (loan as any).nextRepaymentAt ??
      paymentSchedule.find((item: any) =>
        ['PENDING', 'PARTIAL', 'OVERDUE', 'UPCOMING'].includes(item.status) && Number(item.remainingAmount ?? item.amount) > 0,
      )?.dueDate ??
      null;

    const timeline = this.buildTimeline(loan, relatedTransactions);

    return {
      ...loan,
      amount,
      approvedAmount: amount,
      disbursedAmount,
      remainingToDisburse,
      tenorUnit: (loan as any).tenorUnit ?? 'MONTHS',
      remainingBalance,
      amountPaidSoFar,
      repaymentProgress,
      loanBondRequired,
      loanBondAmount,
      loanBondPaidAt: (loan as any).loanBondPaidAt ?? null,
      loanBondTransactionId: (loan as any).loanBondTransactionId ?? null,
      loanBondPaid,
      canPayLoanBond: loanBondRequired && loan.status === 'APPROVED' && !loanBondPaid,
      canDisburse: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'].includes(loan.status) && (!loanBondRequired || loanBondPaid) && remainingToDisburse > 0,
      nextRepaymentAt,
      paymentSchedule,
      timeline,
      relatedTransactions: relatedTransactions.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
      repaymentAttempts: repaymentAttempts.map((attempt: any) => this.serializeRepaymentAttempt(attempt)),
      activities: (loan as any).activities?.map((activity: any) => ({
        ...activity,
        previousAmount: activity.previousAmount == null ? null : Number(activity.previousAmount),
        newAmount: activity.newAmount == null ? null : Number(activity.newAmount),
        deltaAmount: Number(activity.deltaAmount),
      })) ?? [],
      member: {
        ...loan.member,
        wallet: loan.member.wallet
          ? {
              ...loan.member.wallet,
              availableBalance: Number(loan.member.wallet.availableBalance),
              pendingBalance: Number(loan.member.wallet.pendingBalance),
            }
          : null,
      },
      canEdit: loan.status === 'PENDING',
      canDelete: loan.status === 'PENDING',
    };
  }

  // ─── Approve loan ──────────────────────────────────────────────────
  private serializeRepaymentAttempt(attempt: any) {
    return {
      id: attempt.id,
      phase: attempt.phase,
      targetType: attempt.targetType,
      targetId: attempt.targetId,
      expectedAmount: Number(attempt.expectedAmount),
      paidAmount: Number(attempt.paidAmount),
      remainingAmount: Number(attempt.remainingAmount),
      status: attempt.status,
      mode: attempt.mode,
      reference: attempt.reference,
      dueAt: attempt.dueAt,
      attemptedAt: attempt.attemptedAt,
      metadata: attempt.metadata ?? {},
      transaction: attempt.transaction
        ? {
            id: attempt.transaction.id,
            type: attempt.transaction.type,
            status: attempt.transaction.status,
            reference: attempt.transaction.reference,
            description: attempt.transaction.description,
            amount: Number(attempt.transaction.amount),
          }
        : null,
    };
  }

  async approve(id: string, actorId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'PENDING') throw new BadRequestException('Only pending loan applications can be approved.');

    const loanBondRequired = this.loanRequiresBond(loan);
    const loanBondAmount = loanBondRequired ? await this.getLoanBondAmount() : 0;
    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), loanBondAmount },
    });

    await this.audit.log(actorId, 'APPROVE_LOAN', 'LoanApplication', id, {
      amount: Number(loan.amount),
      loanBondRequired,
      loanBondAmount,
    });

    if (loanBondRequired) {
      await this.notifications.notifyMember(
        loan.member.userId,
        'Loan Approved',
        `Your loan application for ₦${Number(loan.amount).toLocaleString()} has been approved. Please pay the loan bond of ₦${loanBondAmount.toLocaleString()} before disbursement.`,
      );
    } else {
      await this.notifications.notifyMember(
        loan.member.userId,
        'Loan Approved',
        `Your loan application for NGN ${Number(loan.amount).toLocaleString()} has been approved.`,
      );
    }

    const amount = Number(updated.amount);
    return {
      ...updated,
      amount,
      loanBondRequired,
      loanBondAmount,
      loanBondPaid: false,
      canPayLoanBond: loanBondRequired,
      canDisburse: !loanBondRequired,
      message: loanBondRequired
        ? `Loan application for ₦${amount.toLocaleString()} from ${loan.member.fullName} has been approved. Loan bond of ₦${loanBondAmount.toLocaleString()} must be paid before disbursement.`
        : `Loan application for ₦${amount.toLocaleString()} from ${loan.member.fullName} has been approved.`,
    };
  }

  // ─── Reject loan ───────────────────────────────────────────────────
  async reject(id: string, actorId: string, reason?: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            wallet: true,
          },
        },
      },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'APPROVED' && loan.status !== 'PENDING') {
      throw new BadRequestException('Only pending or approved loan applications can be rejected.');
    }

    if (loan.status === 'APPROVED' && (this.resolveDisbursedAmount(loan) > 0 || loan.disbursedAt)) {
      throw new BadRequestException('This approved loan has already been disbursed and cannot be rejected.');
    }

    const rejectedAt = new Date();
    const rejection = await this.prisma.runTransaction('loans.reject', async (tx) => {
      const currentLoan = await tx.loanApplication.findUnique({
        where: { id },
        include: {
          member: {
            include: {
              wallet: true,
            },
          },
        },
      });
      if (!currentLoan) throw new NotFoundException('Loan application not found');
      if (currentLoan.status !== 'APPROVED' && currentLoan.status !== 'PENDING') {
        throw new BadRequestException('Only pending or approved loan applications can be rejected.');
      }
      if (currentLoan.status === 'APPROVED' && (this.resolveDisbursedAmount(currentLoan) > 0 || currentLoan.disbursedAt)) {
        throw new BadRequestException('This approved loan has already been disbursed and cannot be rejected.');
      }

      let refundTransaction: any = null;
      let refundAmount = 0;
      const loanBondPaid = this.isLoanBondPaid(currentLoan);

      if (loanBondPaid) {
        const bondTransaction = (currentLoan as any).loanBondTransactionId
          ? await tx.transaction.findUnique({ where: { id: (currentLoan as any).loanBondTransactionId } })
          : null;
        refundAmount = normalizeMoney(
          this.resolveStoredLoanBondAmount(currentLoan) ?? Number(bondTransaction?.amount ?? 0),
        );

        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
          throw new BadRequestException('Loan bond refund amount could not be resolved.');
        }

        const wallet =
          currentLoan.member.wallet ??
          (await tx.wallet.create({
            data: {
              memberId: currentLoan.memberId,
              availableBalance: 0,
              pendingBalance: 0,
              totalFunded: 0,
              totalCharges: 0,
              currency: 'NGN',
            },
          }));
        const refundReference = `LOAN-BOND-REFUND-${currentLoan.id}`;

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { increment: refundAmount },
          },
        });

        refundTransaction = await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'ADMIN_REFUND',
            amount: refundAmount,
            status: 'APPROVED',
            reference: refundReference,
            category: 'loan bond refund',
            description: `Loan bond refund for ${currentLoan.member.fullName}`,
            editable: false,
            lockReason: 'Loan bond refunds are system-generated when an approved loan is rejected before disbursement.',
            metadata: {
              loanId: currentLoan.id,
              memberId: currentLoan.memberId,
              membershipNumber: currentLoan.member.membershipNumber,
              originalLoanBondTransactionId: (currentLoan as any).loanBondTransactionId ?? null,
              reason: reason || null,
              trigger: 'APPROVED_LOAN_REJECTION',
            } as any,
          },
        });

        await this.financialPosting.postAssociationToWallet(
          {
            memberId: currentLoan.memberId,
            amount: refundAmount,
            reference: refundReference,
            sourceType: 'Transaction',
            sourceId: refundTransaction.id,
            description: `Loan bond refund for ${currentLoan.member.fullName}`,
            actorId,
            category: 'loan bond refund',
          },
          tx,
        );

        if (bondTransaction) {
          await tx.transaction.update({
            where: { id: bondTransaction.id },
            data: {
              metadata: {
                ...((bondTransaction.metadata as Record<string, unknown> | null) ?? {}),
                refundedByTransactionId: refundTransaction.id,
                refundedAt: rejectedAt.toISOString(),
              } as any,
            },
          });
        }
      }

      const updatedLoan = await tx.loanApplication.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt,
          nextRepaymentAt: null,
          loanBondPaidAt: null,
          loanBondTransactionId: null,
        } as any,
      });

      return { updatedLoan, refundAmount, refundTransaction };
    });

    await this.audit.log(actorId, 'REJECT_LOAN', 'LoanApplication', id, {
      reason,
      refundAmount: rejection.refundAmount,
      refundTransactionId: rejection.refundTransaction?.id ?? null,
    });

    const rejectReason = reason ? ` Reason: ${reason}` : '';
    const refundMessage =
      rejection.refundAmount > 0
        ? ` Loan bond of ₦${formatMoney(rejection.refundAmount)} has been refunded to your wallet.`
        : '';
    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Rejected',
      `Your loan application for ₦${formatMoney(loan.amount)} has been rejected.${rejectReason}${refundMessage}`,
    );

    const amount = Number(rejection.updatedLoan.amount);
    return {
      ...rejection.updatedLoan,
      amount,
      loanBondPaid: false,
      loanBondPaidAt: null,
      loanBondTransactionId: null,
      loanBondRefundAmount: rejection.refundAmount,
      loanBondRefundTransactionId: rejection.refundTransaction?.id ?? null,
      message: `Loan application for ₦${formatMoney(amount)} from ${loan.member.fullName} has been rejected.${rejectReason}${refundMessage}`,
    };
  }

  // ─── Disburse loan — NO wallet credit ──────────────────────────────
  async increaseAmount(id: string, actorId: string, dto: IncreaseLoanAmountDto) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (!['PENDING', 'APPROVED', 'DISBURSED', 'IN_PROGRESS'].includes(loan.status)) {
      throw new BadRequestException('Only pending, approved, disbursed, or in-progress loans can be increased.');
    }

    const previousAmount = Number(loan.amount);
    const newAmount = normalizeMoney(dto.amount);
    if (!Number.isFinite(newAmount) || newAmount <= previousAmount) {
      throw new BadRequestException(
        `New approved amount must be greater than the current approved amount of ₦${previousAmount.toLocaleString()}.`,
      );
    }

    const deltaAmount = normalizeMoney(newAmount - previousAmount);
    const currentDisbursedAmount = this.resolveDisbursedAmount(loan);
    const nextTenorUnit = dto.tenorUnit ?? ((loan as any).tenorUnit ?? 'MONTHS');
    const scheduleAnchorDate = loan.disbursedAt ?? loan.approvedAt ?? loan.submittedAt;
    const repaymentSchedule = dto.tenorMonths
      ? this.resolveRepaymentSchedule(dto.tenorMonths, nextTenorUnit as LoanTenorUnit, scheduleAnchorDate)
      : {
          installments: this.resolveInstallmentCount(
            scheduleAnchorDate,
            loan.dueDate ?? this.addCalendarMonths(scheduleAnchorDate, Math.max(loan.tenorMonths, 1)),
            loan.tenorMonths,
            nextTenorUnit as LoanTenorUnit,
          ),
          tenorMonths: loan.tenorMonths,
          tenorUnit: nextTenorUnit as LoanTenorUnit,
          maturityDate: loan.dueDate,
        };
    const updated = await this.prisma.runTransaction('loans.increaseAmount', async (tx) => {
      const next = await tx.loanApplication.update({
        where: { id },
        data: {
          amount: newAmount,
          disbursedAmount: currentDisbursedAmount,
          tenorMonths: repaymentSchedule.tenorMonths,
          tenorUnit: repaymentSchedule.tenorUnit,
          ...(dto.tenorMonths ? { dueDate: repaymentSchedule.maturityDate } : {}),
        } as any,
      });

      await tx.loanActivity.create({
        data: {
          loanId: id,
          type: 'AMOUNT_INCREASE',
          previousAmount,
          newAmount,
          deltaAmount,
          note: dto.reason || null,
          actorId,
          metadata: {
            memberId: loan.memberId,
            previousStatus: loan.status,
            previousTenorMonths: loan.tenorMonths,
            newTenorMonths: repaymentSchedule.tenorMonths,
            previousTenorUnit: (loan as any).tenorUnit ?? 'MONTHS',
            newTenorUnit: repaymentSchedule.tenorUnit,
            requestedTenorMonths: dto.tenorMonths ?? null,
          },
        } as any,
      });

      if (['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(next.status)) {
        await this.walletService.rebuildLoanRepaymentSchedule(next.id, tx);
      }

      return next;
    });

    await this.audit.log(actorId, 'INCREASE_LOAN_AMOUNT', 'LoanApplication', id, {
      previousAmount,
      newAmount,
      deltaAmount,
      reason: dto.reason,
      previousTenorMonths: loan.tenorMonths,
      newTenorMonths: repaymentSchedule.tenorMonths,
      tenorUnit: repaymentSchedule.tenorUnit,
      requestedTenorMonths: dto.tenorMonths ?? null,
    });

    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Amount Increased',
      `Your approved loan amount has been increased from ₦${previousAmount.toLocaleString()} to ₦${newAmount.toLocaleString()}.`,
    );

    const disbursedAmount = this.resolveDisbursedAmount(updated);
    return {
      ...updated,
      amount: Number(updated.amount),
      disbursedAmount,
      remainingToDisburse: Math.max(Number(updated.amount) - disbursedAmount, 0),
      remainingBalance: Number(updated.remainingBalance),
      message: `Loan approved amount increased by ₦${deltaAmount.toLocaleString()}.`,
    };
  }

  async payLoanBond(id: string, actorId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new NotFoundException('Actor not found');

    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            wallet: true,
          },
        },
      },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (actor.role === 'MEMBER' && loan.member.userId !== actorId) {
      throw new ForbiddenException('You can only pay the loan bond for your own loan.');
    }
    if (loan.status !== 'APPROVED') {
      throw new BadRequestException('Loan bond can only be paid after the loan is approved and before disbursement.');
    }
    if (!this.loanRequiresBond(loan)) {
      throw new BadRequestException('Loan bond is not required for this loan.');
    }
    if ((loan as any).loanBondPaidAt || (loan as any).loanBondTransactionId) {
      throw new BadRequestException('Loan bond has already been paid for this loan.');
    }

    const amount = this.resolveStoredLoanBondAmount(loan) ?? (await this.getLoanBondAmount());
    const walletBalance = loan.member.wallet ? Number(loan.member.wallet.availableBalance) : 0;
    if (walletBalance < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Loan bond is ₦${amount.toLocaleString()} but wallet balance is ₦${walletBalance.toLocaleString()}.`,
      );
    }

    const reference = `LOAN-BOND-${loan.id}`;
    const paidAt = new Date();

    let result: { transaction: any };
    try {
      result = await this.prisma.runTransaction('loans.payLoanBond', async (tx) => {
      const currentLoan = await tx.loanApplication.findUnique({
        where: { id },
        include: {
          member: {
            include: {
              wallet: true,
            },
          },
        },
      });
      if (!currentLoan) throw new NotFoundException('Loan application not found');
      if (currentLoan.status !== 'APPROVED') {
        throw new BadRequestException('Loan bond can only be paid before disbursement.');
      }
      if (!this.loanRequiresBond(currentLoan)) {
        throw new BadRequestException('Loan bond is not required for this loan.');
      }
      if ((currentLoan as any).loanBondPaidAt || (currentLoan as any).loanBondTransactionId) {
        throw new BadRequestException('Loan bond has already been paid for this loan.');
      }

      const currentBalance = currentLoan.member.wallet ? Number(currentLoan.member.wallet.availableBalance) : 0;
      if (currentBalance < amount) {
        throw new BadRequestException(
          `Insufficient wallet balance. Loan bond is ₦${amount.toLocaleString()} but wallet balance is ₦${currentBalance.toLocaleString()}.`,
        );
      }

      const debit = await this.walletService.debitWalletInTransaction(tx, currentLoan.memberId, amount, 'LOAN_BOND', reference, {
        category: 'loan bond',
        description: `Loan bond payment for ${currentLoan.member.fullName}`,
        editable: false,
        lockReason: 'Loan bond transactions are tied to approved loan records and cannot be edited.',
        metadata: {
          loanId: currentLoan.id,
          memberId: currentLoan.memberId,
          membershipNumber: currentLoan.member.membershipNumber,
          paidBy: actor.role,
        },
      });

      const updatedLoan = await tx.loanApplication.updateMany({
        where: {
          id,
          status: 'APPROVED',
          loanBondRequired: true,
          loanBondPaidAt: null,
          loanBondTransactionId: null,
        } as any,
        data: {
          loanBondAmount: amount,
          loanBondPaidAt: paidAt,
          loanBondTransactionId: debit.transaction.id,
        },
      });
      if (updatedLoan.count !== 1) {
        throw new BadRequestException('Loan bond has already been paid for this loan.');
      }

        return { transaction: debit.transaction };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new BadRequestException('Loan bond has already been paid for this loan.');
      }
      throw error;
    }

    await this.audit.log(actorId, 'PAY_LOAN_BOND', 'LoanApplication', id, {
      amount,
      reference,
      transactionId: result.transaction.id,
      paidBy: actor.role,
    });

    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Bond Paid',
      `Loan bond of ₦${amount.toLocaleString()} has been paid. Your approved loan can now be disbursed.`,
    );

    return {
      ...(await this.findOne(id)),
      message: `Loan bond of ₦${amount.toLocaleString()} has been paid.`,
      reference,
    };
  }

  async disburse(id: string, actorId: string, dto: DisburseLoanDto) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: {
        member: true,
        bankAccount: true,
      },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (!['APPROVED', 'DISBURSED', 'IN_PROGRESS'].includes(loan.status)) {
      throw new BadRequestException('Loan must be approved, disbursed, or in progress before funds can be disbursed.');
    }
    if (this.loanRequiresBond(loan) && !(loan as any).loanBondPaidAt) {
      throw new BadRequestException('Loan bond must be paid before this loan can be disbursed.');
    }

    const approvedAmount = Number(loan.amount);
    const alreadyDisbursed = this.resolveDisbursedAmount(loan);
    const remainingToDisburse = Math.max(approvedAmount - alreadyDisbursed, 0);
    const disbursementAmount = normalizeMoney(dto.amount);
    if (!Number.isFinite(disbursementAmount) || disbursementAmount <= 0) {
      throw new BadRequestException('Enter a valid disbursement amount.');
    }
    if (remainingToDisburse <= 0) {
      throw new BadRequestException('This loan has already been fully disbursed.');
    }
    if (disbursementAmount > remainingToDisburse) {
      throw new BadRequestException(
        `Disbursement amount cannot exceed the remaining approved balance of ₦${remainingToDisburse.toLocaleString()}.`,
      );
    }
    await this.assertAssociationCanFundLoan(disbursementAmount, 'disburse');

    const now = new Date();
    const dueDate = loan.dueDate ?? this.addCalendarMonths(now, Math.max(loan.tenorMonths, 1));

    // Create a LOAN_DISBURSEMENT transaction for record-keeping only (no wallet credit)
    const reference = `LOAN-DISBURSE-${loan.id}-${Math.round(alreadyDisbursed * 100)}`;
    const wallet = await this.walletService.getMemberWallet(loan.memberId);

    let updated: any;
    try {
      updated = await this.prisma.runTransaction('loans.disburse', async (tx) => {
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'LOAN_DISBURSEMENT',
          amount: disbursementAmount,
          status: 'APPROVED',
          reference,
          category: 'loan disbursement',
          description: `Loan disbursement for ${loan.member.fullName} (bank transfer — no wallet credit)`,
          editable: false,
          lockReason: 'Loan disbursement transactions are tied to loan records and cannot be edited.',
          metadata: {
            loanId: loan.id,
            disbursedToBank: true,
            approvedAmount,
            previousDisbursedAmount: alreadyDisbursed,
            newDisbursedAmount: alreadyDisbursed + disbursementAmount,
          },
        },
      });

      await this.financialPosting.postAssociationOutflow(
        {
          amount: disbursementAmount,
          reference,
          sourceType: 'LoanApplication',
          sourceId: loan.id,
          description: `Loan disbursed to ${loan.member.fullName}`,
          actorId,
          memberId: loan.memberId,
          category: 'loan disbursement',
          enforceAvailable: true,
        },
        tx,
      );

      await tx.loanActivity.create({
        data: {
          loanId: id,
          type: 'DISBURSEMENT',
          previousAmount: alreadyDisbursed,
          newAmount: alreadyDisbursed + disbursementAmount,
          deltaAmount: disbursementAmount,
          actorId,
          metadata: {
            reference,
            approvedAmount,
            remainingToDisburseBefore: remainingToDisburse,
            remainingToDisburseAfter: remainingToDisburse - disbursementAmount,
          },
        } as any,
      });

      const updatedLoan = await tx.loanApplication.update({
        where: { id },
        data: {
          status: loan.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'DISBURSED',
          disbursedAt: loan.disbursedAt ?? now,
          dueDate,
          nextRepaymentAt:
            (loan as any).nextRepaymentAt ??
            this.addTenorStep(loan.disbursedAt ?? now, ((loan as any).tenorUnit ?? 'MONTHS') as LoanTenorUnit, 1),
          disbursedAmount: { increment: disbursementAmount },
          remainingBalance: { increment: disbursementAmount },
        } as any,
      });

      await this.walletService.rebuildLoanRepaymentSchedule(updatedLoan.id, tx);
      return updatedLoan;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new BadRequestException('This loan disbursement was already processed. Please refresh the loan details.');
      }
      throw error;
    }

    await this.audit.log(actorId, 'DISBURSE_LOAN', 'LoanApplication', id, {
      amount: disbursementAmount,
      reference,
      approvedAmount,
      previousDisbursedAmount: alreadyDisbursed,
    });

    // Build the disbursement message with bank details
    const bankName = loan.bankAccount?.bankName ?? 'N/A';
    const accountNumber = loan.bankAccount?.accountNumber ?? 'N/A';
    const message = `Loan disbursement of ₦${disbursementAmount.toLocaleString()} has been sent to ${loan.member.fullName}'s bank account (${bankName} - ${accountNumber}). The funds will reflect within 24 hours.`;

    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Disbursed',
      message,
    );

    const nextDisbursedAmount = this.resolveDisbursedAmount(updated);
    return {
      ...updated,
      amount: Number(updated.amount),
      disbursedAmount: nextDisbursedAmount,
      remainingToDisburse: Math.max(Number(updated.amount) - nextDisbursedAmount, 0),
      remainingBalance: Number(updated.remainingBalance),
      tenorUnit: (updated as any).tenorUnit ?? 'MONTHS',
      message,
      reference,
    };
  }

  async markInProgress(id: string, actorId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'DISBURSED') {
      throw new BadRequestException('Only disbursed loans can be marked as in progress.');
    }

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });

    await this.audit.log(actorId, 'MARK_LOAN_IN_PROGRESS', 'LoanApplication', id, {});

    return {
      ...updated,
      amount: Number(updated.amount),
      tenorUnit: (updated as any).tenorUnit ?? 'MONTHS',
      remainingBalance: Number(updated.remainingBalance),
    };
  }

  async updatePending(userId: string, id: string, dto: ApplyLoanDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const loan = await this.prisma.loanApplication.findUnique({ where: { id } });
    if (!loan || loan.memberId !== member.id) {
      throw new NotFoundException('Loan application not found');
    }
    if (loan.status !== 'PENDING') {
      throw new BadRequestException('Only pending loan applications can be edited.');
    }

    const nextTenorUnit = (dto.tenorUnit ?? (loan as any).tenorUnit ?? 'MONTHS') as LoanTenorUnit;
    const repaymentSchedule = dto.tenorMonths
      ? this.resolveRepaymentSchedule(dto.tenorMonths, nextTenorUnit, loan.submittedAt)
      : null;

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: {
        ...(dto.guarantorOneId !== undefined && { guarantorOneId: dto.guarantorOneId || null }),
        ...(dto.guarantorTwoId !== undefined && { guarantorTwoId: dto.guarantorTwoId || null }),
        ...(dto.amount !== undefined && { amount: normalizeMoney(dto.amount), remainingBalance: 0 }),
        ...(repaymentSchedule && { tenorMonths: repaymentSchedule.tenorMonths }),
        tenorUnit: repaymentSchedule?.tenorUnit ?? nextTenorUnit,
        ...(dto.purpose !== undefined && { purpose: dto.purpose }),
        ...(dto.bankAccountId !== undefined && { bankAccountId: dto.bankAccountId || null }),
      } as any,
    });

    await this.audit.log(userId, 'UPDATE_PENDING_LOAN', 'LoanApplication', id, {
      amount: dto.amount === undefined ? undefined : normalizeMoney(dto.amount),
      tenorMonths: dto.tenorMonths,
      tenorUnit: nextTenorUnit,
      repaymentInstallments: repaymentSchedule?.installments ?? loan.tenorMonths,
    });

    return {
      ...updated,
      amount: Number(updated.amount),
      tenorUnit: (updated as any).tenorUnit ?? 'MONTHS',
      remainingBalance: 0,
    };
  }

  async removePending(userId: string, id: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const loan = await this.prisma.loanApplication.findUnique({ where: { id } });
    if (!loan || loan.memberId !== member.id) {
      throw new NotFoundException('Loan application not found');
    }
    if (loan.status !== 'PENDING') {
      throw new BadRequestException('Only pending loan applications can be deleted.');
    }

    await this.prisma.loanApplication.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE_PENDING_LOAN', 'LoanApplication', id, {});

    return { success: true };
  }

  // ─── Repay loan ────────────────────────────────────────────────────
  async repay(userId: string, id: string, dto: RepayLoanDto) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: { wallet: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const loan = await this.prisma.loanApplication.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== 'DISBURSED' && loan.status !== 'IN_PROGRESS' && loan.status !== 'OVERDUE') {
      throw new BadRequestException('This loan is not currently active for repayment.');
    }
    if (loan.memberId !== member.id) throw new BadRequestException('You can only repay your own loans.');

    const amount = normalizeMoney(dto.amount);
    const walletBalance = member.wallet ? Number(member.wallet.availableBalance) : 0;
    if (walletBalance < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. You need ₦${formatMoney(amount)} but your balance is ₦${formatMoney(walletBalance)}. Please fund your wallet first.`,
      );
    }

    const repayableBalance = Number(loan.remainingBalance);
    if (amount > repayableBalance) {
      throw new BadRequestException(`Repayment amount cannot exceed the outstanding balance of ₦${formatMoney(repayableBalance)}.`);
    }

    const repayment = await this.walletService.applyLoanRepayment(member.id, loan.id, amount, 'MEMBER');
    const newRemainingBalance = normalizeMoney(repayableBalance - amount);
    const isFullyRepaid = this.isRepaymentFullySettled(newRemainingBalance);

    await this.audit.log(userId, 'REPAY_LOAN', 'LoanApplication', id, {
      amount,
      reference: repayment.reference,
    });

    if (isFullyRepaid) {
      await this.notifications.notifyMember(
        userId,
        'Loan Fully Repaid',
        `Congratulations! Your loan of ₦${formatMoney(loan.amount)} has been fully repaid. Thank you, ${member.fullName}!`,
      );
    }

    const remaining = isFullyRepaid ? 0 : Math.max(newRemainingBalance, 0);
    return {
      message: isFullyRepaid
        ? `Congratulations! Your loan has been fully repaid. Thank you, ${member.fullName}!`
        : `Payment of ₦${formatMoney(amount)} received. Remaining balance: ₦${formatMoney(remaining)}. Thank you, ${member.fullName}!`,
      amount,
      remainingBalance: remaining,
      reference: repayment.reference,
      status: isFullyRepaid ? 'COMPLETED' : 'IN_PROGRESS',
    };
  }

  async repayAsAdmin(id: string, actorId: string, dto: RepayLoanDto) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!loan) throw new NotFoundException('Loan not found');
    if (!['DISBURSED', 'IN_PROGRESS', 'OVERDUE'].includes(loan.status)) {
      throw new BadRequestException('This loan is not currently active for repayment.');
    }

    const amount = normalizeMoney(dto.amount);
    const walletBalance = loan.member.wallet ? Number(loan.member.wallet.availableBalance) : 0;
    if (walletBalance < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Member wallet balance is ₦${formatMoney(walletBalance)}.`,
      );
    }

    const repayableBalance = Number(loan.remainingBalance);
    if (amount > repayableBalance) {
      throw new BadRequestException(`Repayment amount cannot exceed the outstanding balance of ₦${formatMoney(repayableBalance)}.`);
    }

    const repayment = await this.walletService.applyLoanRepayment(loan.memberId, loan.id, amount, 'ADMIN');
    const remainingBeforeNormalization = normalizeMoney(repayableBalance - amount);
    const isFullyRepaid = this.isRepaymentFullySettled(remainingBeforeNormalization);
    const remaining = isFullyRepaid ? 0 : Math.max(remainingBeforeNormalization, 0);

    await this.audit.log(actorId, 'ADMIN_REPAY_LOAN', 'LoanApplication', id, {
      amount,
      reference: repayment.reference,
    });

    return {
      amount,
      remainingBalance: remaining,
      reference: repayment.reference,
      status: isFullyRepaid ? 'COMPLETED' : 'IN_PROGRESS',
    };
  }

  // ─── Overdue check helper ──────────────────────────────────────────
  private async updateOverdueLoans() {
    const now = new Date();
    await this.prisma.loanApplication.updateMany({
      where: {
        status: { in: ['DISBURSED', 'IN_PROGRESS'] },
        nextRepaymentAt: { lt: now },
        remainingBalance: { gt: 0 },
      },
      data: { status: 'OVERDUE' },
    } as any);
  }

  private async getLoanBondAmount(client: any = this.prisma) {
    const config = await client.systemConfig.upsert({
      where: { key: LOAN_BOND_AMOUNT_KEY },
      update: {},
      create: { key: LOAN_BOND_AMOUNT_KEY, value: String(DEFAULT_LOAN_BOND_AMOUNT) },
    });
    const amount = Number(config.value);
    return Number.isFinite(amount) && amount > 0 ? amount : DEFAULT_LOAN_BOND_AMOUNT;
  }

  private resolveStoredLoanBondAmount(loan: Pick<LoanLike, 'loanBondAmount'>) {
    const amount = Number((loan as any).loanBondAmount ?? 0);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  private loanRequiresBond(loan: unknown) {
    return Boolean((loan as any).loanBondRequired);
  }

  private isLoanBondPaid(loan: unknown) {
    return Boolean((loan as any).loanBondPaidAt || (loan as any).loanBondTransactionId);
  }

  private isRepaymentFullySettled(remainingBalance: number) {
    return normalizeMoney(Math.max(remainingBalance, 0)) <= MONEY_COMPLETION_TOLERANCE;
  }

  private shouldExposeRemainingBalance(status: LoanStatus) {
    return ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(status);
  }

  private resolveDisbursedAmount(loan: Pick<LoanLike, 'amount' | 'disbursedAmount' | 'status'>) {
    const explicitAmount = Number((loan as any).disbursedAmount ?? 0);
    if (explicitAmount > 0) return explicitAmount;
    const increaseActivities = Array.isArray((loan as any).activities)
      ? (loan as any).activities.filter((activity: any) => activity.type === 'AMOUNT_INCREASE')
      : [];
    const firstIncreasePreviousAmount = increaseActivities.length
      ? Number(increaseActivities[0].previousAmount ?? 0)
      : 0;
    if (firstIncreasePreviousAmount > 0 && ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(loan.status)) {
      return firstIncreasePreviousAmount;
    }
    return ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(loan.status)
      ? Number(loan.amount)
      : 0;
  }

  private calculateRepaymentProgress(loan: Pick<LoanLike, 'amount' | 'disbursedAmount' | 'remainingBalance' | 'status'>) {
    const amount = this.resolveDisbursedAmount(loan);
    const remaining = Number(loan.remainingBalance);
    if (amount <= 0 || !this.shouldExposeRemainingBalance(loan.status)) return 0;
    if (loan.status === 'COMPLETED' || this.isRepaymentFullySettled(remaining)) return 100;
    if (remaining <= 0) return amount >= Number(loan.amount) ? 100 : 99.9;
    const paid = Math.max(amount - remaining, 0);
    const raw = Math.min((paid / amount) * 100, 99.9);
    return Math.round(raw * 10) / 10;
  }

  private resolveRepaymentSchedule(tenorMonths: number, tenorUnit: LoanTenorUnit, anchorDate: Date) {
    const requestedMonths = Math.max(Math.ceil(Number(tenorMonths) || 1), 1);
    const normalizedTenorUnit = tenorUnit === 'WEEKS' ? 'WEEKS' : 'MONTHS';
    const maturityDate = this.addCalendarMonths(anchorDate, requestedMonths);

    if (normalizedTenorUnit === 'WEEKS') {
      const installments = Math.max(
        Math.ceil((maturityDate.getTime() - anchorDate.getTime()) / 604_800_000),
        1,
      );
      return {
        installments,
        tenorMonths: requestedMonths,
        tenorUnit: 'WEEKS' as LoanTenorUnit,
        maturityDate,
      };
    }

    return {
      installments: requestedMonths,
      tenorMonths: requestedMonths,
      tenorUnit: 'MONTHS' as LoanTenorUnit,
      maturityDate,
    };
  }

  private resolveInstallmentCount(anchorDate: Date, maturityDate: Date, tenorMonths: number, tenorUnit: LoanTenorUnit) {
    if (tenorUnit === 'WEEKS') {
      return Math.max(Math.ceil((maturityDate.getTime() - anchorDate.getTime()) / 604_800_000), 1);
    }

    return Math.max(Math.ceil(Number(tenorMonths) || 1), 1);
  }

  private async assertAssociationCanFundLoan(amount: number, action: 'approve' | 'disburse') {
    const wallet = await this.financialPosting.ensureWallet();
    const available = Number((wallet as any).associationAvailableBalance ?? wallet.balance ?? 0);
    if (available < amount) {
      throw new BadRequestException(
        `Association balance is not sufficient to ${action} this loan. Available balance: ₦${available.toLocaleString()}.`,
      );
    }
  }

  private buildTimeline(
    loan: LoanLike,
    relatedTransactions: Array<{ type: string; status: string; createdAt: Date; amount: any; reference?: string | null }>,
  ) {
    const loanBondRequired = this.loanRequiresBond(loan);
    const loanBondPaid = this.isLoanBondPaid(loan);
    const baseTimeline = [
      {
        label: 'Applied',
        date: loan.submittedAt,
        status: 'COMPLETED',
      },
      {
        label: 'Approved',
        date: loan.approvedAt ?? null,
        status: loan.approvedAt
          ? 'COMPLETED'
          : loan.status === 'REJECTED'
            ? 'CANCELLED'
            : loan.status === 'PENDING'
              ? 'CURRENT'
              : 'UPCOMING',
      },
      ...(loanBondRequired
        ? [
            {
              label: 'Loan bond',
              date: loanBondPaid ? null : loan.approvedAt ?? null,
              status: loanBondPaid
                ? 'COMPLETED'
                : loan.status === 'APPROVED'
                  ? 'CURRENT'
                  : loan.status === 'REJECTED'
                    ? 'CANCELLED'
                    : 'UPCOMING',
            },
          ]
        : []),
      {
        label: 'Disbursed',
        date: loan.disbursedAt ?? loan.approvedAt ?? null,
        status: loan.disbursedAt
          ? 'COMPLETED'
          : ['APPROVED'].includes(loan.status) && (!loanBondRequired || loanBondPaid)
            ? 'CURRENT'
            : ['PENDING', 'REJECTED'].includes(loan.status)
              ? 'UPCOMING'
              : 'UPCOMING',
      },
      {
        label: 'Repayment',
        date: loan.nextRepaymentAt ?? loan.dueDate ?? loan.disbursedAt ?? null,
        status:
          loan.status === 'COMPLETED'
            ? 'COMPLETED'
            : loan.status === 'OVERDUE'
              ? 'OVERDUE'
              : ['DISBURSED', 'IN_PROGRESS'].includes(loan.status)
                ? 'CURRENT'
                : loan.status === 'REJECTED'
                  ? 'CANCELLED'
                  : 'UPCOMING',
      },
      {
        label: loan.status === 'REJECTED' ? 'Rejected' : 'Completed',
        date: loan.status === 'REJECTED' ? loan.rejectedAt ?? loan.submittedAt : loan.dueDate ?? null,
        status:
          loan.status === 'REJECTED'
            ? 'COMPLETED'
            : loan.status === 'COMPLETED'
              ? 'COMPLETED'
              : 'UPCOMING',
      },
    ].filter((item) => item.date);

    const disbursements = relatedTransactions
      .filter((item) => item.type === 'LOAN_DISBURSEMENT')
      .map((item) => ({
        label: 'Disbursement posted',
        date: item.createdAt,
        status: 'SUCCESSFUL',
        amount: Number(item.amount),
        reference: item.reference,
      }));

    const bondPayments = relatedTransactions
      .filter((item) => item.type === 'LOAN_BOND')
      .map((item) => ({
        label: 'Loan bond paid',
        date: item.createdAt,
        status: item.status,
        amount: Number(item.amount),
        reference: item.reference,
      }));

    const repayments = relatedTransactions
      .filter((item) => item.type === 'LOAN_REPAYMENT')
      .map((item) => ({
        label: 'Repayment posted',
        date: item.createdAt,
        status: item.status,
        amount: Number(item.amount),
        reference: item.reference,
      }));

    const refunds = relatedTransactions
      .filter((item) => item.type === 'ADMIN_REFUND')
      .map((item) => ({
        label: 'Loan bond refunded',
        date: item.createdAt,
        status: item.status,
        amount: Number(item.amount),
        reference: item.reference,
      }));

    const withoutCompletion = baseTimeline.filter((item) => item.label !== 'Completed');
    const completion = baseTimeline.find((item) => item.label === 'Completed');
    const moneyEvents = [...bondPayments, ...refunds, ...disbursements, ...repayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const stageEvents = withoutCompletion.filter((item) => item.label !== 'Repayment');
    const repaymentStage = withoutCompletion.find((item) => item.label === 'Repayment');
    return completion
      ? [...stageEvents, ...moneyEvents, ...(repaymentStage ? [repaymentStage] : []), completion]
      : [...stageEvents, ...moneyEvents, ...(repaymentStage ? [repaymentStage] : [])];
  }

  private addTenorStep(date: Date, tenorUnit: LoanTenorUnit, steps: number) {
    const next = new Date(date);
    if (tenorUnit === 'WEEKS') {
      next.setDate(next.getDate() + steps * 7);
      return next;
    }

    next.setMonth(next.getMonth() + steps);
    return next;
  }

  private addCalendarMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }
}
