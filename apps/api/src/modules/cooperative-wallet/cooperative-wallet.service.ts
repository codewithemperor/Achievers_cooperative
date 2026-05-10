import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CooperativeEntryType } from '../../common/prisma-types';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { FinancialPostingService } from '../../common/services/financial-posting.service';

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
    private readonly financialPosting: FinancialPostingService,
  ) {}

  async ensureWallet() {
    return this.financialPosting.ensureWallet();
  }

  async getSummary() {
    const wallet = await this.ensureWallet();
    const ledgerRows = await this.prisma.financialLedgerLine.groupBy({
      by: ['account', 'direction'],
      _sum: { amount: true },
    });

    const ledgerAccountTotal = (account: string) =>
      ledgerRows
        .filter((row) => row.account === account)
        .reduce((sum, row) => {
          const amount = Number(row._sum.amount ?? 0);
          return sum + (row.direction === 'DEBIT' ? amount : -amount);
        }, 0);

    const physicalTreasuryCash = Number((wallet as any).physicalTreasuryCash ?? wallet.balance);
    const memberWalletLiability = Number((wallet as any).memberWalletLiability ?? 0);
    const associationAvailableBalance = Number((wallet as any).associationAvailableBalance ?? wallet.balance);
    const ledgerPhysicalTreasuryCash = ledgerAccountTotal('PHYSICAL_TREASURY_CASH');
    const ledgerMemberWalletLiability = -ledgerAccountTotal('MEMBER_WALLET_LIABILITY');
    const ledgerAssociationAvailable = -ledgerAccountTotal('ASSOCIATION_AVAILABLE');

    return {
      id: wallet.id,
      balance: associationAvailableBalance,
      physicalTreasuryCash,
      memberWalletLiability,
      associationAvailableBalance,
      totalIncome: Number(wallet.totalIncome),
      totalExpense: Number(wallet.totalExpense),
      memberWalletHoldings: memberWalletLiability,
      combinedHoldings: physicalTreasuryCash,
      reconciliation: {
        isBalanced:
          Math.abs(physicalTreasuryCash - (memberWalletLiability + associationAvailableBalance)) < 0.01,
        physicalTreasuryCashFromLedger: ledgerPhysicalTreasuryCash,
        memberWalletLiabilityFromLedger: ledgerMemberWalletLiability,
        associationAvailableFromLedger: ledgerAssociationAvailable,
      },
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

  async getLedgerEntries() {
    const entries = await this.prisma.financialLedgerEntry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, email: true, role: true } },
        lines: {
          include: {
            member: { select: { id: true, fullName: true, membershipNumber: true } },
          },
        },
      },
    });

    return {
      items: entries.map((entry) => {
        const lines = entry.lines.map((line) => ({
          ...line,
          amount: Number(line.amount),
        }));
        const amount = lines.reduce((max, line) => Math.max(max, Number(line.amount)), 0);
        return {
          ...entry,
          amount,
          lines,
        };
      }),
    };
  }

  async createEntry(actorId: string, input: CreateEntryInput) {
    const wallet = await this.ensureWallet();
    const isIncome = input.type === 'INCOME';

    const entry = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.cooperativeEntry.create({
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
      });

      if (isIncome) {
        await this.financialPosting.postAssociationInflow(
          {
            amount: input.amount,
            reference: input.reference,
            sourceType: 'CooperativeEntry',
            sourceId: entry.id,
            description: input.description,
            actorId,
            category: input.category,
          },
          tx,
        );
      } else {
        await this.financialPosting.postAssociationOutflow(
          {
            amount: input.amount,
            reference: input.reference,
            sourceType: 'CooperativeEntry',
            sourceId: entry.id,
            description: input.description,
            actorId,
            category: input.category,
          },
          tx,
        );
      }

      return entry;
    });

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

    throw new BadRequestException(
      'Treasury entries are immutable. Create a reversal or correction entry instead.',
    );
  }
}
