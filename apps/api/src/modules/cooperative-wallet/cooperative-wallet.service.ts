import { Injectable } from '@nestjs/common';
import type { CooperativeEntryType } from '../../common/prisma-types';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';

interface CreateEntryInput {
  type: CooperativeEntryType;
  amount: number;
  category: string;
  description: string;
  reference?: string;
}

@Injectable()
export class CooperativeWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async ensureWallet() {
    const existing = await this.prisma.cooperativeWallet.findFirst();
    if (existing) {
      return existing;
    }

    return this.prisma.cooperativeWallet.create({ data: {} });
  }

  async getSummary() {
    const wallet = await this.ensureWallet();
    return {
      id: wallet.id,
      balance: Number(wallet.balance),
      totalIncome: Number(wallet.totalIncome),
      totalExpense: Number(wallet.totalExpense),
    };
  }

  async getEntries() {
    const wallet = await this.ensureWallet();
    const entries = await this.prisma.cooperativeEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: entries.map((entry) => ({
        ...entry,
        amount: Number(entry.amount),
      })),
    };
  }

  async createEntry(actorId: string, input: CreateEntryInput) {
    const wallet = await this.ensureWallet();
    const isIncome = input.type === 'INCOME';

    const [entry] = await this.prisma.$transaction([
      this.prisma.cooperativeEntry.create({
        data: {
          walletId: wallet.id,
          type: input.type,
          amount: input.amount,
          category: input.category,
          description: input.description,
          reference: input.reference,
          createdById: actorId,
        },
      }),
      this.prisma.cooperativeWallet.update({
        where: { id: wallet.id },
        data: {
          balance: isIncome ? { increment: input.amount } : { decrement: input.amount },
          totalIncome: isIncome ? { increment: input.amount } : undefined,
          totalExpense: !isIncome ? { increment: input.amount } : undefined,
        },
      }),
    ]);

    await this.audit.log(actorId, 'CREATE_COOPERATIVE_ENTRY', 'CooperativeEntry', entry.id, {
      ...input,
    });

    return {
      ...entry,
      amount: Number(entry.amount),
    };
  }
}
