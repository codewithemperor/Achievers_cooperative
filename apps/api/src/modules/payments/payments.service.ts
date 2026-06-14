import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { MembershipChargeService } from '../../common/services/membership-charge.service';
import { WalletService } from '../../common/services/wallet.service';
import { NotificationService } from '../../common/services/notification.service';
import { FinancialPostingService } from '../../common/services/financial-posting.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly membershipChargeService: MembershipChargeService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly financialPosting: FinancialPostingService,
  ) {}

  async findAll() {
    const items = await this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true } },
      },
    });

    return {
      items: items.map((payment) => this.serializePayment(payment)),
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

    return this.serializePayment(payment);
  }

  async create(userId: string, body: { amount: number; receiptUrl?: string; memberId?: string }) {
    this.assertValidAmount(body.amount);
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

    return this.serializePayment(created);
  }

  async createApprovedByAdmin(actorId: string, body: { amount: number; receiptUrl?: string; memberId?: string }) {
    this.assertValidAmount(body.amount);

    if (!body.memberId) {
      throw new BadRequestException('Member is required');
    }

    const member = await this.prisma.member.findUnique({
      where: { id: body.memberId },
      select: { id: true },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const created = await this.prisma.payment.create({
      data: {
        memberId: body.memberId,
        amount: body.amount,
        receiptUrl: body.receiptUrl,
        status: 'PENDING',
      },
    });

    await this.audit.log(actorId, 'CREATE_ADMIN_PAYMENT', 'Payment', created.id, body);

    return this.approve(created.id, actorId);
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
    const debtRecoveryPlan = await this.walletService.prepareWalletFundingDebtRecovery(payment.memberId, netAmount);

    const { updated, fundingResult } = await this.prisma.runTransaction('payments.approve', async (tx) => {
      const approvalGuard = await tx.payment.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          verifiedById: actorId,
          verifiedAt: new Date(),
          netCreditAmount: netAmount,
          debtSettlementAmount: 0,
          walletCreditAmount: 0,
          approvalReference: reference,
        },
      });

      if (approvalGuard.count < 1) {
        throw new BadRequestException('Payment is not pending');
      }

      const fundingResult = await this.walletService.applyWalletFundingWithDebtRecovery(
        tx,
        payment.memberId,
        netAmount,
        'WALLET_FUNDING',
        reference,
        {
          actorId,
          paymentId: payment.id,
          category: 'wallet funding',
          description: `Approved wallet funding for ${payment.member.fullName}`,
          editable: false,
          lockReason: 'Wallet funding transactions come from verified payment records and cannot be edited.',
          metadata: {
            paymentId: payment.id,
            grossAmount,
            charge,
            netAmount,
            trigger: 'PAYMENT_APPROVAL',
          },
          debtRecoveryPlan,
        },
      );

      if (charge > 0) {
        await tx.wallet.update({
          where: { memberId: payment.memberId },
          data: {
            totalCharges: { increment: charge },
          },
        });

        await tx.transaction.create({
          data: {
            walletId: fundingResult.wallet.id,
            type: 'MEMBERSHIP_CHARGE',
            amount: charge,
            status: 'APPROVED',
            reference: `${reference}-CHARGE`,
            category: 'processing charge',
            description: `Funding charge applied to ${payment.member.fullName}`,
            editable: false,
            lockReason: 'System-generated funding charges cannot be edited.',
            metadata: {
              paymentId: payment.id,
              fundingTransactionId: fundingResult.transaction.id,
              approvalReference: reference,
            },
          },
        });

        const cooperativeWallet = await this.financialPosting.ensureWallet(tx);
        const cooperativeEntry = await tx.cooperativeEntry.create({
          data: {
            walletId: cooperativeWallet.id,
            type: 'INCOME',
            amount: charge,
            category: 'MEMBERSHIP_CHARGE',
            description: `Membership charge collected from ${payment.member.fullName}`,
            reference: `${reference}-CHARGE`,
            createdById: actorId,
          },
        });

        await this.financialPosting.postAssociationInflow(
          {
            amount: charge,
            reference: `${reference}-CHARGE`,
            sourceType: 'CooperativeEntry',
            sourceId: cooperativeEntry.id,
            description: `Membership charge collected from ${payment.member.fullName}`,
            actorId,
            category: 'MEMBERSHIP_CHARGE',
          },
          tx,
        );
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          debtSettlementAmount: fundingResult.debtSettlementAmount,
          walletCreditAmount: fundingResult.walletCreditAmount,
        },
      });

      return { updated, fundingResult };
    });
    const autoSettlements = fundingResult.settlements;

    await this.audit.log(actorId, 'APPROVE_PAYMENT', 'Payment', id, {
      grossAmount,
      charge,
      netAmount,
      debtSettlementAmount: fundingResult.debtSettlementAmount,
      walletCreditAmount: fundingResult.walletCreditAmount,
      approvalReference: reference,
      autoSettlements,
    });

    await this.notificationService.notifyMember(
      payment.member.userId,
      'Wallet funding approved',
      `Your payment of ${grossAmount.toLocaleString()} has been approved. Net deposit: ${netAmount.toLocaleString()}. Wallet credited: ${fundingResult.walletCreditAmount.toLocaleString()}.${fundingResult.debtSettlementAmount > 0 ? ` Debt recovery applied: ${fundingResult.debtSettlementAmount.toLocaleString()}.` : ''}${autoSettlements.length ? ` Automatic deductions applied: ${autoSettlements.map((item) => `${item.type} ${item.amount.toLocaleString()}`).join(', ')}.` : ''}`,
    );

    return this.serializePayment(updated);
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

    return this.serializePayment(updated);
  }

  private assertValidAmount(amount: number) {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new BadRequestException('Enter a valid payment amount.');
    }
  }

  private serializePayment(payment: any) {
    return {
      ...payment,
      amount: Number(payment.amount),
      netCreditAmount: payment.netCreditAmount == null ? null : Number(payment.netCreditAmount),
      debtSettlementAmount: payment.debtSettlementAmount == null ? null : Number(payment.debtSettlementAmount),
      walletCreditAmount: payment.walletCreditAmount == null ? null : Number(payment.walletCreditAmount),
    };
  }
}
