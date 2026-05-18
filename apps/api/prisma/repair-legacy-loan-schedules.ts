// @ts-nocheck
import { prisma } from "../prisma";

type RepaymentFrequency = "MONTHLY" | "WEEKLY";

type LegacyLoanRepair = {
  names: string[];
  startDate: string;
  repaymentFrequency: RepaymentFrequency;
  tenorMonths: number;
  amount?: number;
  paid?: number;
  balance?: number;
};

const packageNextDueAt = legacyDate("2026-05-17");

const repairs: LegacyLoanRepair[] = [
  {
    names: ["Rafiu Kabir Olanrewaju", "Rafiu Kabir", "KB World"],
    startDate: "2026-04-26",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
    amount: 410_000,
    paid: 0,
    balance: 410_000,
  },
  {
    names: ["Olasunkanmi Saheed", "OLASUNKANMI"],
    startDate: "2025-11-30",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
    amount: 731_000,
    paid: 0,
    balance: 731_000,
  },
  {
    names: ["Gbadegesin Isiaka Aderoju", "Gbadegesin Isiaq Aderoju"],
    startDate: "2025-08-17",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
    amount: 900_000,
    paid: 684_250,
    balance: 215_750,
  },
  {
    names: ["Nafiu Akintola", "Akintola Nafiu"],
    startDate: "2026-01-07",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
    amount: 1_800_000,
    paid: 948_150,
    balance: 851_850,
  },
  {
    names: ["Adeshiyan Fatima Dasola", "Adeshiyan Fatima"],
    startDate: "2026-02-05",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 5,
    amount: 2_000_000,
    paid: 1_600_000,
    balance: 400_000,
  },
  {
    names: ["Mohammed Dayo", "Tajudeen Dayo"],
    startDate: "2025-10-05",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 10,
    amount: 400_000,
    paid: 164_000,
    balance: 236_000,
  },
  {
    names: ["Sarafadeen Olaide Moshood", "Sarafa Olaide"],
    startDate: "2026-01-11",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
    amount: 2_500_000,
    paid: 765_000,
    balance: 1_735_000,
  },
  {
    names: ["Adeyemi Adedayo Esther", "Adedayo Esther Adeyemi"],
    startDate: "2026-03-08",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
    amount: 1_000_000,
    paid: 262_000,
    balance: 738_000,
  },
  {
    names: ["Gbadegesin John Adewale", "John Adewale Gbadegesin"],
    startDate: "2025-12-07",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
    amount: 5_000_000,
    paid: 3_100_000,
    balance: 1_900_000,
  },
  {
    names: ["Adeshiyan Taofeek"],
    startDate: "2026-04-12",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 10,
    amount: 3_600_000,
    paid: 0,
    balance: 3_600_000,
  },
];

const completedLoanRepairs = [
  {
    names: ["Adiyu Hammed Olasile", "Adiyu Hammed", "Adiyu"],
    completedAt: legacyDate("2026-05-17"),
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function legacyDate(value: string) {
  return new Date(`${value}T09:00:00+01:00`);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function resolveSchedule(repair: LegacyLoanRepair) {
  const startDate = legacyDate(repair.startDate);
  const maturityDate = addMonths(startDate, repair.tenorMonths);

  if (repair.repaymentFrequency === "WEEKLY") {
    const weeks = Math.max(
      Math.ceil((maturityDate.getTime() - startDate.getTime()) / 604_800_000),
      1,
    );
    return {
      startDate,
      maturityDate,
      tenorMonths: repair.tenorMonths,
      installmentCount: weeks,
      tenorUnit: "WEEKS" as const,
    };
  }

  return {
    startDate,
    maturityDate,
    tenorMonths: repair.tenorMonths,
    installmentCount: repair.tenorMonths,
    tenorUnit: "MONTHS" as const,
  };
}

function nextLoanRepaymentDate(repair: LegacyLoanRepair, schedule: ReturnType<typeof resolveSchedule>, balance: number) {
  if (balance <= 0) return null;

  const totalAmount = Number(repair.amount ?? balance);
  const amountPaidSoFar = Math.max(totalAmount - balance, 0);
  const installmentAmount = totalAmount / Math.max(schedule.installmentCount, 1);
  const paidInstallments = installmentAmount > 0 ? Math.floor(amountPaidSoFar / installmentAmount) : 0;
  const nextStep = Math.min(paidInstallments + 1, Math.max(schedule.installmentCount, 1));
  const next = new Date(schedule.startDate);

  if (schedule.tenorUnit === "WEEKS") {
    next.setDate(next.getDate() + nextStep * 7);
  } else {
    next.setMonth(next.getMonth() + nextStep);
  }

  return next;
}

function nextLoanRepaymentDateFromLoan(loan: any, schedule: ReturnType<typeof resolveSchedule>) {
  const remainingBalance = Number(loan.remainingBalance ?? 0);
  if (remainingBalance <= 0 || ["COMPLETED", "REJECTED", "PENDING", "APPROVED"].includes(loan.status)) {
    return null;
  }

  const disbursedAmount = Number(loan.disbursedAmount ?? 0) || Number(loan.amount ?? 0);
  if (disbursedAmount <= 0) return null;

  const amountPaidSoFar = Math.max(disbursedAmount - remainingBalance, 0);
  const installmentAmount = disbursedAmount / Math.max(schedule.installmentCount, 1);
  const paidInstallments = installmentAmount > 0 ? Math.floor(amountPaidSoFar / installmentAmount) : 0;
  const nextStep = Math.min(paidInstallments + 1, Math.max(schedule.installmentCount, 1));
  const next = new Date(schedule.startDate);

  if (schedule.tenorUnit === "WEEKS") {
    next.setDate(next.getDate() + nextStep * 7);
  } else {
    next.setMonth(next.getMonth() + nextStep);
  }

  return next;
}

async function findMember(repair: LegacyLoanRepair) {
  const members = await prisma.member.findMany({
    include: { wallet: true },
  });
  const keys = repair.names.map(normalize);

  return members.find((member) => {
    const memberKey = normalize(member.fullName);
    return keys.some((key) => memberKey === key || memberKey.includes(key) || key.includes(memberKey));
  });
}

async function repairPackages() {
  const updatedPackages = await prisma.package.updateMany({
    where: {
      OR: [
        { name: { contains: "Legacy" } },
        { repaymentFrequency: { not: "WEEKLY" } },
      ],
    },
    data: {
      repaymentFrequency: "WEEKLY",
      startDate: packageNextDueAt,
    },
  });

  const updatedSubscriptions = await prisma.packageSubscription.updateMany({
    where: {
      status: { in: ["APPROVED", "DISBURSED", "IN_PROGRESS"] },
      amountRemaining: { gt: 0 },
    },
    data: {
      nextDueAt: packageNextDueAt,
    },
  });

  console.log(`Package plans updated: ${updatedPackages.count}`);
  console.log(`Active package subscriptions next due updated: ${updatedSubscriptions.count}`);
}

async function repairLoans() {
  for (const repair of repairs) {
    const member = await findMember(repair);

    if (!member) {
      console.log(`Skipped loan repair, member not found: ${repair.names[0]}`);
      continue;
    }

    const loan = await prisma.loanApplication.findFirst({
      where: {
        memberId: member.id,
        ...(repair.amount ? { amount: repair.amount } : {}),
      },
      orderBy: { submittedAt: "desc" },
    });

    if (!loan) {
      console.log(`Skipped loan repair, loan not found: ${member.fullName}`);
      continue;
    }

    const schedule = resolveSchedule(repair);

    await prisma.loanApplication.update({
      where: { id: loan.id },
      data: {
        tenorMonths: schedule.tenorMonths,
        tenorUnit: schedule.tenorUnit,
        submittedAt: schedule.startDate,
        approvedAt: schedule.startDate,
        disbursedAt: schedule.startDate,
        dueDate: schedule.maturityDate,
        nextRepaymentAt: nextLoanRepaymentDateFromLoan(loan, schedule),
      },
    });

    await prisma.loanActivity.updateMany({
      where: { loanId: loan.id, type: "DISBURSEMENT" },
      data: {
        previousAmount: 0,
        createdAt: schedule.startDate,
        metadata: {
          memberName: member.fullName,
          membershipNumber: member.membershipNumber,
          legacyStartDate: repair.startDate,
          repaymentFrequency: repair.repaymentFrequency,
          maturityDate: schedule.maturityDate.toISOString(),
        },
      },
    });

    if (member.wallet) {
      await prisma.transaction.updateMany({
        where: {
          walletId: member.wallet.id,
          type: "LOAN_DISBURSEMENT",
          OR: [
            { reference: { startsWith: "OPENING-LOAN-DISBURSEMENT" } },
            { metadata: { path: ["loanId"], equals: loan.id } as any },
          ],
        },
        data: {
          createdAt: schedule.startDate,
          updatedAt: schedule.startDate,
          metadata: {
            memberId: member.id,
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            loanId: loan.id,
            loanName: loan.purpose,
            legacyStartDate: repair.startDate,
            repaymentFrequency: repair.repaymentFrequency,
            maturityDate: schedule.maturityDate.toISOString(),
          },
        },
      });
    }

    console.log(
      `Repaired loan for ${member.fullName}: ${repair.repaymentFrequency}, start ${repair.startDate}, maturity ${schedule.maturityDate.toISOString().slice(0, 10)}`,
    );
  }
}

async function repairCompletedLoans() {
  const members = await prisma.member.findMany({ include: { wallet: true } });

  for (const repair of completedLoanRepairs) {
    const keys = repair.names.map(normalize);
    const member = members.find((item) => {
      const memberKey = normalize(item.fullName);
      return keys.some((key) => memberKey === key || memberKey.includes(key) || key.includes(memberKey));
    });

    if (!member) {
      console.log(`Skipped completed loan repair, member not found: ${repair.names[0]}`);
      continue;
    }

    const loan = await prisma.loanApplication.findFirst({
      where: {
        memberId: member.id,
      },
      orderBy: { submittedAt: "desc" },
    });

    if (!loan) {
      console.log(`Skipped completed loan repair, loan not found: ${member.fullName}`);
      continue;
    }

    await prisma.loanApplication.update({
      where: { id: loan.id },
      data: {
        status: "COMPLETED",
        remainingBalance: 0,
        nextRepaymentAt: null,
        dueDate: repair.completedAt,
      } as any,
    });

    console.log(`Marked loan completed for ${member.fullName}`);
  }
}

async function backfillMissingNextRepaymentDates() {
  const loans = await prisma.loanApplication.findMany({
    where: {
      status: { in: ["DISBURSED", "IN_PROGRESS", "OVERDUE"] },
      remainingBalance: { gt: 0 },
      nextRepaymentAt: null,
    },
    include: {
      member: {
        select: {
          fullName: true,
          membershipNumber: true,
        },
      },
    },
  } as any);

  for (const loan of loans) {
    const startDate = loan.disbursedAt ?? loan.approvedAt ?? loan.submittedAt;
    const tenorUnit = (loan as any).tenorUnit ?? "MONTHS";
    const disbursedAmount = Number((loan as any).disbursedAmount ?? 0) || Number(loan.amount);
    const remainingBalance = Number(loan.remainingBalance);
    const amountPaidSoFar = Math.max(disbursedAmount - remainingBalance, 0);
    const maturityDate = loan.dueDate ?? addMonths(startDate, Math.max(loan.tenorMonths, 1));
    const installmentCount =
      tenorUnit === "WEEKS"
        ? Math.max(Math.ceil((maturityDate.getTime() - startDate.getTime()) / 604_800_000), 1)
        : Math.max(loan.tenorMonths, 1);
    const installmentAmount = disbursedAmount / installmentCount;
    const paidInstallments = installmentAmount > 0 ? Math.floor(amountPaidSoFar / installmentAmount) : 0;
    const nextStep = Math.min(paidInstallments + 1, installmentCount);
    const nextRepaymentAt = new Date(startDate);

    if (tenorUnit === "WEEKS") {
      nextRepaymentAt.setDate(nextRepaymentAt.getDate() + nextStep * 7);
    } else {
      nextRepaymentAt.setMonth(nextRepaymentAt.getMonth() + nextStep);
    }

    await prisma.loanApplication.update({
      where: { id: loan.id },
      data: { nextRepaymentAt } as any,
    });

    console.log(
      `Backfilled next repayment for ${loan.member.fullName} (${loan.member.membershipNumber}): ${nextRepaymentAt.toISOString().slice(0, 10)}`,
    );
  }

  console.log(`Backfilled missing loan next repayment dates: ${loans.length}`);
}

async function reportNullNextRepaymentDates() {
  const loans = await prisma.loanApplication.findMany({
    where: { nextRepaymentAt: null },
    include: {
      member: {
        select: {
          fullName: true,
          membershipNumber: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  } as any);

  const repayableMissing = loans.filter(
    (loan) =>
      ["DISBURSED", "IN_PROGRESS", "OVERDUE"].includes(loan.status) &&
      Number(loan.remainingBalance) > 0,
  );
  const intentionallyNull = loans.filter((loan) => !repayableMissing.some((item) => item.id === loan.id));

  if (repayableMissing.length) {
    console.log("WARNING: Active repayable loans still missing nextRepaymentAt:");
    for (const loan of repayableMissing) {
      console.log(
        `- ${loan.member.fullName} (${loan.member.membershipNumber}) | status=${loan.status} | balance=${Number(loan.remainingBalance).toLocaleString()} | disbursedAt=${loan.disbursedAt?.toISOString().slice(0, 10) ?? "--"}`,
      );
    }
  } else {
    console.log("No active repayable loans are missing nextRepaymentAt.");
  }

  if (intentionallyNull.length) {
    console.log("Loans intentionally left without nextRepaymentAt because they are not currently repayable:");
    for (const loan of intentionallyNull) {
      console.log(
        `- ${loan.member.fullName} (${loan.member.membershipNumber}) | status=${loan.status} | balance=${Number(loan.remainingBalance).toLocaleString()}`,
      );
    }
  }
}

async function main() {
  console.log("Repairing legacy package schedules...");
  await repairPackages();
  console.log("Repairing legacy loan schedules...");
  await repairLoans();
  console.log("Marking completed legacy loans...");
  await repairCompletedLoans();
  console.log("Backfilling missing loan next repayment dates...");
  await backfillMissingNextRepaymentDates();
  console.log("Checking remaining null loan next repayment dates...");
  await reportNullNextRepaymentDates();
  console.log("Legacy loan/package schedule repair completed.");
}

main()
  .catch((error) => {
    console.error("Legacy loan/package schedule repair failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
