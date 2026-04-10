import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionType } from '@prisma/client';

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
  ) {
    const wallet = await this.getMemberWallet(memberId);

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: amount },
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          status: 'APPROVED',
          reference,
        },
      }),
    ]);

    return { wallet: updatedWallet, transaction };
  }

  async debitWallet(
    memberId: string,
    amount: number,
    type: TransactionType,
    reference?: string,
  ) {
    const wallet = await this.getMemberWallet(memberId);

    if (Number(wallet.availableBalance) < amount) {
      throw new Error('Insufficient balance');
    }

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amount },
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          status: 'APPROVED',
          reference,
        },
      }),
    ]);

    return { wallet: updatedWallet, transaction };
  }
}
