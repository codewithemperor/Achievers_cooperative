import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'LOAN_BOND';
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "LoanApplication"
      ADD COLUMN IF NOT EXISTS "loanBondRequired" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "loanBondAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "loanBondPaidAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "loanBondTransactionId" TEXT;
  `);

  const completedLoans = await prisma.$executeRawUnsafe(`
    UPDATE "LoanApplication"
    SET
      "status" = 'COMPLETED',
      "remainingBalance" = 0,
      "nextRepaymentAt" = NULL
    WHERE "status" IN ('DISBURSED', 'IN_PROGRESS', 'OVERDUE')
      AND "remainingBalance" <= 0.01;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LoanApplication_loanBondTransactionId_idx"
      ON "LoanApplication"("loanBondTransactionId");
  `);

  await prisma.systemConfig.upsert({
    where: { key: 'LOAN_BOND_AMOUNT' },
    update: {},
    create: { key: 'LOAN_BOND_AMOUNT', value: '2000' },
  });

  console.log(`Loan bond schema and default setting are ready. Normalized completed loans: ${completedLoans}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
