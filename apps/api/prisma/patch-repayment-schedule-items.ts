import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function addTenorStep(date: Date, unit: string, steps: number) {
  const next = new Date(date);
  if (unit === 'WEEKS') {
    next.setDate(next.getDate() + steps * 7);
    return next;
  }

  next.setMonth(next.getMonth() + steps);
  return next;
}

function addCalendarMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function fullMonthsBetween(start: Date, end: Date) {
  if (end <= start) return 0;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

function statusForFrame(dueDate: Date, expectedAmount: number, paidAmount: number, asOf = new Date()) {
  if (paidAmount >= expectedAmount) return 'PAID';
  if (paidAmount > 0) return 'PARTIAL';
  return dueDate.getTime() <= asOf.getTime() ? 'OVERDUE' : 'UPCOMING';
}

function splitInstallments(totalAmount: number, count: number) {
  const total = roundMoney(totalAmount);
  const frameCount = Math.max(Math.ceil(count || 1), 1);
  const regular = roundMoney(total / frameCount);
  let allocated = 0;

  return Array.from({ length: frameCount }, (_, index) => {
    const amount = index === frameCount - 1 ? roundMoney(total - allocated) : regular;
    allocated = roundMoney(allocated + amount);
    return amount;
  });
}

function buildPackageRows(subscription: any) {
  const pkg = subscription.package;
  const anchor = pkg.startDate ?? subscription.disbursedAt ?? subscription.approvedAt ?? subscription.createdAt ?? new Date();
  const frequency = String(pkg.repaymentFrequency ?? 'WEEKLY').toUpperCase();
  const count =
    frequency === 'MONTHLY'
      ? Math.max(Number(pkg.durationMonths) || 1, 1)
      : pkg.endDate && pkg.endDate > anchor
        ? Math.max(Math.ceil((pkg.endDate.getTime() - anchor.getTime()) / WEEK_MS), 1)
        : Math.max((Number(pkg.durationMonths) || 1) * 4, 1);
  const installments = splitInstallments(Number(pkg.totalAmount), count);
  const totalPaid =
    subscription.status === 'COMPLETED'
      ? Number(pkg.totalAmount)
      : Math.max(Number(subscription.amountPaid ?? 0), 0);
  let remainingPaid = totalPaid;

  return installments.map((expectedAmount, index) => {
    const dueDate = addTenorStep(anchor, frequency === 'MONTHLY' ? 'MONTHS' : 'WEEKS', index + 1);
    const paidAmount = roundMoney(Math.min(Math.max(remainingPaid, 0), expectedAmount));
    remainingPaid = roundMoney(remainingPaid - paidAmount);
    return {
      memberId: subscription.memberId,
      targetType: 'PackageSubscription',
      targetId: subscription.id,
      sequence: index + 1,
      dueDate,
      expectedAmount,
      paidAmount,
      remainingAmount: roundMoney(Math.max(expectedAmount - paidAmount, 0)),
      status: statusForFrame(dueDate, expectedAmount, paidAmount),
      metadata: {
        packageId: pkg.id,
        packageName: pkg.name,
        repaymentFrequency: frequency,
        source: 'backfill',
      },
    };
  });
}

function buildLoanRows(loan: any) {
  const anchor = loan.disbursedAt ?? loan.approvedAt ?? loan.submittedAt ?? new Date();
  const maturity = loan.dueDate ?? addCalendarMonths(anchor, Math.max(Number(loan.tenorMonths) || 1, 1));
  const tenorUnit = String(loan.tenorUnit ?? 'MONTHS').toUpperCase();
  const count =
    tenorUnit === 'WEEKS'
      ? Math.max(Math.ceil((maturity.getTime() - anchor.getTime()) / WEEK_MS), 1)
      : Math.max(Math.ceil(Number(loan.tenorMonths) || fullMonthsBetween(anchor, maturity) || 1), 1);
  const totalAmount =
    Number(loan.disbursedAmount ?? 0) > 0 || loan.status === 'COMPLETED'
      ? Number(loan.disbursedAmount ?? 0) || Number(loan.amount)
      : Number(loan.amount);
  const installments = splitInstallments(totalAmount, count);
  const totalPaid =
    loan.status === 'COMPLETED'
      ? totalAmount
      : Math.max(totalAmount - Number(loan.remainingBalance ?? 0), 0);
  let remainingPaid = totalPaid;

  return installments.map((expectedAmount, index) => {
    const dueDate = addTenorStep(anchor, tenorUnit === 'WEEKS' ? 'WEEKS' : 'MONTHS', index + 1);
    const paidAmount = roundMoney(Math.min(Math.max(remainingPaid, 0), expectedAmount));
    remainingPaid = roundMoney(remainingPaid - paidAmount);
    return {
      memberId: loan.memberId,
      targetType: 'LoanApplication',
      targetId: loan.id,
      sequence: index + 1,
      dueDate,
      expectedAmount,
      paidAmount,
      remainingAmount: roundMoney(Math.max(expectedAmount - paidAmount, 0)),
      status: statusForFrame(dueDate, expectedAmount, paidAmount),
      metadata: {
        loanPurpose: loan.purpose,
        tenorUnit,
        source: 'backfill',
      },
    };
  });
}

async function insertRows(rows: any[]) {
  if (!rows.length) return 0;
  const chunks = [];
  for (let index = 0; index < rows.length; index += 500) {
    chunks.push(rows.slice(index, index + 500));
  }

  let count = 0;
  for (const chunk of chunks) {
    const result = await (prisma as any).repaymentScheduleItem.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    count += result.count ?? 0;
  }
  return count;
}

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RepaymentScheduleItem" (
      "id" TEXT NOT NULL,
      "memberId" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "sequence" INTEGER NOT NULL,
      "dueDate" TIMESTAMP(3) NOT NULL,
      "expectedAmount" DECIMAL(65,30) NOT NULL,
      "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
      "remainingAmount" DECIMAL(65,30) NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'UPCOMING',
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RepaymentScheduleItem_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "RepaymentScheduleItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RepaymentScheduleItem_targetType_targetId_sequence_key"
      ON "RepaymentScheduleItem"("targetType", "targetId", "sequence");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RepaymentScheduleItem_memberId_dueDate_idx"
      ON "RepaymentScheduleItem"("memberId", "dueDate");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RepaymentScheduleItem_memberId_status_dueDate_idx"
      ON "RepaymentScheduleItem"("memberId", "status", "dueDate");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RepaymentScheduleItem_targetType_targetId_dueDate_idx"
      ON "RepaymentScheduleItem"("targetType", "targetId", "dueDate");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RepaymentScheduleItem_targetType_targetId_status_idx"
      ON "RepaymentScheduleItem"("targetType", "targetId", "status");
  `);

  const subscriptions = await prisma.packageSubscription.findMany({
    where: {
      status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS', 'COMPLETED'] as any },
    },
    include: { package: true },
  } as any);
  const packageRows = subscriptions.flatMap(buildPackageRows);
  const packageCount = await insertRows(packageRows);

  const loans = await prisma.loanApplication.findMany({
    where: {
      status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'] as any },
    },
  } as any);
  const loanRows = loans.flatMap(buildLoanRows).filter((row) => row.expectedAmount > 0);
  const loanCount = await insertRows(loanRows);

  console.log(`RepaymentScheduleItem table is ready. Backfilled ${packageCount} package rows and ${loanCount} loan rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
