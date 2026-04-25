import { Injectable, NotFoundException } from '@nestjs/common';
import type { CooperativeEntryType } from '../../common/prisma-types';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';

interface CreateEntryInput {
  type: CooperativeEntryType;
  amount: number;
  category: string;
  description: string;
  reference?: string;
  createdAt?: Date;
}

interface UpdateEntryInput {
  type: CooperativeEntryType;
  amount: number;
  category: string;
  description: string;
  reference?: string;
  createdAt?: Date;
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
          createdAt: input.createdAt,
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

  async updateEntry(actorId: string, entryId: string, input: UpdateEntryInput) {
    const wallet = await this.ensureWallet();
    const existing = await this.prisma.cooperativeEntry.findFirst({
      where: { id: entryId, walletId: wallet.id },
    });

    if (!existing) {
      throw new NotFoundException('Cooperative entry not found');
    }

    const reverseOldBalance =
      existing.type === 'INCOME' ? -Number(existing.amount) : Number(existing.amount);
    const applyNewBalance = input.type === 'INCOME' ? input.amount : -input.amount;
    const balanceDelta = reverseOldBalance + applyNewBalance;

    const reverseOldIncome = existing.type === 'INCOME' ? -Number(existing.amount) : 0;
    const applyNewIncome = input.type === 'INCOME' ? input.amount : 0;
    const incomeDelta = reverseOldIncome + applyNewIncome;

    const reverseOldExpense = existing.type === 'EXPENSE' ? -Number(existing.amount) : 0;
    const applyNewExpense = input.type === 'EXPENSE' ? input.amount : 0;
    const expenseDelta = reverseOldExpense + applyNewExpense;

    const [entry] = await this.prisma.$transaction([
      this.prisma.cooperativeEntry.update({
        where: { id: entryId },
        data: {
          type: input.type,
          amount: input.amount,
          category: input.category,
          description: input.description,
          reference: input.reference,
          createdAt: input.createdAt,
        },
      }),
      this.prisma.cooperativeWallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceDelta === 0 ? undefined : { increment: balanceDelta },
          totalIncome: incomeDelta === 0 ? undefined : { increment: incomeDelta },
          totalExpense: expenseDelta === 0 ? undefined : { increment: expenseDelta },
        },
      }),
    ]);

    await this.audit.log(actorId, 'UPDATE_COOPERATIVE_ENTRY', 'CooperativeEntry', entry.id, {
      previous: {
        type: existing.type,
        amount: Number(existing.amount),
        category: existing.category,
        description: existing.description,
        reference: existing.reference,
        createdAt: existing.createdAt,
      },
      next: {
        ...input,
      },
    });

    return {
      ...entry,
      amount: Number(entry.amount),
    };
  }
}
