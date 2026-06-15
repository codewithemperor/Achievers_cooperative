import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const WEEKLY_OPEN_STATUSES = ['OUTSTANDING', 'PARTIAL', 'UPCOMING'];

type DebtFrame = {
  memberId: string;
  memberName: string;
  membershipNumber: string;
  walletId?: string | null;
  phase: string;
  sourceType: string;
  sourceId: string;
  sourceKey: string;
  targetId: string;
  dueAmount: number;
  dueAt?: Date | null;
  metadata: Record<string, unknown>;
};

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function startOfIsoDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function weeklySourceKey(cycleId: string) {
  return `weekly:${cycleId}`;
}

function scheduleSourceKey(targetType: string, itemId: string) {
  return `${targetType === 'LoanApplication' ? 'loan' : 'package'}:${itemId}`;
}

function packagePenaltySourceKey(subscriptionId: string) {
  return `package-penalty:${subscriptionId}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectDebtFrames(): Promise<DebtFrame[]> {
  const today = startOfIsoDay(new Date());
  const dueBefore = addDays(today, 1);
  const frames: DebtFrame[] = [];

  const weeklyCycles = await (prisma as any).weeklyDeductionCycle.findMany({
    where: {
      member: { status: 'ACTIVE' },
      dueDate: { lte: today },
      status: { in: WEEKLY_OPEN_STATUSES },
    },
    include: {
      member: {
        select: {
          id: true,
          fullName: true,
          membershipNumber: true,
          wallet: { select: { id: true } },
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }],
  });

  for (const cycle of weeklyCycles) {
    const dueAmount = roundMoney(Math.max(Number(cycle.amount) - Number(cycle.amountPaid), 0));
    if (dueAmount <= 0) continue;
    frames.push({
      memberId: cycle.memberId,
      memberName: cycle.member.fullName,
      membershipNumber: cycle.member.membershipNumber,
      walletId: cycle.member.wallet?.id,
      phase: 'WEEKLY_DEDUCTION',
      sourceType: 'WeeklyDeductionCycle',
      sourceId: cycle.id,
      sourceKey: weeklySourceKey(cycle.id),
      targetId: cycle.id,
      dueAmount,
      dueAt: cycle.dueDate,
      metadata: {
        cycleId: cycle.id,
        expectedAmount: Number(cycle.amount),
        paidAmount: Number(cycle.amountPaid),
        remainingAmount: dueAmount,
        source: 'wallet-debt-exposure-correction',
      },
    });
  }

  const packageSubscriptions = await prisma.packageSubscription.findMany({
    where: {
      member: { status: 'ACTIVE' },
      status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] as any },
      OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
    },
    include: {
      package: true,
      member: {
        select: {
          id: true,
          fullName: true,
          membershipNumber: true,
          wallet: { select: { id: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  } as any);

  const packageItems = await (prisma as any).repaymentScheduleItem.findMany({
    where: {
      targetType: 'PackageSubscription',
      dueDate: { lt: dueBefore },
      remainingAmount: { gt: 0 },
      member: { status: 'ACTIVE' },
    },
    orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
  });
  const packageItemsByTarget = new Map<string, any[]>();
  for (const item of packageItems) {
    packageItemsByTarget.set(item.targetId, [...(packageItemsByTarget.get(item.targetId) ?? []), item]);
  }

  for (const subscription of packageSubscriptions as any[]) {
    const packageName = subscription.package?.name ?? 'package';
    const dueItems = packageItemsByTarget.get(subscription.id) ?? [];
    const firstDueAt = dueItems[0]?.dueDate ?? subscription.nextDueAt ?? subscription.createdAt ?? new Date();
    const penaltyAccrued = roundMoney(Math.max(Number(subscription.penaltyAccrued ?? 0), 0));

    if (penaltyAccrued > 0) {
      frames.push({
        memberId: subscription.memberId,
        memberName: subscription.member.fullName,
        membershipNumber: subscription.member.membershipNumber,
        walletId: subscription.member.wallet?.id,
        phase: 'PACKAGE_PENALTY',
        sourceType: 'PackageSubscriptionPenalty',
        sourceId: subscription.id,
        sourceKey: packagePenaltySourceKey(subscription.id),
        targetId: subscription.id,
        dueAmount: penaltyAccrued,
        dueAt: firstDueAt,
        metadata: {
          subscriptionId: subscription.id,
          packageName,
          remainingAmount: penaltyAccrued,
          source: 'wallet-debt-exposure-correction',
        },
      });
    }

    let amountRemainingCap = roundMoney(Math.max(Number(subscription.amountRemaining ?? 0), 0));
    for (const item of dueItems) {
      if (amountRemainingCap <= 0) break;
      const dueAmount = roundMoney(Math.min(Number(item.remainingAmount), amountRemainingCap));
      if (dueAmount <= 0) continue;
      frames.push({
        memberId: subscription.memberId,
        memberName: subscription.member.fullName,
        membershipNumber: subscription.member.membershipNumber,
        walletId: subscription.member.wallet?.id,
        phase: 'PACKAGE',
        sourceType: 'RepaymentScheduleItem',
        sourceId: item.id,
        sourceKey: scheduleSourceKey('PackageSubscription', item.id),
        targetId: subscription.id,
        dueAmount,
        dueAt: item.dueDate,
        metadata: {
          subscriptionId: subscription.id,
          packageName,
          sequence: item.sequence,
          expectedAmount: Number(item.expectedAmount),
          paidAmount: Number(item.paidAmount),
          remainingAmount: dueAmount,
          source: 'wallet-debt-exposure-correction',
        },
      });
      amountRemainingCap = roundMoney(amountRemainingCap - dueAmount);
    }
  }

  const loans = await prisma.loanApplication.findMany({
    where: {
      member: { status: 'ACTIVE' },
      status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE'] as any },
      remainingBalance: { gt: 0 },
    },
    include: {
      member: {
        select: {
          id: true,
          fullName: true,
          membershipNumber: true,
          wallet: { select: { id: true } },
        },
      },
    },
    orderBy: [{ submittedAt: 'asc' }],
  } as any);
  const loanItems = await (prisma as any).repaymentScheduleItem.findMany({
    where: {
      targetType: 'LoanApplication',
      dueDate: { lt: dueBefore },
      remainingAmount: { gt: 0 },
      member: { status: 'ACTIVE' },
    },
    orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
  });
  const loanItemsByTarget = new Map<string, any[]>();
  for (const item of loanItems) {
    loanItemsByTarget.set(item.targetId, [...(loanItemsByTarget.get(item.targetId) ?? []), item]);
  }

  for (const loan of loans as any[]) {
    const dueItems = loanItemsByTarget.get(loan.id) ?? [];
    const loanName = loan.purpose || `loan for ${loan.member.fullName}`;
    let remainingBalanceCap = roundMoney(Math.max(Number(loan.remainingBalance ?? 0), 0));
    for (const item of dueItems) {
      if (remainingBalanceCap <= 0) break;
      const dueAmount = roundMoney(Math.min(Number(item.remainingAmount), remainingBalanceCap));
      if (dueAmount <= 0) continue;
      frames.push({
        memberId: loan.memberId,
        memberName: loan.member.fullName,
        membershipNumber: loan.member.membershipNumber,
        walletId: loan.member.wallet?.id,
        phase: 'LOAN',
        sourceType: 'RepaymentScheduleItem',
        sourceId: item.id,
        sourceKey: scheduleSourceKey('LoanApplication', item.id),
        targetId: loan.id,
        dueAmount,
        dueAt: item.dueDate,
        metadata: {
          loanId: loan.id,
          loanName,
          sequence: item.sequence,
          expectedAmount: Number(item.expectedAmount),
          paidAmount: Number(item.paidAmount),
          remainingAmount: dueAmount,
          source: 'wallet-debt-exposure-correction',
        },
      });
      remainingBalanceCap = roundMoney(remainingBalanceCap - dueAmount);
    }
  }

  return frames;
}

async function main() {
  const frames = await collectDebtFrames();
  const memberIds = [...new Set(frames.map((frame) => frame.memberId))];
  const [wallets, existingExposures] = await Promise.all([
    prisma.wallet.findMany({ where: { memberId: { in: memberIds } } }),
    (prisma as any).walletDebtExposure.findMany({
      where: { sourceKey: { in: frames.map((frame) => frame.sourceKey) } },
    }),
  ]);
  const walletByMember = new Map(wallets.map((wallet) => [wallet.memberId, wallet]));
  const exposureBySource = new Map(existingExposures.map((exposure: any) => [exposure.sourceKey, exposure]));
  const framesByMember = new Map<string, DebtFrame[]>();

  for (const frame of frames) {
    framesByMember.set(frame.memberId, [...(framesByMember.get(frame.memberId) ?? []), frame]);
  }

  const report = [];
  for (const [memberId, memberFrames] of framesByMember) {
    const wallet = walletByMember.get(memberId);
    const currentWalletBalance = roundMoney(Number(wallet?.availableBalance ?? 0));
    const actualOutstandingDebt = roundMoney(memberFrames.reduce((sum, frame) => sum + frame.dueAmount, 0));
    const existingOpenExposure = roundMoney(
      memberFrames.reduce((sum, frame) => {
        const exposure: any = exposureBySource.get(frame.sourceKey);
        return sum + Math.max(Number(exposure?.amountExposed ?? 0) - Number(exposure?.amountCleared ?? 0), 0);
      }, 0),
    );
    const currentNegativeDebt = Math.max(Math.abs(Math.min(currentWalletBalance, 0)), 0);
    const differenceFound = roundMoney(actualOutstandingDebt - currentNegativeDebt);
    const skippedReason =
      currentWalletBalance > 0
        ? 'POSITIVE_BALANCE_FOUND_RUN_ADMIN_DEDUCTION_FIRST'
        : null;
    const correctedWalletBalance = skippedReason ? currentWalletBalance : roundMoney(-actualOutstandingDebt);

    report.push({
      memberId,
      membershipNumber: memberFrames[0].membershipNumber,
      memberName: memberFrames[0].memberName,
      currentWalletBalance,
      actualOutstandingDebt,
      existingOpenExposure,
      differenceFound,
      correctedWalletBalance,
      frameCount: memberFrames.length,
      skippedReason,
    });
  }

  if (APPLY) {
    for (const [memberId, memberFrames] of framesByMember) {
      const reportRow = report.find((row) => row.memberId === memberId);
      if (reportRow?.skippedReason) {
        continue;
      }
      const alreadyCorrected =
        reportRow &&
        Math.abs(reportRow.differenceFound) < 0.01 &&
        Math.abs(reportRow.existingOpenExposure - reportRow.actualOutstandingDebt) < 0.01;
      if (alreadyCorrected) {
        continue;
      }

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await prisma.$transaction(
            async (tx) => {
              const wallet =
                (await tx.wallet.findUnique({ where: { memberId } })) ??
                (await tx.wallet.create({ data: { memberId } }));

              for (const frame of memberFrames) {
                const existing = await (tx as any).walletDebtExposure.findUnique({
                  where: { sourceKey: frame.sourceKey },
                });
                const amountCleared = roundMoney(Number(existing?.amountCleared ?? 0));
                const data = {
                  memberId,
                  walletId: wallet.id,
                  phase: frame.phase,
                  sourceType: frame.sourceType,
                  sourceId: frame.sourceId,
                  sourceKey: frame.sourceKey,
                  dueAt: frame.dueAt ?? null,
                  amountExposed: roundMoney(frame.dueAmount + amountCleared),
                  amountCleared,
                  status: 'OPEN',
                  trigger: 'CORRECTION',
                  clearedAt: null,
                  metadata: {
                    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
                    ...frame.metadata,
                    correctionAppliedAt: new Date().toISOString(),
                  },
                };

                if (existing) {
                  await (tx as any).walletDebtExposure.update({
                    where: { id: existing.id },
                    data,
                  });
                } else {
                  await (tx as any).walletDebtExposure.create({ data });
                }
              }

              await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                  availableBalance: roundMoney(-memberFrames.reduce((sum, frame) => sum + frame.dueAmount, 0)),
                  pendingBalance: roundMoney(memberFrames.reduce((sum, frame) => sum + frame.dueAmount, 0)),
                },
              });
            },
            { maxWait: 10000, timeout: 60000 },
          );
          break;
        } catch (error) {
          if (attempt >= 3) {
            throw error;
          }
          await prisma.$disconnect().catch(() => null);
          await sleep(attempt * 3000);
          await prisma.$connect();
        }
      }
    }
  }

  const output = {
    mode: APPLY ? 'apply' : 'dry-run',
    generatedAt: new Date().toISOString(),
    totals: {
      affectedMembers: report.length,
      skippedMembers: report.filter((row) => row.skippedReason).length,
      actualOutstandingDebt: roundMoney(report.reduce((sum, row) => sum + row.actualOutstandingDebt, 0)),
      differenceFound: roundMoney(report.reduce((sum, row) => sum + row.differenceFound, 0)),
    },
    items: report.sort((a, b) => b.actualOutstandingDebt - a.actualOutstandingDebt),
  };

  const reportsDir = join(process.cwd(), 'prisma', 'reports');
  await mkdir(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, `wallet-debt-exposures-${APPLY ? 'apply' : 'dry-run'}-${Date.now()}.json`);
  await writeFile(reportPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(JSON.stringify({ ...output.totals, mode: output.mode, reportPath }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
