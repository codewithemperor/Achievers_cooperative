// @ts-nocheck
import { prisma } from "../prisma";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = process.argv.includes("--dry-run") || !APPLY;

const DEDUCTION_DAY_KEY = "COOPERATIVE_DEDUCTION_DAY";
const DEDUCTION_AMOUNT_KEY = "COOPERATIVE_DEDUCTION_AMOUNT";
const WEEKLY_DUES_START_DATE = new Date(Date.UTC(2026, 4, 17));
const OPEN_STATUSES = ["OUTSTANDING", "PARTIAL", "UPCOMING"];
const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

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

function firstDueOnOrAfter(startDate: Date, day: string) {
  const targetDay = Math.max(DAYS.indexOf(day.toUpperCase()), 0);
  const first = startOfIsoDay(startDate);
  const offset = (targetDay - first.getUTCDay() + 7) % 7;
  return addDays(first, offset);
}

function memberWeeklyStart(member: { joinedAt: Date; weeklyDeductionStartsAt?: Date | null }) {
  if (member.weeklyDeductionStartsAt) return startOfIsoDay(member.weeklyDeductionStartsAt);
  const joined = startOfIsoDay(member.joinedAt);
  const opening = startOfIsoDay(WEEKLY_DUES_START_DATE);
  return joined.getTime() > opening.getTime() ? joined : opening;
}

function cycleDatesThrough(startDate: Date, throughDate: Date, day = "SUNDAY") {
  const dates: Date[] = [];
  for (
    let dueDate = firstDueOnOrAfter(startDate, day);
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
        select: { id: true, fullName: true, membershipNumber: true, joinedAt: true, weeklyDeductionStartsAt: true },
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
  const day = "SUNDAY";
  const linkedTransactionIds = new Set(linkedPayments.map((payment) => payment.transactionId).filter(Boolean));
  const missingPayments = weeklyTransactions.filter((transaction) => !linkedTransactionIds.has(transaction.id));
  const cycleDatesByMember = activeMembers.map((member) => ({
    member,
    startDate: memberWeeklyStart(member),
    dates: cycleDatesThrough(memberWeeklyStart(member), endOfMonth(), day),
  }));
  const cycleCount = cycleDatesByMember.reduce((sum, item) => sum + item.dates.length, 0);

  return {
    amount,
    day,
    currentDay: dayConfig?.value ?? "(missing)",
    activeMembers,
    cycleDatesByMember,
    cycleCount,
    existingCycles,
    existingAllocations,
    weeklyTransactions,
    missingPayments,
  };
}

async function createCyclesForMember(client: any, member: any, amount: number, day: string, throughDate = endOfMonth()) {
  const dates = cycleDatesThrough(memberWeeklyStart(member), throughDate, day);
  if (!dates.length) return;
  await client.weeklyDeductionCycle.createMany({
    data: dates.map((dueDate) => ({
      memberId: member.id,
      dueDate,
      amount,
      amountPaid: 0,
      status: statusForCycle(dueDate, amount, 0),
    })),
    skipDuplicates: true,
  });
}

async function createNextCycle(client: any, member: any, amount: number, day: string) {
  const lastCycle = await client.weeklyDeductionCycle.findFirst({
    where: { memberId: member.id },
    orderBy: { dueDate: "desc" },
  });
  const dueDate = lastCycle
    ? firstDueOnOrAfter(addDays(lastCycle.dueDate, 1), day)
    : firstDueOnOrAfter(memberWeeklyStart(member), day);
  const existing = await client.weeklyDeductionCycle.findUnique({
    where: { memberId_dueDate: { memberId: member.id, dueDate } },
  });
  if (existing) return existing;

  return client.weeklyDeductionCycle.create({
    data: {
      memberId: member.id,
      dueDate,
      amount,
      amountPaid: 0,
      status: statusForCycle(dueDate, amount, 0),
    },
  });
}

async function allocatePayment(client: any, member: any, payment: any, amount: number, cycleAmount: number, day: string) {
  let remaining = amount;
  while (remaining > 0.0001) {
    let cycle = await client.weeklyDeductionCycle.findFirst({
      where: {
        memberId: member.id,
        status: { in: OPEN_STATUSES },
      },
      orderBy: { dueDate: "asc" },
    });

    if (!cycle) {
      cycle = await createNextCycle(client, member, cycleAmount, day);
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

      for (const member of plan.activeMembers) {
        await client.member.update({
          where: { id: member.id },
          data: { weeklyDeductionStartsAt: memberWeeklyStart(member) },
        });
      }

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
        await createCyclesForMember(client, member, plan.amount, plan.day);
      }

      const memberById = new Map(plan.activeMembers.map((member) => [member.id, member]));
      const payments = await client.weeklyDeductionPayment.findMany({
        orderBy: [{ memberId: "asc" }, { paidAt: "asc" }, { createdAt: "asc" }],
      });

      for (const payment of payments) {
        const member = memberById.get(payment.memberId);
        if (member) {
          await allocatePayment(client, member, payment, toNumber(payment.amount), plan.amount, plan.day);
        }
      }
    },
    { maxWait: 300000, timeout: 300000 },
  );
}

async function main() {
  const plan = await readPlan();

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY"}`);
  console.log(`Legacy weekly dues start date: ${WEEKLY_DUES_START_DATE.toISOString().slice(0, 10)}`);
  console.log(`Current configured day: ${plan.currentDay}`);
  console.log(`Configured day after repair: ${plan.day}`);
  console.log(`Configured amount: ${plan.amount}`);
  console.log(`Active members: ${plan.activeMembers.length}`);
  console.log(`Existing cycles to rebuild: ${plan.existingCycles}`);
  console.log(`Existing allocations to rebuild: ${plan.existingAllocations}`);
  console.log(`Cycles to recreate before prepayments: ${plan.cycleCount}`);
  console.log(`Approved weekly transactions: ${plan.weeklyTransactions.length}`);
  console.log(`Missing payment records to backfill: ${plan.missingPayments.length}`);
  console.log(
    `Member weekly starts to set: ${plan.activeMembers.filter((member) => !member.weeklyDeductionStartsAt || startOfIsoDay(member.weeklyDeductionStartsAt).getTime() !== memberWeeklyStart(member).getTime()).length}`,
  );

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
