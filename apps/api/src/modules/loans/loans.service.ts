import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { NotificationService } from '../../common/services/notification.service';
import { AuditService } from '../../common/services/audit.service';
import { ApplyLoanDto, QueryLoansDto, RepayLoanDto } from './dto';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async apply(userId: string, dto: ApplyLoanDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const loan = await this.prisma.loanApplication.create({
      data: {
        memberId: member.id,
        amount: dto.amount,
        tenorMonths: dto.tenorMonths,
        purpose: dto.purpose,
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
        },
      }),
      this.prisma.loanApplication.count({ where }),
    ]);

    return {
      items: items.map((l) => ({
        ...l,
        amount: Number(l.amount),
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
          },
        },
      },
    });

    if (!loan) throw new NotFoundException('Loan application not found');

    return {
      ...loan,
      amount: Number(loan.amount),
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
      data: { status: 'APPROVED' },
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
      data: { status: 'REJECTED' },
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
    await this.walletService.creditWallet(
      loan.memberId,
      Number(loan.amount),
      'LOAN_DISBURSEMENT',
      reference,
    );

    await this.audit.log(actorId, 'DISBURSE_LOAN', 'LoanApplication', id, {
      amount: Number(loan.amount),
      reference,
    });

    await this.notifications.notifyMember(
      loan.member.userId,
      'Loan Disbursed',
      `₦${Number(loan.amount).toLocaleString()} has been credited to your wallet.`,
    );

    return { message: 'Loan disbursed successfully', reference };
  }

  async repay(userId: string, id: string, dto: RepayLoanDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member not found');

    const loan = await this.prisma.loanApplication.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== 'APPROVED') throw new BadRequestException('Loan is not active');
    if (loan.memberId !== member.id) throw new BadRequestException('Not your loan');

    const reference = `REPAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await this.walletService.debitWallet(member.id, dto.amount, 'LOAN_REPAYMENT', reference);

    await this.audit.log(userId, 'REPAY_LOAN', 'LoanApplication', id, {
      amount: dto.amount,
      reference,
    });

    return { message: 'Loan repayment successful', amount: dto.amount, reference };
  }
}
