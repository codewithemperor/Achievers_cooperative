import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WalletDebtExposure" (
      "id" TEXT NOT NULL,
      "memberId" TEXT NOT NULL,
      "walletId" TEXT NOT NULL,
      "phase" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "sourceId" TEXT NOT NULL,
      "sourceKey" TEXT NOT NULL,
      "dueAt" TIMESTAMP(3),
      "amountExposed" DECIMAL(65,30) NOT NULL DEFAULT 0,
      "amountCleared" DECIMAL(65,30) NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "trigger" TEXT,
      "metadata" JSONB,
      "exposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "clearedAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WalletDebtExposure_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "WalletDebtExposure_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "WalletDebtExposure_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "WalletDebtExposure_sourceKey_key"
      ON "WalletDebtExposure"("sourceKey");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "WalletDebtExposure_memberId_status_dueAt_idx"
      ON "WalletDebtExposure"("memberId", "status", "dueAt");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "WalletDebtExposure_walletId_status_idx"
      ON "WalletDebtExposure"("walletId", "status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "WalletDebtExposure_phase_status_idx"
      ON "WalletDebtExposure"("phase", "status");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "WalletDebtExposure_sourceType_sourceId_idx"
      ON "WalletDebtExposure"("sourceType", "sourceId");
  `);

  console.log('WalletDebtExposure table is ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
