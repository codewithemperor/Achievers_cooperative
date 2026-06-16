import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { normalizeMoney } from '../utils/money';
import type {
  FinancialAccountCode,
  FinancialLineDirection,
  TransactionType,
} from '../prisma-types';

type PrismaClientLike = PrismaService | any;

type LedgerLineInput = {
  account: FinancialAccountCode;
  direction: FinancialLineDirection;
  amount: number;
  memberId?: string | null;
  metadata?: Record<string, unknown>;
};

type PostInput = {
  reference?: string | null;
  sourceType: string;
  sourceId?: string | null;
  description: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  lines: LedgerLineInput[];
};

type BalanceDelta = {
  physicalTreasuryCash?: number;
  memberWalletLiability?: number;
  associationAvailableBalance?: number;
  totalIncome?: number;
  totalExpense?: number;
};

const ASSOCIATION_INCOME_TRANSACTION_TYPES = new Set<TransactionType | string>([
  'SAVINGS',
  'LOAN_REPAYMENT',
  'LOAN_BOND',
  'PACKAGE_SUBSCRIPTION',
  'PACKAGE_PENALTY',
  'MEMBERSHIP_CHARGE',
  'MEMBERSHIP_FEE',
  'WEEKLY_COOPERATIVE',
  'INVESTMENT',
  'INVESTMENT_DEPOSIT',
]);

@Injectable()
export class FinancialPostingService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureWallet(client: PrismaClientLike = this.prisma) {
    const existing = await client.cooperativeWallet.findFirst();
    if (existing) return this.backfillLegacyBalancesIfNeeded(existing, client);
    return client.cooperativeWallet.create({ data: {} });
  }

  async post(input: PostInput, client: PrismaClientLike = this.prisma) {
    if (!input.lines.length) {
      throw new BadRequestException('Financial ledger posting requires at least one line.');
    }

    const entry = await client.financialLedgerEntry.create({
      data: {
        reference: input.reference || undefined,
        sourceType: input.sourceType,
        sourceId: input.sourceId || undefined,
        description: input.description,
        actorId: input.actorId || undefined,
        metadata: input.metadata as any,
        lines: {
          create: input.lines.map((line) => ({
            account: line.account,
            direction: line.direction,
            amount: normalizeMoney(line.amount),
            memberId: line.memberId || undefined,
            metadata: line.metadata as any,
          })),
        },
      },
      include: { lines: true },
    });

    return entry;
  }

  async postWalletFunding(
    input: {
      memberId: string;
      amount: number;
      reference?: string | null;
      sourceType: string;
      sourceId?: string | null;
      description: string;
      actorId?: string | null;
    },
    client: PrismaClientLike = this.prisma,
  ) {
    input = { ...input, amount: normalizeMoney(input.amount) };
    await this.applyBalanceDelta(
      {
        physicalTreasuryCash: input.amount,
        memberWalletLiability: input.amount,
      },
      client,
    );

    return this.post(
      {
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description,
        actorId: input.actorId,
        lines: [
          {
            account: 'PHYSICAL_TREASURY_CASH',
            direction: 'DEBIT',
            amount: input.amount,
            memberId: input.memberId,
          },
          {
            account: 'MEMBER_WALLET_LIABILITY',
            direction: 'CREDIT',
            amount: input.amount,
            memberId: input.memberId,
          },
        ],
      },
      client,
    );
  }

  async postWalletToAssociation(
    input: {
      memberId: string;
      amount: number;
      reference?: string | null;
      sourceType: string;
      sourceId?: string | null;
      description: string;
      actorId?: string | null;
      category?: string | null;
    },
    client: PrismaClientLike = this.prisma,
  ) {
    input = { ...input, amount: normalizeMoney(input.amount) };
    await this.applyBalanceDelta(
      {
        memberWalletLiability: -input.amount,
        associationAvailableBalance: input.amount,
        totalIncome: input.amount,
      },
      client,
    );

    return this.post(
      {
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description,
        actorId: input.actorId,
        metadata: { category: input.category },
        lines: [
          {
            account: 'MEMBER_WALLET_LIABILITY',
            direction: 'DEBIT',
            amount: input.amount,
            memberId: input.memberId,
          },
          {
            account: 'ASSOCIATION_AVAILABLE',
            direction: 'CREDIT',
            amount: input.amount,
            memberId: input.memberId,
          },
        ],
      },
      client,
    );
  }

  async postWalletWithdrawal(
    input: {
      memberId: string;
      amount: number;
      reference?: string | null;
      sourceType: string;
      sourceId?: string | null;
      description: string;
      actorId?: string | null;
    },
    client: PrismaClientLike = this.prisma,
  ) {
    input = { ...input, amount: normalizeMoney(input.amount) };
    await this.applyBalanceDelta(
      {
        physicalTreasuryCash: -input.amount,
        memberWalletLiability: -input.amount,
      },
      client,
    );

    return this.post(
      {
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description,
        actorId: input.actorId,
        lines: [
          {
            account: 'MEMBER_WALLET_LIABILITY',
            direction: 'DEBIT',
            amount: input.amount,
            memberId: input.memberId,
          },
          {
            account: 'PHYSICAL_TREASURY_CASH',
            direction: 'CREDIT',
            amount: input.amount,
            memberId: input.memberId,
          },
        ],
      },
      client,
    );
  }

  async postAssociationToWallet(
    input: {
      memberId: string;
      amount: number;
      reference?: string | null;
      sourceType: string;
      sourceId?: string | null;
      description: string;
      actorId?: string | null;
      category?: string | null;
    },
    client: PrismaClientLike = this.prisma,
  ) {
    input = { ...input, amount: normalizeMoney(input.amount) };
    await this.applyBalanceDelta(
      {
        memberWalletLiability: input.amount,
        associationAvailableBalance: -input.amount,
        totalExpense: input.amount,
      },
      client,
    );

    return this.post(
      {
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description,
        actorId: input.actorId,
        metadata: { category: input.category },
        lines: [
          {
            account: 'ASSOCIATION_AVAILABLE',
            direction: 'DEBIT',
            amount: input.amount,
            memberId: input.memberId,
          },
          {
            account: 'MEMBER_WALLET_LIABILITY',
            direction: 'CREDIT',
            amount: input.amount,
            memberId: input.memberId,
          },
        ],
      },
      client,
    );
  }

  async postAssociationOutflow(
    input: {
      amount: number;
      reference?: string | null;
      sourceType: string;
      sourceId?: string | null;
      description: string;
      actorId?: string | null;
      memberId?: string | null;
      category?: string | null;
      enforceAvailable?: boolean;
    },
    client: PrismaClientLike = this.prisma,
  ) {
    input = { ...input, amount: normalizeMoney(input.amount) };
    if (input.enforceAvailable) {
      await this.ensureWallet(client);
      const updated = await client.cooperativeWallet.updateMany({
        where: { associationAvailableBalance: { gte: input.amount } },
        data: {
          physicalTreasuryCash: { decrement: input.amount },
          associationAvailableBalance: { decrement: input.amount },
          balance: { decrement: input.amount },
          totalExpense: { increment: input.amount },
        },
      });

      if (updated.count < 1) {
        throw new BadRequestException('Association balance is not sufficient to disburse this loan.');
      }
    } else {
      await this.applyBalanceDelta(
        {
          physicalTreasuryCash: -input.amount,
          associationAvailableBalance: -input.amount,
          totalExpense: input.amount,
        },
        client,
      );
    }

    return this.post(
      {
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description,
        actorId: input.actorId,
        metadata: { category: input.category },
        lines: [
          {
            account: 'ASSOCIATION_AVAILABLE',
            direction: 'DEBIT',
            amount: input.amount,
            memberId: input.memberId,
          },
          {
            account: 'PHYSICAL_TREASURY_CASH',
            direction: 'CREDIT',
            amount: input.amount,
            memberId: input.memberId,
          },
        ],
      },
      client,
    );
  }

  async postAssociationInflow(
    input: {
      amount: number;
      reference?: string | null;
      sourceType: string;
      sourceId?: string | null;
      description: string;
      actorId?: string | null;
      category?: string | null;
    },
    client: PrismaClientLike = this.prisma,
  ) {
    input = { ...input, amount: normalizeMoney(input.amount) };
    await this.applyBalanceDelta(
      {
        physicalTreasuryCash: input.amount,
        associationAvailableBalance: input.amount,
        totalIncome: input.amount,
      },
      client,
    );

    return this.post(
      {
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description,
        actorId: input.actorId,
        metadata: { category: input.category },
        lines: [
          {
            account: 'PHYSICAL_TREASURY_CASH',
            direction: 'DEBIT',
            amount: input.amount,
          },
          {
            account: 'ASSOCIATION_AVAILABLE',
            direction: 'CREDIT',
            amount: input.amount,
          },
        ],
      },
      client,
    );
  }

  isAssociationIncomeTransaction(type: TransactionType | string) {
    return ASSOCIATION_INCOME_TRANSACTION_TYPES.has(type);
  }

  private async applyBalanceDelta(delta: BalanceDelta, client: PrismaClientLike) {
    const wallet = await this.ensureWallet(client);
    const normalizedDelta = {
      physicalTreasuryCash:
        delta.physicalTreasuryCash === undefined ? undefined : normalizeMoney(delta.physicalTreasuryCash),
      memberWalletLiability:
        delta.memberWalletLiability === undefined ? undefined : normalizeMoney(delta.memberWalletLiability),
      associationAvailableBalance:
        delta.associationAvailableBalance === undefined ? undefined : normalizeMoney(delta.associationAvailableBalance),
      totalIncome: delta.totalIncome === undefined ? undefined : normalizeMoney(delta.totalIncome),
      totalExpense: delta.totalExpense === undefined ? undefined : normalizeMoney(delta.totalExpense),
    };

    await client.cooperativeWallet.update({
      where: { id: wallet.id },
      data: {
        physicalTreasuryCash:
          normalizedDelta.physicalTreasuryCash === undefined ? undefined : { increment: normalizedDelta.physicalTreasuryCash },
        memberWalletLiability:
          normalizedDelta.memberWalletLiability === undefined ? undefined : { increment: normalizedDelta.memberWalletLiability },
        associationAvailableBalance:
          normalizedDelta.associationAvailableBalance === undefined
            ? undefined
            : { increment: normalizedDelta.associationAvailableBalance },
        balance:
          normalizedDelta.associationAvailableBalance === undefined
            ? undefined
            : { increment: normalizedDelta.associationAvailableBalance },
        totalIncome: normalizedDelta.totalIncome === undefined ? undefined : { increment: normalizedDelta.totalIncome },
        totalExpense: normalizedDelta.totalExpense === undefined ? undefined : { increment: normalizedDelta.totalExpense },
      },
    });
  }

  private async backfillLegacyBalancesIfNeeded(wallet: any, client: PrismaClientLike) {
    const hasNewBalances =
      Number(wallet.physicalTreasuryCash ?? 0) !== 0 ||
      Number(wallet.memberWalletLiability ?? 0) !== 0 ||
      Number(wallet.associationAvailableBalance ?? 0) !== 0;

    if (hasNewBalances) return wallet;

    const ledgerCount = await client.financialLedgerEntry.count();
    if (ledgerCount > 0) return wallet;

    const memberWalletRows = await client.wallet.findMany({
      select: { availableBalance: true },
    });
    const associationAvailableBalance = Number(wallet.balance ?? 0);
    const memberWalletLiability = memberWalletRows.reduce(
      (sum: number, memberWallet: { availableBalance: unknown }) =>
        sum + Math.max(Number(memberWallet.availableBalance ?? 0), 0),
      0,
    );
    const physicalTreasuryCash = associationAvailableBalance + memberWalletLiability;

    if (physicalTreasuryCash === 0 && memberWalletLiability === 0 && associationAvailableBalance === 0) {
      return wallet;
    }

    return client.cooperativeWallet.update({
      where: { id: wallet.id },
      data: {
        physicalTreasuryCash,
        memberWalletLiability,
        associationAvailableBalance,
      },
    });
  }
}
