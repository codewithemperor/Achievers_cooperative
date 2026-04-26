import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { TransactionType } from '../prisma-types';

interface TransactionOptions {
  category?: string;
  description?: string;
  editable?: boolean;
  lockReason?: string;
  metadata?: Record<string, unknown>;
}

interface DebitWalletOptions extends TransactionOptions {
  allowNegative?: boolean;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getMemberWallet(memberId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { memberId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { memberId },
      });
    }

    return wallet;
  }

  async getBalance(memberId: string) {
    const wallet = await this.getMemberWallet(memberId);
    return {
      availableBalance: Number(wallet.availableBalance),
      pendingBalance: Number(wallet.pendingBalance),
      currency: wallet.currency,
    };
  }

  async creditWallet(
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
    options?: TransactionOptions,
  ) {
    const wallet = await this.getMemberWallet(memberId);

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: amount },
          totalFunded: { increment: amount },
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          status: 'APPROVED',
          reference,
          category: options?.category,
          description: options?.description,
          editable: options?.editable ?? false,
          lockReason: options?.lockReason,
          metadata: options?.metadata as any,
        },
      }),
    ]);

    const settled = await this.settlePendingWeeklyDeductions(wallet.id);

    return {
      wallet: settled.wallet,
      transaction,
      settledTransactions: settled.transactions,
    };
  }

  async debitWallet(
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
    options?: DebitWalletOptions,
  ) {
    const wallet = await this.getMemberWallet(memberId);
    const previousBalance = Number(wallet.availableBalance);
    const nextBalance = previousBalance - amount;

    if (!options?.allowNegative && previousBalance < amount) {
      throw new Error('Insufficient balance');
    }

    const outstandingAmount = nextBalance < 0 ? Math.abs(nextBalance) : 0;
    const status = outstandingAmount > 0 ? 'PENDING' : 'APPROVED';
    const metadata = {
      ...(options?.metadata ?? {}),
      outstandingAmount,
    };

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amount },
          pendingBalance: nextBalance < 0 ? Math.abs(nextBalance) : 0,
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          status,
          reference,
          category: options?.category,
          description: options?.description,
          editable: options?.editable ?? false,
          lockReason: options?.lockReason,
          metadata: metadata as any,
        },
      }),
    ]);

    return { wallet: updatedWallet, transaction };
  }

  async settlePendingWeeklyDeductions(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      return { wallet: null, transactions: [] };
    }

    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        walletId,
        type: 'WEEKLY_COOPERATIVE',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!pendingTransactions.length) {
      const syncedWallet = await this.prisma.wallet.update({
        where: { id: walletId },
        data: { pendingBalance: Number(wallet.availableBalance) < 0 ? Math.abs(Number(wallet.availableBalance)) : 0 },
      });

      return { wallet: syncedWallet, transactions: [] };
    }

    const outstandingAfterFunding = Number(wallet.availableBalance) < 0 ? Math.abs(Number(wallet.availableBalance)) : 0;
    let coveredAmount =
      pendingTransactions.reduce((sum, transaction) => {
        const raw = (transaction.metadata as Record<string, unknown> | null)?.outstandingAmount;
        return sum + (typeof raw === 'number' ? raw : 0);
      }, 0) - outstandingAfterFunding;

    if (coveredAmount <= 0) {
      const syncedWallet = await this.prisma.wallet.update({
        where: { id: walletId },
        data: { pendingBalance: outstandingAfterFunding },
      });

      return { wallet: syncedWallet, transactions: [] };
    }

    const settledTransactions = [];
    for (const transaction of pendingTransactions) {
      if (coveredAmount <= 0) {
        break;
      }

      const currentOutstanding = Number(
        ((transaction.metadata as Record<string, unknown> | null)?.outstandingAmount as number | undefined) ?? 0,
      );

      if (currentOutstanding <= 0) {
        continue;
      }

      const nextOutstanding = Math.max(currentOutstanding - coveredAmount, 0);
      const newlyCovered = currentOutstanding - nextOutstanding;
      coveredAmount -= newlyCovered;

      const updated = await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: nextOutstanding === 0 ? 'APPROVED' : 'PENDING',
          metadata: {
            ...((transaction.metadata as Record<string, unknown> | null) ?? {}),
            outstandingAmount: nextOutstanding,
          } as any,
        },
      });

      settledTransactions.push(updated);
    }

    const syncedWallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        pendingBalance: outstandingAfterFunding,
      },
    });

    return { wallet: syncedWallet, transactions: settledTransactions };
  }
}
