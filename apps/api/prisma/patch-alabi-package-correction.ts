import { PrismaService } from '../src/common/prisma.service';
import { FinancialPostingService } from '../src/common/services/financial-posting.service';
import { WalletService } from '../src/common/services/wallet.service';

const APPLY = process.argv.includes('--apply');
const MEMBERSHIP_NUMBER = 'ACH-000013';
const TARGET_PACKAGE_AMOUNT = 5000;

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

async function main() {
  const prisma = new PrismaService();
  const financialPosting = new FinancialPostingService(prisma);
  const walletService = new WalletService(prisma, financialPosting);

  await prisma.$connect();

  try {
    const member = await prisma.member.findUnique({
      where: { membershipNumber: MEMBERSHIP_NUMBER },
      include: { wallet: true, user: { select: { id: true, email: true } } },
    });
    if (!member?.wallet) {
      throw new Error(`Member ${MEMBERSHIP_NUMBER} or wallet not found.`);
    }

    const actor = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true, email: true },
    });
    if (!actor) {
      throw new Error('No SUPER_ADMIN user found for audit attribution.');
    }

    const subscription = await prisma.packageSubscription.findFirst({
      where: {
        memberId: member.id,
        package: {
          totalAmount: TARGET_PACKAGE_AMOUNT,
          isActive: false,
        },
      },
      include: { package: true },
      orderBy: { createdAt: 'asc' },
    } as any);

    const existingRefund = await prisma.transaction.findFirst({
      where: {
        walletId: member.wallet.id,
        type: 'ADMIN_REFUND',
        metadata: {
          path: ['correction'],
          equals: 'ALABI_WRONG_PACKAGE_REFUND',
        } as any,
      },
      orderBy: { createdAt: 'desc' },
    });

    const subscriptionId = subscription?.id ?? (existingRefund?.metadata as any)?.subscriptionId ?? null;
    const positivePackageTransactions = subscriptionId
      ? await prisma.transaction.findMany({
          where: {
            walletId: member.wallet.id,
            type: 'PACKAGE_SUBSCRIPTION',
            amount: { gt: 0 },
            metadata: {
              path: ['subscriptionId'],
              equals: subscriptionId,
            } as any,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const refundAmount = roundMoney(
      Number(subscription?.amountPaid ?? 0) ||
        positivePackageTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0),
    );

    const beforeWallet = {
      availableBalance: Number(member.wallet.availableBalance),
      pendingBalance: Number(member.wallet.pendingBalance),
      totalFunded: Number(member.wallet.totalFunded),
    };

    const summary: Record<string, unknown> = {
      mode: APPLY ? 'apply' : 'dry-run',
      member: {
        id: member.id,
        fullName: member.fullName,
        membershipNumber: member.membershipNumber,
        email: member.user.email,
      },
      walletBefore: beforeWallet,
      subscription: subscription
        ? {
            id: subscription.id,
            packageId: subscription.packageId,
            packageName: (subscription as any).package?.name,
            packageTotalAmount: Number((subscription as any).package?.totalAmount ?? 0),
            amountPaid: Number(subscription.amountPaid),
            amountRemaining: Number(subscription.amountRemaining),
            penaltyAccrued: Number(subscription.penaltyAccrued),
            status: subscription.status,
          }
        : null,
      positivePackageTransactions: positivePackageTransactions.map((transaction) => ({
        id: transaction.id,
        reference: transaction.reference,
        amount: Number(transaction.amount),
        createdAt: transaction.createdAt,
      })),
      refundAmount,
      alreadyRefunded: Boolean(existingRefund),
    };

    if (!APPLY) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    if (existingRefund) {
      const wallet = await prisma.wallet.findUnique({ where: { id: member.wallet.id } });
      console.log(
        JSON.stringify(
          {
            ...summary,
            skipped: true,
            reason: 'Refund correction already exists.',
            walletAfter: wallet && {
              availableBalance: Number(wallet.availableBalance),
              pendingBalance: Number(wallet.pendingBalance),
              totalFunded: Number(wallet.totalFunded),
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    if (!subscription) {
      throw new Error('Wrong inactive ₦5,000 package subscription not found.');
    }

    if (refundAmount <= 0) {
      throw new Error('No paid amount found to refund for the wrong package subscription.');
    }

    await prisma.runTransaction(
      'patch.alabiRemoveWrongPackage',
      async (tx) => {
        await (tx as any).repaymentScheduleItem.deleteMany({
          where: { targetType: 'PackageSubscription', targetId: subscription.id },
        });
        await (tx as any).walletDebtExposure.deleteMany({
          where: {
            OR: [
              { sourceKey: `package-penalty:${subscription.id}` },
              { sourceType: 'PackageSubscriptionPenalty', sourceId: subscription.id },
              { metadata: { path: ['subscriptionId'], equals: subscription.id } as any },
            ],
          },
        });
        await tx.packageSubscription.delete({ where: { id: subscription.id } });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: 'CORRECT_ALABI_WRONG_PACKAGE_REMOVE',
            entityType: 'PackageSubscription',
            entityId: subscription.id,
            metadata: {
              memberId: member.id,
              membershipNumber: member.membershipNumber,
              memberName: member.fullName,
              packageId: subscription.packageId,
              packageName: (subscription as any).package?.name,
              packageTotalAmount: Number((subscription as any).package?.totalAmount ?? 0),
              amountPaid: Number(subscription.amountPaid),
              amountRemaining: Number(subscription.amountRemaining),
              refundAmount,
            },
          },
        });
      },
      { maxWait: 10000, timeout: 30000 },
    );

    const reference = `ALABI-PACKAGE-REFUND-${Date.now()}`;
    const debtRecoveryPlan = await walletService.prepareWalletFundingDebtRecovery(member.id, refundAmount);
    const fundingResult = await walletService.creditWalletWithDebtRecovery(
      member.id,
      refundAmount,
      'ADMIN_REFUND',
      reference,
      {
        actorId: actor.id,
        category: 'package correction refund',
        description: `Refund for incorrect inactive package assignment for ${member.fullName}`,
        editable: false,
        lockReason: 'Correction refund generated by package data repair.',
        metadata: {
          correction: 'ALABI_WRONG_PACKAGE_REFUND',
          memberId: member.id,
          membershipNumber: member.membershipNumber,
          subscriptionId: subscription.id,
          packageId: subscription.packageId,
          packageName: (subscription as any).package?.name,
          originalPaidAmount: Number(subscription.amountPaid),
          trigger: 'DATA_CORRECTION',
        },
        debtRecoveryPlan,
      },
    );

    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'CORRECT_ALABI_WRONG_PACKAGE_REFUND',
        entityType: 'Transaction',
        entityId: fundingResult.transaction.id,
        metadata: {
          memberId: member.id,
          membershipNumber: member.membershipNumber,
          memberName: member.fullName,
          subscriptionId: subscription.id,
          refundAmount,
          debtSettlementAmount: fundingResult.debtSettlementAmount,
          walletCreditAmount: fundingResult.walletCreditAmount,
          settlements: fundingResult.settlements,
          exposures: fundingResult.exposures,
        },
      },
    });

    const [walletAfter, remainingSubscription, remainingSchedules, remainingExposures] = await Promise.all([
      prisma.wallet.findUnique({ where: { id: member.wallet.id } }),
      prisma.packageSubscription.findUnique({ where: { id: subscription.id } }),
      (prisma as any).repaymentScheduleItem.findMany({
        where: { targetType: 'PackageSubscription', targetId: subscription.id },
      }),
      (prisma as any).walletDebtExposure.findMany({
        where: {
          OR: [
            { sourceKey: `package-penalty:${subscription.id}` },
            { sourceType: 'PackageSubscriptionPenalty', sourceId: subscription.id },
            { metadata: { path: ['subscriptionId'], equals: subscription.id } as any },
          ],
        },
      }),
    ]);

    console.log(
      JSON.stringify(
        {
          ...summary,
          refundTransactionId: fundingResult.transaction.id,
          refundReference: fundingResult.transaction.reference,
          debtSettlementAmount: fundingResult.debtSettlementAmount,
          walletCreditAmount: fundingResult.walletCreditAmount,
          settlements: fundingResult.settlements,
          exposures: fundingResult.exposures,
          walletAfter: walletAfter && {
            availableBalance: Number(walletAfter.availableBalance),
            pendingBalance: Number(walletAfter.pendingBalance),
            totalFunded: Number(walletAfter.totalFunded),
          },
          verification: {
            packageSubscriptionRemoved: !remainingSubscription,
            remainingScheduleRows: remainingSchedules.length,
            remainingPackageExposureRows: remainingExposures.length,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
