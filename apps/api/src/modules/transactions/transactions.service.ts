import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { QueryTransactionsDto } from './dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryTransactionsDto) {
    const { status, type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: {
            include: {
              member: {
                include: {
                  user: { select: { email: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        wallet: {
          include: {
            member: {
              include: {
                user: { select: { email: true } },
              },
            },
          },
        },
      },
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    return {
      ...transaction,
      amount: Number(transaction.amount),
    };
  }

  async approve(id: string, actorId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.status !== 'PENDING') {
      throw new BadRequestException('Transaction is not pending');
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    // Credit the wallet if it was a funding transaction
    if (transaction.type === 'FUNDING') {
      await this.prisma.wallet.update({
        where: { id: transaction.walletId },
        data: {
          availableBalance: { increment: transaction.amount },
        },
      });
    }

    await this.audit.log(actorId, 'APPROVE_TRANSACTION', 'Transaction', id);

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  async reject(id: string, actorId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.status !== 'PENDING') {
      throw new BadRequestException('Transaction is not pending');
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await this.audit.log(actorId, 'REJECT_TRANSACTION', 'Transaction', id);

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }
}
