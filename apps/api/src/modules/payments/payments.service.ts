import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { MembershipChargeService } from '../../common/services/membership-charge.service';
import { WalletService } from '../../common/services/wallet.service';
import { NotificationService } from '../../common/services/notification.service';
import { CooperativeWalletService } from '../cooperative-wallet/cooperative-wallet.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly membershipChargeService: MembershipChargeService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly cooperativeWalletService: CooperativeWalletService,
  ) {}

  async findAll() {
    const items = await this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true } },
      },
    });

    return {
      items: items.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        netCreditAmount: payment.netCreditAmount ? Number(payment.netCreditAmount) : null,
      })),
    };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return {
      ...payment,
      amount: Number(payment.amount),
      netCreditAmount: payment.netCreditAmount ? Number(payment.netCreditAmount) : null,
    };
  }

  async create(userId: string, body: { amount: number; receiptUrl?: string; memberId?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let memberId = body.memberId;

    if (user?.role === 'MEMBER') {
      const member = await this.prisma.member.findUnique({ where: { userId } });
      memberId = member?.id;
    }

    if (!memberId) {
      throw new BadRequestException('Member is required');
    }

    const created = await this.prisma.payment.create({
      data: {
        memberId,
        amount: body.amount,
        receiptUrl: body.receiptUrl,
        status: 'PENDING',
      },
    });

    await this.audit.log(userId, 'CREATE_PAYMENT', 'Payment', created.id, body);

    return {
      ...created,
      amount: Number(created.amount),
    };
  }

  async approve(id: string, actorId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Payment is not pending');
    }

    const grossAmount = Number(payment.amount);
    const { charge, netAmount } = await this.membershipChargeService.applyCharge(grossAmount);
    const reference = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await this.walletService.creditWallet(payment.memberId, netAmount, 'WALLET_FUNDING', reference, {
      category: 'wallet funding',
      description: `Approved wallet funding for ${payment.member.fullName}`,
      editable: false,
      lockReason: 'Wallet funding transactions come from verified payment records and cannot be edited.',
    });
    const autoSettlements = await this.walletService.settleOutstandingObligations(payment.memberId);

    await this.prisma.wallet.update({
      where: { memberId: payment.memberId },
      data: {
        totalCharges: { increment: charge },
      },
    });

    if (charge > 0) {
      const wallet = await this.prisma.wallet.findUnique({ where: { memberId: payment.memberId } });
      if (wallet) {
        await this.prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'MEMBERSHIP_CHARGE',
            amount: charge,
            status: 'APPROVED',
            reference: `${reference}-CHARGE`,
            category: 'processing charge',
            description: `Funding charge applied to ${payment.member.fullName}`,
            editable: false,
            lockReason: 'System-generated funding charges cannot be edited.',
          },
        });
      }

      await this.cooperativeWalletService.createEntry(actorId, {
        type: 'INCOME',
        amount: charge,
        category: 'MEMBERSHIP_CHARGE',
        description: `Membership charge collected from ${payment.member.fullName}`,
        reference: `${reference}-CHARGE`,
      });
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        verifiedById: actorId,
        verifiedAt: new Date(),
        netCreditAmount: netAmount,
      },
    });

    await this.audit.log(actorId, 'APPROVE_PAYMENT', 'Payment', id, {
      grossAmount,
      charge,
      netAmount,
      autoSettlements,
    });

    await this.notificationService.notifyMember(
      payment.member.userId,
      'Wallet funding approved',
      `Your payment of ${grossAmount.toLocaleString()} has been approved. Net credit: ${netAmount.toLocaleString()}.${autoSettlements.length ? ` Automatic deductions applied: ${autoSettlements.map((item) => `${item.type} ${item.amount.toLocaleString()}`).join(', ')}.` : ''}`,
    );

    return {
      ...updated,
      amount: Number(updated.amount),
      netCreditAmount: updated.netCreditAmount ? Number(updated.netCreditAmount) : null,
    };
  }

  async reject(id: string, actorId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { member: { include: { user: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Payment is not pending');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        verifiedById: actorId,
        verifiedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await this.audit.log(actorId, 'REJECT_PAYMENT', 'Payment', id, { reason });

    await this.notificationService.notifyMember(
      payment.member.userId,
      'Wallet funding rejected',
      reason || 'Your uploaded receipt could not be verified.',
    );

    return {
      ...updated,
      amount: Number(updated.amount),
      netCreditAmount: updated.netCreditAmount ? Number(updated.netCreditAmount) : null,
    };
  }
}
