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
import { ApplyLoanDto, QueryLoansDto, RepayLoanDto } from './dto/index';
import type { LoanStatus } from '@prisma/client';

type LoanLike = {
  amount: any;
  remainingBalance: any;
  tenorMonths: number;
  submittedAt: Date;
  approvedAt?: Date | null;
  disbursedAt?: Date | null;
  rejectedAt?: Date | null;
  dueDate?: Date | null;
  status: LoanStatus;
};

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  // ─── Apply for a loan ──────────────────────────────────────────────
  async apply(userId: string, dto: ApplyLoanDto) {
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

    if (existingActiveLoan) {
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

    const loan = await this.prisma.loanApplication.create({
      data: {
        memberId: member.id,
        guarantorOneId: dto.guarantorOneId,
        guarantorTwoId: dto.guarantorTwoId,
        amount: dto.amount,
        tenorMonths: dto.tenorMonths,
        purpose: dto.purpose,
        remainingBalance: dto.amount,
        bankAccountId: dto.bankAccountId,
      },
    });

    await this.audit.log(userId, 'APPLY_LOAN', 'LoanApplication', loan.id, {
      amount: dto.amount,
      tenorMonths: dto.tenorMonths,
    });

    return {
      ...loan,
      amount: Number(loan.amount),
      message: `Loan application for ₦${Number(loan.amount).toLocaleString()} from ${member.fullName} has been submitted successfully. Your application is currently being reviewed.`,
    };
  }

  // ─── List loans ────────────────────────────────────────────────────
  async findAll(userId: string, query: QueryLoansDto) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    let memberId: string | undefined;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'MEMBER') {
      const member = await this.prisma.member.findUnique({ where: { userId } });
      memberId = member?.id;
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (memberId) where.memberId = memberId;

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
        },
      }),
      this.prisma.loanApplication.count({ where }),
    ]);

    return {
      items: items.map((l) => ({
        ...l,
        amount: Number(l.amount),
        remainingBalance: this.shouldExposeRemainingBalance(l.status) ? Number(l.remainingBalance) : 0,
        amountPaidSoFar: this.shouldExposeRemainingBalance(l.status)
          ? Math.max(Number(l.amount) - Number(l.remainingBalance), 0)
          : 0,
        repaymentProgress:
          Number(l.amount) > 0 && this.shouldExposeRemainingBalance(l.status)
            ? Math.min(
                (Math.max(Number(l.amount) - Number(l.remainingBalance), 0) / Number(l.amount)) * 100,
                100,
              )
            : l.status === 'COMPLETED'
              ? 100
              : 0,
        canEdit: l.status === 'PENDING',
        canDelete: l.status === 'PENDING',
      })),
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
      },
    });

    if (!loan) throw new NotFoundException('Loan application not found');

    const relatedTransactions = loan.member.wallet
      ? await this.prisma.transaction.findMany({
          where: {
            walletId: loan.member.wallet.id,
            OR: [
              { metadata: { path: ['loanId'], equals: loan.id } },
              { type: 'LOAN_DISBURSEMENT' },
              { type: 'LOAN_REPAYMENT' },
            ],
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const amount = Number(loan.amount);
    const remainingBalance = this.shouldExposeRemainingBalance(loan.status) ? Number(loan.remainingBalance) : 0;
    const amountPaidSoFar = this.shouldExposeRemainingBalance(loan.status) ? Math.max(amount - Number(loan.remainingBalance), 0) : 0;
    const repaymentProgress = amount > 0 ? Math.min((amountPaidSoFar / amount) * 100, 100) : 0;
    const installmentAmount = loan.tenorMonths > 0 ? amount / loan.tenorMonths : amount;
    const paymentSchedule = Array.from({ length: Math.max(loan.tenorMonths, 1) }).map((_, index) => {
      const anchorDate = loan.disbursedAt ?? loan.approvedAt ?? loan.submittedAt;
      const dueDate = new Date(anchorDate);
      dueDate.setMonth(dueDate.getMonth() + index + 1);
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
        status,
      };
    });

    const timeline = this.buildTimeline(loan, relatedTransactions);

    return {
      ...loan,
      amount,
      remainingBalance,
      amountPaidSoFar,
      repaymentProgress,
      paymentSchedule,
      timeline,
      relatedTransactions: relatedTransactions.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
      canEdit: loan.status === 'PENDING',
      canDelete: loan.status === 'PENDING',
    };
  }

  // ─── Approve loan ──────────────────────────────────────────────────
  async approve(id: string, actorId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'PENDING') throw new BadRequestException('Only pending loan applications can be approved.');

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });

    await this.audit.log(actorId, 'APPROVE_LOAN', 'LoanApplication', id, {
      amount: Number(loan.amount),
    });

    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Approved',
      `Your loan application for ₦${Number(loan.amount).toLocaleString()} has been approved. Awaiting disbursement.`,
    );

    const amount = Number(updated.amount);
    return {
      ...updated,
      amount,
      message: `Loan application for ₦${amount.toLocaleString()} from ${loan.member.fullName} has been approved. Awaiting disbursement.`,
    };
  }

  // ─── Reject loan ───────────────────────────────────────────────────
  async reject(id: string, actorId: string, reason?: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'APPROVED' && loan.status !== 'PENDING') {
      throw new BadRequestException('Only pending or approved loan applications can be rejected.');
    }

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    });

    await this.audit.log(actorId, 'REJECT_LOAN', 'LoanApplication', id, { reason });

    const rejectReason = reason ? ` Reason: ${reason}` : '';
    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Rejected',
      `Your loan application for ₦${Number(loan.amount).toLocaleString()} has been rejected.${rejectReason}`,
    );

    const amount = Number(updated.amount);
    return {
      ...updated,
      amount,
      message: `Loan application for ₦${amount.toLocaleString()} from ${loan.member.fullName} has been rejected.${rejectReason}`,
    };
  }

  // ─── Disburse loan — NO wallet credit ──────────────────────────────
  async disburse(id: string, actorId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: {
        member: true,
        bankAccount: true,
      },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'APPROVED') throw new BadRequestException('Loan must be approved before it can be disbursed.');

    // Compute dueDate: approvedAt + tenorMonths
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + loan.tenorMonths);

    // Create a LOAN_DISBURSEMENT transaction for record-keeping only (no wallet credit)
    const reference = `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const wallet = await this.walletService.getMemberWallet(loan.memberId);

    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'LOAN_DISBURSEMENT',
        amount: Number(loan.amount),
        status: 'APPROVED',
        reference,
        category: 'loan disbursement',
        description: `Loan disbursement for ${loan.member.fullName} (bank transfer — no wallet credit)`,
        editable: false,
        lockReason: 'Loan disbursement transactions are tied to loan records and cannot be edited.',
        metadata: {
          loanId: loan.id,
          disbursedToBank: true,
        },
      },
    });

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: {
        status: 'DISBURSED',
        disbursedAt: new Date(),
        dueDate,
        remainingBalance: loan.amount,
      },
    });

    await this.audit.log(actorId, 'DISBURSE_LOAN', 'LoanApplication', id, {
      amount: Number(loan.amount),
      reference,
    });

    // Build the disbursement message with bank details
    const amount = Number(loan.amount);
    const bankName = loan.bankAccount?.bankName ?? 'N/A';
    const accountNumber = loan.bankAccount?.accountNumber ?? 'N/A';
    const message = `Loan of ₦${amount.toLocaleString()} has been disbursed to ${loan.member.fullName}'s bank account (${bankName} - ${accountNumber}). The funds will reflect within 24 hours.`;

    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Disbursed',
      message,
    );

    return {
      ...updated,
      amount,
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

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: {
        guarantorOneId: dto.guarantorOneId || null,
        guarantorTwoId: dto.guarantorTwoId || null,
        amount: dto.amount,
        tenorMonths: dto.tenorMonths,
        purpose: dto.purpose,
        remainingBalance: dto.amount,
        bankAccountId: dto.bankAccountId || null,
      },
    });

    await this.audit.log(userId, 'UPDATE_PENDING_LOAN', 'LoanApplication', id, {
      amount: dto.amount,
      tenorMonths: dto.tenorMonths,
    });

    return {
      ...updated,
      amount: Number(updated.amount),
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

    const walletBalance = member.wallet ? Number(member.wallet.availableBalance) : 0;
    if (walletBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. You need ₦${dto.amount.toLocaleString()} but your balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet first.`,
      );
    }

    const reference = `REPAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await this.walletService.debitWallet(member.id, dto.amount, 'LOAN_REPAYMENT', reference, {
      category: 'loan repayment',
      description: `Loan repayment for loan ${loan.id}`,
      editable: false,
      lockReason: 'Loan repayment transactions are system-generated and cannot be edited.',
      metadata: { loanId: loan.id },
    });

    const newRemainingBalance = Number(loan.remainingBalance) - dto.amount;
    const isFullyRepaid = newRemainingBalance <= 0;

    await this.prisma.loanApplication.update({
      where: { id },
      data: {
        remainingBalance: {
          decrement: dto.amount,
        },
        ...(isFullyRepaid ? { status: 'COMPLETED' } : { status: 'IN_PROGRESS' }),
      },
    });

    await this.audit.log(userId, 'REPAY_LOAN', 'LoanApplication', id, {
      amount: dto.amount,
      reference,
    });

    if (isFullyRepaid) {
      await this.notifications.notifyMember(
        userId,
        'Loan Fully Repaid',
        `Congratulations! Your loan of ₦${Number(loan.amount).toLocaleString()} has been fully repaid. Thank you, ${member.fullName}!`,
      );
    }

    const remaining = Math.max(newRemainingBalance, 0);
    return {
      message: isFullyRepaid
        ? `Congratulations! Your loan has been fully repaid. Thank you, ${member.fullName}!`
        : `Payment of ₦${dto.amount.toLocaleString()} received. Remaining balance: ₦${remaining.toLocaleString()}. Thank you, ${member.fullName}!`,
      amount: dto.amount,
      remainingBalance: remaining,
      reference,
      status: isFullyRepaid ? 'COMPLETED' : 'IN_PROGRESS',
    };
  }

  // ─── Overdue check helper ──────────────────────────────────────────
  private async updateOverdueLoans() {
    const now = new Date();
    await this.prisma.loanApplication.updateMany({
      where: {
        status: { in: ['DISBURSED', 'IN_PROGRESS'] },
        dueDate: { lt: now },
        remainingBalance: { gt: 0 },
      },
      data: { status: 'OVERDUE' },
    });
  }

  private shouldExposeRemainingBalance(status: LoanStatus) {
    return ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(status);
  }

  private buildTimeline(
    loan: LoanLike,
    relatedTransactions: Array<{ type: string; status: string; createdAt: Date; amount: any; reference?: string | null }>,
  ) {
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
      {
        label: 'Disbursed',
        date: loan.disbursedAt ?? loan.approvedAt ?? null,
        status: loan.disbursedAt
          ? 'COMPLETED'
          : ['APPROVED'].includes(loan.status)
            ? 'CURRENT'
            : ['PENDING', 'REJECTED'].includes(loan.status)
              ? 'UPCOMING'
              : 'UPCOMING',
      },
      {
        label: 'Repayment',
        date: loan.disbursedAt ?? loan.dueDate ?? null,
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

    const repayments = relatedTransactions
      .filter((item) => item.type === 'LOAN_REPAYMENT')
      .map((item) => ({
        label: 'Repayment posted',
        date: item.createdAt,
        status: item.status,
        amount: Number(item.amount),
        reference: item.reference,
      }));

    return [...baseTimeline, ...repayments];
  }
}
