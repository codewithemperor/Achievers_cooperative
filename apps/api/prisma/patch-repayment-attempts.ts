import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RepaymentAttempt" (
      "id" TEXT NOT NULL,
      "memberId" TEXT NOT NULL,
      "transactionId" TEXT,
      "phase" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT,
      "expectedAmount" DECIMAL(65,30) NOT NULL,
      "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
      "remainingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL,
      "mode" TEXT NOT NULL DEFAULT 'AUTO',
      "reference" TEXT,
      "dueAt" TIMESTAMP(3),
      "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RepaymentAttempt_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "RepaymentAttempt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "RepaymentAttempt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RepaymentAttempt_transactionId_key" ON "RepaymentAttempt"("transactionId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RepaymentAttempt_reference_key" ON "RepaymentAttempt"("reference");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RepaymentAttempt_memberId_phase_attemptedAt_idx" ON "RepaymentAttempt"("memberId", "phase", "attemptedAt");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RepaymentAttempt_targetType_targetId_idx" ON "RepaymentAttempt"("targetType", "targetId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RepaymentAttempt_status_idx" ON "RepaymentAttempt"("status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RepaymentAttempt_dueAt_idx" ON "RepaymentAttempt"("dueAt");
  `);

  console.log('RepaymentAttempt table is ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
