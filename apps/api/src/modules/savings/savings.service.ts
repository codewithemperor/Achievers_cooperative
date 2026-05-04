import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { AuditService } from '../../common/services/audit.service';
import { ContributeSavingsDto, RequestSavingsWithdrawalDto } from './dto/index';

@Injectable()
export class SavingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly audit: AuditService,
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
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const result = await this.walletService.applySavingsContribution(member.id, dto.amount, 'MEMBER');

    await this.audit.log(userId, 'SAVINGS_CONTRIBUTION', 'SavingsAccount', result.account.id, {
      amount: dto.amount,
      newBalance: Number(result.account.balance),
    });

    return {
      account: {
        id: result.account.id,
        balance: Number(result.account.balance),
        contributionFrequency: result.account.contributionFrequency,
      },
      amount: dto.amount,
      reference: result.reference,
    };
  }

  async requestWithdrawal(userId: string, dto: RequestSavingsWithdrawalDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const account =
      (dto.savingsAccountId
        ? await this.prisma.savingsAccount.findUnique({ where: { id: dto.savingsAccountId } })
        : await this.prisma.savingsAccount.findFirst({ where: { memberId: member.id } })) ?? null;

    if (!account || account.memberId !== member.id) {
      throw new BadRequestException('Savings account not found.');
    }

    if (Number(account.balance) < dto.amount) {
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
        amount: dto.amount,
        bankName,
        accountNumber,
        accountName,
        status: 'PENDING',
      },
    });

    await this.audit.log(userId, 'REQUEST_SAVINGS_WITHDRAWAL', 'SavingsWithdrawalRequest', created.id, {
      amount: dto.amount,
      bankName,
      accountNumber,
      bankAccountId: dto.bankAccountId ?? selectedBankAccount?.id,
    });

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

    if (Number(request.savingsAccount.balance) < Number(request.amount)) {
      throw new BadRequestException('Member savings balance is no longer sufficient for this withdrawal request.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.savingsAccount.update({
        where: { id: request.savingsAccountId },
        data: {
          balance: { decrement: request.amount },
        },
      });

      return (tx as any).savingsWithdrawalRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });
    });

    await this.audit.log(actorId, 'APPROVE_SAVINGS_WITHDRAWAL', 'SavingsWithdrawalRequest', id, {
      amount: Number(request.amount),
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
