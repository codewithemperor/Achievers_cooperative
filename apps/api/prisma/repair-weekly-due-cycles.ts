// @ts-nocheck
import { prisma } from "../prisma";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = process.argv.includes("--dry-run") || !APPLY;

const DEDUCTION_DAY_KEY = "COOPERATIVE_DEDUCTION_DAY";
const DEDUCTION_AMOUNT_KEY = "COOPERATIVE_DEDUCTION_AMOUNT";
const WEEKLY_DUES_START_DATE = new Date(Date.UTC(2026, 4, 17));
const OPEN_STATUSES = ["OUTSTANDING", "PARTIAL", "UPCOMING"];

function startOfIsoDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function statusForCycle(dueDate: Date, amount: number, amountPaid: number, asOf = new Date()) {
  if (amountPaid >= amount) {
    return dueDate.getTime() > startOfIsoDay(asOf).getTime() ? "PREPAID" : "PAID";
  }
  if (amountPaid > 0) return "PARTIAL";
  return dueDate.getTime() > startOfIsoDay(asOf).getTime() ? "UPCOMING" : "OUTSTANDING";
}

function cycleDatesThrough(throughDate: Date) {
  const dates: Date[] = [];
  for (
    let dueDate = startOfIsoDay(WEEKLY_DUES_START_DATE);
    dueDate.getTime() <= startOfIsoDay(throughDate).getTime();
    dueDate = addDays(dueDate, 7)
  ) {
    dates.push(dueDate);
  }
  return dates;
}

async function readPlan() {
  const [amountConfig, dayConfig, activeMembers, existingCycles, existingAllocations, weeklyTransactions, linkedPayments] =
    await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: DEDUCTION_AMOUNT_KEY } }),
      prisma.systemConfig.findUnique({ where: { key: DEDUCTION_DAY_KEY } }),
      prisma.member.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, fullName: true, membershipNumber: true },
        orderBy: { fullName: "asc" },
      }),
      prisma.weeklyDeductionCycle.count(),
      prisma.weeklyDeductionAllocation.count(),
      prisma.transaction.findMany({
        where: { type: "WEEKLY_COOPERATIVE", status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        include: { wallet: { select: { memberId: true } } },
      }),
      prisma.weeklyDeductionPayment.findMany({
        where: { transactionId: { not: null } },
        select: { transactionId: true },
      }),
    ]);

  const amount = Number(amountConfig?.value ?? 250);
  const linkedTransactionIds = new Set(linkedPayments.map((payment) => payment.transactionId).filter(Boolean));
  const missingPayments = weeklyTransactions.filter((transaction) => !linkedTransactionIds.has(transaction.id));
  const cycleDates = cycleDatesThrough(endOfMonth());

  return {
    amount,
    currentDay: dayConfig?.value ?? "(missing)",
    activeMembers,
    existingCycles,
    existingAllocations,
    weeklyTransactions,
    missingPayments,
    cycleDates,
  };
}

async function createCyclesForMember(client: any, memberId: string, amount: number, throughDate = endOfMonth()) {
  const dates = cycleDatesThrough(throughDate);
  if (!dates.length) return;
  await client.weeklyDeductionCycle.createMany({
    data: dates.map((dueDate) => ({
      memberId,
      dueDate,
      amount,
      amountPaid: 0,
      status: statusForCycle(dueDate, amount, 0),
    })),
    skipDuplicates: true,
  });
}

async function createNextCycle(client: any, memberId: string, amount: number) {
  const lastCycle = await client.weeklyDeductionCycle.findFirst({
    where: { memberId },
    orderBy: { dueDate: "desc" },
  });
  const dueDate = lastCycle ? addDays(lastCycle.dueDate, 7) : startOfIsoDay(WEEKLY_DUES_START_DATE);
  const existing = await client.weeklyDeductionCycle.findUnique({
    where: { memberId_dueDate: { memberId, dueDate } },
  });
  if (existing) return existing;

  return client.weeklyDeductionCycle.create({
    data: {
      memberId,
      dueDate,
      amount,
      amountPaid: 0,
      status: statusForCycle(dueDate, amount, 0),
    },
  });
}

async function allocatePayment(client: any, payment: any, amount: number, cycleAmount: number) {
  let remaining = amount;
  while (remaining > 0.0001) {
    let cycle = await client.weeklyDeductionCycle.findFirst({
      where: {
        memberId: payment.memberId,
        status: { in: OPEN_STATUSES },
      },
      orderBy: { dueDate: "asc" },
    });

    if (!cycle) {
      cycle = await createNextCycle(client, payment.memberId, cycleAmount);
    }

    const cycleAmount = toNumber(cycle.amount);
    const currentPaid = toNumber(cycle.amountPaid);
    const openAmount = Math.max(cycleAmount - currentPaid, 0);
    const allocationAmount = Math.min(openAmount, remaining);
    const nextPaid = currentPaid + allocationAmount;

    await client.weeklyDeductionAllocation.create({
      data: {
        paymentId: payment.id,
        cycleId: cycle.id,
        amount: allocationAmount,
      },
    });

    await client.weeklyDeductionCycle.update({
      where: { id: cycle.id },
      data: {
        amountPaid: nextPaid,
        status: statusForCycle(cycle.dueDate, cycleAmount, nextPaid, payment.paidAt),
      },
    });

    remaining -= allocationAmount;
  }
}

async function applyRepair(plan: Awaited<ReturnType<typeof readPlan>>) {
  await prisma.$transaction(
    async (client) => {
      await client.systemConfig.upsert({
        where: { key: DEDUCTION_DAY_KEY },
        update: { value: "SUNDAY" },
        create: { key: DEDUCTION_DAY_KEY, value: "SUNDAY" },
      });

      await client.weeklyDeductionAllocation.deleteMany();
      await client.weeklyDeductionCycle.deleteMany();

      for (const transaction of plan.missingPayments) {
        await client.weeklyDeductionPayment.create({
          data: {
            memberId: transaction.wallet.memberId,
            transactionId: transaction.id,
            amount: transaction.amount,
            mode: (transaction.metadata as any)?.manualWeeklyPayment ? "MEMBER" : "AUTO",
            paidAt: transaction.createdAt,
            metadata: {
              backfilledFromTransaction: true,
              reference: transaction.reference,
            },
          },
        });
      }

      for (const member of plan.activeMembers) {
        await createCyclesForMember(client, member.id, plan.amount);
      }

      const payments = await client.weeklyDeductionPayment.findMany({
        orderBy: [{ memberId: "asc" }, { paidAt: "asc" }, { createdAt: "asc" }],
      });

      for (const payment of payments) {
        await allocatePayment(client, payment, toNumber(payment.amount), plan.amount);
      }
    },
    { maxWait: 300000, timeout: 300000 },
  );
}

async function main() {
  const plan = await readPlan();
  const recreatedCycles = plan.activeMembers.length * plan.cycleDates.length;

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY"}`);
  console.log(`Weekly dues start date: ${WEEKLY_DUES_START_DATE.toISOString().slice(0, 10)}`);
  console.log(`Current configured day: ${plan.currentDay}`);
  console.log(`Configured amount: ${plan.amount}`);
  console.log(`Active members: ${plan.activeMembers.length}`);
  console.log(`Existing cycles to rebuild: ${plan.existingCycles}`);
  console.log(`Existing allocations to rebuild: ${plan.existingAllocations}`);
  console.log(`Cycle dates through current month: ${plan.cycleDates.map((date) => date.toISOString().slice(0, 10)).join(", ") || "none"}`);
  console.log(`Cycles to recreate before prepayments: ${recreatedCycles}`);
  console.log(`Approved weekly transactions: ${plan.weeklyTransactions.length}`);
  console.log(`Missing payment records to backfill: ${plan.missingPayments.length}`);

  if (plan.missingPayments.length) {
    console.log("\nMissing weekly payment records:");
    for (const transaction of plan.missingPayments) {
      console.log(
        `- ${transaction.reference || transaction.id} | ${transaction.wallet.memberId} | ${toNumber(transaction.amount).toLocaleString("en-NG")} | ${transaction.createdAt.toISOString()}`,
      );
    }
  }

  if (DRY_RUN) {
    console.log("\nDry run only. Run with --apply to rebuild weekly cycles from 2026-05-17.");
    return;
  }

  await applyRepair(plan);
  console.log("\nWeekly due cycles rebuilt successfully.");
}

main()
  .catch((error) => {
    console.error("Weekly due cycle repair failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
