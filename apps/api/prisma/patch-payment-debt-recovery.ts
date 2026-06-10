import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Payment"
      ADD COLUMN IF NOT EXISTS "debtSettlementAmount" DECIMAL(65,30),
      ADD COLUMN IF NOT EXISTS "walletCreditAmount" DECIMAL(65,30),
      ADD COLUMN IF NOT EXISTS "approvalReference" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Payment_approvalReference_key" ON "Payment"("approvalReference");
  `);

  console.log('Payment debt recovery columns are ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
