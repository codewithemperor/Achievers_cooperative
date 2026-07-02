import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { AuditService } from '../../common/services/audit.service';
import { FinancialPostingService } from '../../common/services/financial-posting.service';
import { NotificationService } from '../../common/services/notification.service';
import { ContributeSavingsDto, RequestSavingsWithdrawalDto } from './dto/index';
import { normalizeMoney } from '../../common/utils/money';

@Injectable()
export class SavingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WalletService) private readonly walletService: WalletService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FinancialPostingService) private readonly financialPosting: FinancialPostingService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  async getMySavings(userId: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const accounts = await this.prisma.savingsAccount.findMany({
      where: { memberId: member.id },
      orderBy: { id: 'desc' },
    });

    return accounts.map((a) => ({
      ...a,
      balance: Number(a.balance),
    }));
  }

  async getMyWithdrawalRequests(userId: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const items = await (this.prisma as any).savingsWithdrawalRequest.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: items.map((item: any) => ({
        ...item,
        amount: Number(item.amount),
      })),
    };
  }

  async contribute(userId: string, dto: ContributeSavingsDto) {
    const amount = normalizeMoney(dto.amount);
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const result = await this.walletService.applySavingsContribution(member.id, amount, 'MEMBER');

    await this.audit.log(userId, 'SAVINGS_CONTRIBUTION', 'SavingsAccount', result.account.id, {
      amount,
      newBalance: Number(result.account.balance),
    });

    return {
      account: {
        id: result.account.id,
        balance: Number(result.account.balance),
        contributionFrequency: result.account.contributionFrequency,
      },
      amount,
      reference: result.reference,
    };
  }

  async requestWithdrawal(userId: string, dto: RequestSavingsWithdrawalDto) {
    const amount = normalizeMoney(dto.amount);
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const account =
      (dto.savingsAccountId
        ? await this.prisma.savingsAccount.findUnique({ where: { id: dto.savingsAccountId } })
        : await this.prisma.savingsAccount.findFirst({ where: { memberId: member.id } })) ?? null;

    if (!account || account.memberId !== member.id) {
      throw new BadRequestException('Savings account not found.');
    }

    if (Number(account.balance) < amount) {
      throw new BadRequestException('Insufficient savings balance for this withdrawal request.');
    }

    const selectedBankAccount = dto.bankAccountId
      ? await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } })
      : await this.prisma.bankAccount.findFirst({
          where: { memberId: member.id, isDefault: true },
          orderBy: { createdAt: 'desc' },
        });

    if (selectedBankAccount && selectedBankAccount.memberId !== member.id) {
      throw new BadRequestException('Invalid bank account selected.');
    }

    const bankName = selectedBankAccount?.bankName ?? dto.bankName;
    const accountNumber = selectedBankAccount?.accountNumber ?? dto.accountNumber;
    const accountName = selectedBankAccount?.accountName ?? dto.accountName;

    if (!bankName || !accountNumber || !accountName) {
      throw new BadRequestException('Please select a saved bank account for this withdrawal request.');
    }

    const created = await (this.prisma as any).savingsWithdrawalRequest.create({
      data: {
        memberId: member.id,
        savingsAccountId: account.id,
        amount,
        bankName,
        accountNumber,
        accountName,
        status: 'PENDING',
      },
    });

    await this.audit.log(userId, 'REQUEST_SAVINGS_WITHDRAWAL', 'SavingsWithdrawalRequest', created.id, {
      amount,
      bankName,
      accountNumber,
      bankAccountId: dto.bankAccountId ?? selectedBankAccount?.id,
    });

    const admins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });
    if (admins.length) {
      await this.notifications.broadcast(
        'IN_APP',
        'Savings withdrawal request',
        `${member.fullName} requested a savings withdrawal of NGN ${amount.toLocaleString('en-NG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`,
        admins.map((admin) => admin.id),
      );
    }

    return {
      ...created,
      amount: Number(created.amount),
    };
  }

  async listTransactions() {
    const items = await this.prisma.transaction.findMany({
      where: { type: 'SAVINGS' },
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: {
          include: {
            member: {
              select: {
                id: true,
                fullName: true,
                membershipNumber: true,
              },
            },
          },
        },
      },
    });

    return {
      items: items.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
    };
  }

  async listWithdrawalRequests() {
    const items = await (this.prisma as any).savingsWithdrawalRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            membershipNumber: true,
          },
        },
        savingsAccount: true,
      },
    });

    return {
      items: items.map((item: any) => ({
        ...item,
        amount: Number(item.amount),
      })),
    };
  }

  async approveWithdrawal(id: string, actorId: string) {
    const request = await (this.prisma as any).savingsWithdrawalRequest.findUnique({
      where: { id },
      include: {
        member: true,
        savingsAccount: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Withdrawal request is not pending.');
    }

    const amount = normalizeMoney(request.amount);
    if (Number(request.savingsAccount.balance) < amount) {
      throw new BadRequestException('Member savings balance is no longer sufficient for this withdrawal request.');
    }

    const reference = `SAVINGS-WD-${id}`;
    const updated = await this.prisma.runTransaction('savings.approveWithdrawal', async (tx) => {
      const claimed = await (tx as any).savingsWithdrawalRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVING' },
      });
      if (claimed.count < 1) {
        throw new BadRequestException('Withdrawal request is not pending.');
      }

      const savingsDebit = await tx.savingsAccount.updateMany({
        where: { id: request.savingsAccountId, balance: { gte: amount } },
        data: {
          balance: { decrement: amount },
        },
      });
      if (savingsDebit.count < 1) {
        throw new BadRequestException('Member savings balance is no longer sufficient for this withdrawal request.');
      }

      await this.financialPosting.postAssociationOutflow(
        {
          amount,
          reference,
          sourceType: 'SavingsWithdrawalRequest',
          sourceId: id,
          description: `Savings withdrawal approved for ${request.member.fullName}`,
          actorId,
          memberId: request.memberId,
          category: 'savings withdrawal',
        },
        tx,
      );

      return (tx as any).savingsWithdrawalRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });
    });

    await this.audit.log(actorId, 'APPROVE_SAVINGS_WITHDRAWAL', 'SavingsWithdrawalRequest', id, {
      amount,
      reference,
    });

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  async rejectWithdrawal(id: string, actorId: string, reason?: string) {
    const request = await (this.prisma as any).savingsWithdrawalRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Withdrawal request is not pending.');
    }

    const updated = await (this.prisma as any).savingsWithdrawalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason || null,
      },
    });

    await this.audit.log(actorId, 'REJECT_SAVINGS_WITHDRAWAL', 'SavingsWithdrawalRequest', id, {
      reason,
    });

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }
}
