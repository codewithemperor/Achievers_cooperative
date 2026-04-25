import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WalletService } from '../../common/services/wallet.service';
import { AuditService } from '../../common/services/audit.service';
import { ContributeSavingsDto } from './dto/index';

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

  async contribute(userId: string, dto: ContributeSavingsDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    // Debit wallet
    const reference = `SAVE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await this.walletService.debitWallet(member.id, dto.amount, 'SAVINGS', reference);

    // Get or create savings account
    let account = await this.prisma.savingsAccount.findFirst({
      where: { memberId: member.id },
    });

    if (!account) {
      account = await this.prisma.savingsAccount.create({
        data: {
          memberId: member.id,
          contributionFrequency: 'MONTHLY',
        },
      });
    }

    // Credit savings
    const updated = await this.prisma.savingsAccount.update({
      where: { id: account.id },
      data: { balance: { increment: dto.amount } },
    });

    await this.audit.log(userId, 'SAVINGS_CONTRIBUTION', 'SavingsAccount', account.id, {
      amount: dto.amount,
      newBalance: Number(updated.balance),
    });

    return {
      account: {
        id: updated.id,
        balance: Number(updated.balance),
        contributionFrequency: updated.contributionFrequency,
      },
      amount: dto.amount,
      reference,
    };
  }
}
