import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CooperativeEntryType } from '../../common/prisma-types';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { FinancialPostingService } from '../../common/services/financial-posting.service';
import { normalizeMoney } from '../../common/utils/money';

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

    let physicalTreasuryCash = Number((wallet as any).physicalTreasuryCash ?? wallet.balance);
    let memberWalletLiability = Number((wallet as any).memberWalletLiability ?? 0);
    let associationAvailableBalance = Number((wallet as any).associationAvailableBalance ?? wallet.balance);
    const ledgerPhysicalTreasuryCash = ledgerAccountTotal('PHYSICAL_TREASURY_CASH');
    const ledgerMemberWalletLiability = -ledgerAccountTotal('MEMBER_WALLET_LIABILITY');
    const ledgerAssociationAvailable = -ledgerAccountTotal('ASSOCIATION_AVAILABLE');
    const memberWalletRows = await this.prisma.wallet.findMany({
      select: { availableBalance: true },
    });
    const positiveMemberWalletHoldings = memberWalletRows.reduce(
      (sum, memberWallet) => sum + Math.max(Number(memberWallet.availableBalance ?? 0), 0),
      0,
    );
    const cachedBalancesAreEmpty =
      Math.abs(physicalTreasuryCash) < 0.01 &&
      Math.abs(memberWalletLiability) < 0.01 &&
      Math.abs(associationAvailableBalance) < 0.01;

    if (cachedBalancesAreEmpty) {
      memberWalletLiability = Math.max(
        ledgerMemberWalletLiability,
        positiveMemberWalletHoldings,
      );
      associationAvailableBalance = Math.max(
        ledgerAssociationAvailable,
        Number(wallet.balance ?? 0),
      );
      physicalTreasuryCash = Math.max(
        ledgerPhysicalTreasuryCash,
        memberWalletLiability + associationAvailableBalance,
      );

      await this.prisma.cooperativeWallet.update({
        where: { id: wallet.id },
        data: {
          physicalTreasuryCash,
          memberWalletLiability,
          associationAvailableBalance,
          balance: associationAvailableBalance,
        },
      });
    } else {
      memberWalletLiability = positiveMemberWalletHoldings;
      physicalTreasuryCash = Math.max(
        physicalTreasuryCash,
        ledgerPhysicalTreasuryCash,
        memberWalletLiability + associationAvailableBalance,
      );
    }

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

  async getLedgerEntries(query: { from?: string; to?: string } = {}) {
    const where: Record<string, unknown> = {};
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }

    const entries = await this.prisma.financialLedgerEntry.findMany({
      where,
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
    input = { ...input, amount: normalizeMoney(input.amount) };
    const wallet = await this.ensureWallet();
    const isIncome = input.type === 'INCOME';

    const entry = await this.prisma.runTransaction('cooperativeWallet.createEntry', async (tx) => {
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
