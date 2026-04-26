import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { NotificationService } from '../../common/services/notification.service';
import { AuditService } from '../../common/services/audit.service';
import { ApplyLoanDto, QueryLoansDto, RepayLoanDto } from './dto/index';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async apply(userId: string, dto: ApplyLoanDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const member =
      user?.role === 'SUPER_ADMIN' && dto.memberId
        ? await this.prisma.member.findUnique({ where: { id: dto.memberId } })
        : await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const existingActiveLoan = await this.prisma.loanApplication.findFirst({
      where: {
        memberId: member.id,
        OR: [
          { status: 'APPROVED', remainingBalance: { gt: 0 } },
          { disbursedAt: { not: null }, remainingBalance: { gt: 0 } },
        ],
      },
      orderBy: { submittedAt: 'desc' },
    });

    if (existingActiveLoan) {
      throw new BadRequestException('This member has an active loan. Please repay it before applying for a new one.');
    }

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
      if (!guarantor) {
        throw new NotFoundException('Selected guarantor 1 does not exist.');
      }
    }

    if (dto.guarantorTwoId) {
      const guarantor = await this.prisma.member.findUnique({ where: { id: dto.guarantorTwoId } });
      if (!guarantor) {
        throw new NotFoundException('Selected guarantor 2 does not exist.');
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
      },
    });

    await this.audit.log(userId, 'APPLY_LOAN', 'LoanApplication', loan.id, {
      amount: dto.amount,
      tenorMonths: dto.tenorMonths,
    });

    return {
      ...loan,
      amount: Number(loan.amount),
    };
  }

  async findAll(userId: string, query: QueryLoansDto) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Members can only see their own loans; admins see all
    let memberId: string | undefined;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'MEMBER') {
      const member = await this.prisma.member.findUnique({ where: { userId } });
      memberId = member?.id;
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (memberId) where.memberId = memberId;

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
        },
      }),
      this.prisma.loanApplication.count({ where }),
    ]);

    return {
      items: items.map((l) => ({
        ...l,
        amount: Number(l.amount),
        remainingBalance: Number(l.remainingBalance),
        lifecycleStatus: l.disbursedAt ? 'DISBURSED' : l.status,
        amountPaidSoFar: Math.max(Number(l.amount) - Number(l.remainingBalance), 0),
        repaymentProgress:
          Number(l.amount) > 0
            ? Math.min((Math.max(Number(l.amount) - Number(l.remainingBalance), 0) / Number(l.amount)) * 100, 100)
            : 0,
      })),
      total,
      page,
      limit,
    };
  }

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
    const remainingBalance = Number(loan.remainingBalance);
    const amountPaidSoFar = Math.max(amount - remainingBalance, 0);
    const repaymentProgress = amount > 0 ? Math.min((amountPaidSoFar / amount) * 100, 100) : 0;
    const installmentAmount = loan.tenorMonths > 0 ? amount / loan.tenorMonths : amount;

    const paymentSchedule = Array.from({ length: Math.max(loan.tenorMonths, 1) }).map((_, index) => {
      const anchorDate = loan.disbursedAt ?? loan.approvedAt ?? loan.submittedAt;
      const dueDate = new Date(anchorDate);
      dueDate.setMonth(dueDate.getMonth() + index + 1);
      const dueAmount = Math.round(installmentAmount * 100) / 100;
      const cumulativeDue = dueAmount * (index + 1);

      return {
        installment: index + 1,
        dueDate,
        amount: dueAmount,
        status: amountPaidSoFar >= cumulativeDue ? 'PAID' : 'UNPAID',
      };
    });

    const timeline = [
      { label: 'Applied', date: loan.submittedAt, status: 'completed' },
      loan.approvedAt ? { label: 'Approved', date: loan.approvedAt, status: 'completed' } : null,
      loan.disbursedAt ? { label: 'Disbursed', date: loan.disbursedAt, status: 'completed' } : null,
      loan.rejectedAt ? { label: 'Rejected', date: loan.rejectedAt, status: 'completed' } : null,
      ...relatedTransactions
        .filter((item) => item.type === 'LOAN_REPAYMENT')
        .map((item) => ({
          label: 'Repayment',
          date: item.createdAt,
          status: item.status.toLowerCase(),
          amount: Number(item.amount),
          reference: item.reference,
        })),
    ].filter(Boolean);

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
    };
  }

  async approve(id: string, actorId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'PENDING') throw new BadRequestException('Loan is not pending');

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
      `Your loan application for ₦${Number(loan.amount).toLocaleString()} has been approved.`,
    );

    return { ...updated, amount: Number(updated.amount) };
  }

  async reject(id: string, actorId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'APPROVED' && loan.status !== 'PENDING') {
      throw new BadRequestException('Loan cannot be rejected in current status');
    }

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    });

    await this.audit.log(actorId, 'REJECT_LOAN', 'LoanApplication', id);

    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Rejected',
      `Your loan application for ₦${Number(loan.amount).toLocaleString()} has been rejected.`,
    );

    return { ...updated, amount: Number(updated.amount) };
  }

  async disburse(id: string, actorId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!loan) throw new NotFoundException('Loan application not found');
    if (loan.status !== 'APPROVED') throw new BadRequestException('Loan must be approved first');

    const reference = `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await this.walletService.creditWallet(loan.memberId, Number(loan.amount), 'LOAN_DISBURSEMENT', reference, {
      category: 'loan disbursement',
      description: `Loan disbursement for ${loan.member.fullName}`,
      editable: false,
      lockReason: 'Loan disbursement transactions are tied to loan records and cannot be edited.',
      metadata: { loanId: loan.id },
    });

    const updated = await this.prisma.loanApplication.update({
      where: { id },
      data: {
        disbursedAt: new Date(),
        remainingBalance: loan.amount,
      },
    });

    await this.audit.log(actorId, 'DISBURSE_LOAN', 'LoanApplication', id, {
      amount: Number(loan.amount),
      reference,
    });

    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Disbursed',
      `₦${Number(loan.amount).toLocaleString()} has been credited to your wallet.`,
    );

    return { ...updated, amount: Number(updated.amount), message: 'Loan disbursed successfully', reference };
  }

  async repay(userId: string, id: string, dto: RepayLoanDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member not found');

    const loan = await this.prisma.loanApplication.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (!loan.disbursedAt) throw new BadRequestException('Loan is not active until it has been disbursed');
    if (loan.memberId !== member.id) throw new BadRequestException('Not your loan');

    const reference = `REPAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await this.walletService.debitWallet(member.id, dto.amount, 'LOAN_REPAYMENT', reference, {
      category: 'loan repayment',
      description: `Loan repayment for loan ${loan.id}`,
      editable: false,
      lockReason: 'Loan repayment transactions are system-generated and cannot be edited.',
      metadata: { loanId: loan.id },
    });

    await this.prisma.loanApplication.update({
      where: { id },
      data: {
        remainingBalance: {
          decrement: dto.amount,
        },
      },
    });

    await this.audit.log(userId, 'REPAY_LOAN', 'LoanApplication', id, {
      amount: dto.amount,
      reference,
    });

    return { message: 'Loan repayment successful', amount: dto.amount, reference };
  }
}
