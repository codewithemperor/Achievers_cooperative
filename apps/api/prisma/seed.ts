import * as bcrypt from "bcryptjs";

import { prisma } from "../prisma";

async function main() {
  console.log("🌱 Seeding Achievers Cooperative database...");

  // Hash password
  const adminPasswordHash = await bcrypt.hash("Admin@123", 12);
  const memberPasswordHash = await bcrypt.hash("Member@123", 12);

  // Clean up (for idempotent seeding)
  console.log("🧹 Cleaning existing data...");
  await prisma.auditEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.cooperativeEntry.deleteMany();
  await prisma.cooperativeWallet.deleteMany();
  await prisma.packageSubscription.deleteMany();
  await prisma.package.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.investmentSubscription.deleteMany();
  await prisma.investmentProduct.deleteMany();
  await prisma.loanApplication.deleteMany();
  await prisma.savingsAccount.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.member.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.user.deleteMany();

  // ─── USERS & MEMBERS ─────────────────────────────────────

  console.log("👤 Creating users and members...");

  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@achievers.com",
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN",
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: "operations@achievers.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  const auditorUser = await prisma.user.create({
    data: {
      email: "audit@achievers.com",
      passwordHash: adminPasswordHash,
      role: "AUDITOR",
    },
  });

  // Member 1 - Active
  const member1User = await prisma.user.create({
    data: {
      email: "adaeze@achievers.com",
      passwordHash: memberPasswordHash,
      role: "MEMBER",
      member: {
        create: {
          fullName: "Adaeze Okonkwo",
          phoneNumber: "+2348012345678",
          membershipNumber: "ACH-000001",
          status: "ACTIVE",
          wallet: {
            create: {
              availableBalance: 150000,
            },
          },
        },
      },
    },
    include: { member: { include: { wallet: true } } },
  });

  // Member 2 - Active
  const member2User = await prisma.user.create({
    data: {
      email: "chidi@achievers.com",
      passwordHash: memberPasswordHash,
      role: "MEMBER",
      member: {
        create: {
          fullName: "Chidi Eze",
          phoneNumber: "+2348023456789",
          membershipNumber: "ACH-000002",
          status: "ACTIVE",
          wallet: {
            create: {
              availableBalance: 250000,
            },
          },
        },
      },
    },
    include: { member: { include: { wallet: true } } },
  });

  // Member 3 - Pending
  const member3User = await prisma.user.create({
    data: {
      email: "funke@achievers.com",
      passwordHash: memberPasswordHash,
      role: "MEMBER",
      member: {
        create: {
          fullName: "Funke Adeyemi",
          phoneNumber: "+2348034567890",
          membershipNumber: "ACH-000003",
          status: "PENDING",
          wallet: {
            create: {
              availableBalance: 0,
            },
          },
        },
      },
    },
    include: { member: { include: { wallet: true } } },
  });

  // ─── INVESTMENT PRODUCTS ──────────────────────────────────

  console.log("📊 Creating investment products...");

  const product1 = await prisma.investmentProduct.create({
    data: {
      name: "Achievers Fixed Deposit",
      annualRate: 12,
      minimumAmount: 50000,
      durationMonths: 6,
      status: "ACTIVE",
    },
  });

  const product2 = await prisma.investmentProduct.create({
    data: {
      name: "Achievers Growth Fund",
      annualRate: 18,
      minimumAmount: 100000,
      durationMonths: 12,
      status: "ACTIVE",
    },
  });

  // ─── SAMPLE TRANSACTIONS ──────────────────────────────────

  console.log("💰 Creating sample transactions...");

  if (member1User.member?.wallet) {
    await prisma.transaction.create({
      data: {
        walletId: member1User.member.wallet.id,
        type: "FUNDING",
        amount: 150000,
        status: "APPROVED",
        reference: "FUND-SEED-001",
      },
    });

    await prisma.transaction.create({
      data: {
        walletId: member1User.member.wallet.id,
        type: "SAVINGS",
        amount: 20000,
        status: "APPROVED",
        reference: "SAVE-SEED-001",
      },
    });
  }

  if (member2User.member?.wallet) {
    await prisma.transaction.create({
      data: {
        walletId: member2User.member.wallet.id,
        type: "FUNDING",
        amount: 250000,
        status: "APPROVED",
        reference: "FUND-SEED-002",
      },
    });

    await prisma.transaction.create({
      data: {
        walletId: member2User.member.wallet.id,
        type: "INVESTMENT",
        amount: 100000,
        status: "APPROVED",
        reference: "INV-SEED-001",
      },
    });
  }

  // ─── SAVINGS ACCOUNTS ─────────────────────────────────────

  console.log("🏦 Creating savings accounts...");

  if (member1User.member) {
    await prisma.savingsAccount.create({
      data: {
        memberId: member1User.member.id,
        balance: 50000,
        contributionFrequency: "MONTHLY",
      },
    });
  }

  if (member2User.member) {
    await prisma.savingsAccount.create({
      data: {
        memberId: member2User.member.id,
        balance: 100000,
        contributionFrequency: "MONTHLY",
      },
    });
  }

  // ─── LOAN APPLICATIONS ────────────────────────────────────

  console.log("📝 Creating sample loan applications...");

  if (member1User.member) {
    await prisma.loanApplication.create({
      data: {
        memberId: member1User.member.id,
        amount: 100000,
        tenorMonths: 6,
        purpose: "Business expansion",
        status: "APPROVED",
      },
    });

    await prisma.loanApplication.create({
      data: {
        memberId: member1User.member.id,
        amount: 50000,
        tenorMonths: 3,
        purpose: "School fees",
        status: "PENDING",
      },
    });
  }

  if (member2User.member) {
    await prisma.loanApplication.create({
      data: {
        memberId: member2User.member.id,
        amount: 200000,
        tenorMonths: 12,
        purpose: "Equipment purchase",
        status: "PENDING",
      },
    });
  }

  // ─── INVESTMENT SUBSCRIPTIONS ─────────────────────────────

  console.log("📈 Creating investment subscriptions...");

  const maturityDate1 = new Date();
  maturityDate1.setMonth(maturityDate1.getMonth() + 6);

  const maturityDate2 = new Date();
  maturityDate2.setMonth(maturityDate2.getMonth() + 12);

  if (member1User.member) {
    await prisma.investmentSubscription.create({
      data: {
        memberId: member1User.member.id,
        productId: product1.id,
        principal: 50000,
        maturityDate: maturityDate1,
        status: "APPROVED",
      },
    });
  }

  if (member2User.member) {
    await prisma.investmentSubscription.create({
      data: {
        memberId: member2User.member.id,
        productId: product2.id,
        principal: 100000,
        maturityDate: maturityDate2,
        status: "APPROVED",
      },
    });
  }

  // ─── SYSTEM CONFIG ────────────────────────────────────────

  console.log("⚙️  Creating system config...");

  await prisma.systemConfig.createMany({
    data: [
      { key: "MEMBERSHIP_CHARGE_RATE", value: "0.02" },
      { key: "LOAN_INTEREST_RATE", value: "0.05" },
      { key: "MINIMUM_SAVINGS_CONTRIBUTION", value: "1000" },
      { key: "MAX_LOAN_MULTIPLIER", value: "3" },
      { key: "LOAN_DEFAULT_DURATION_DAYS", value: "30" },
      { key: "BANK_ACCOUNT_NAME", value: "Achievers Cooperative Society" },
      { key: "BANK_ACCOUNT_NUMBER", value: "0123456789" },
      { key: "BANK_NAME", value: "Community Trust Bank" },
    ],
    skipDuplicates: true,
  });

  const cooperativeWallet = await prisma.cooperativeWallet.create({
    data: {
      balance: 750000,
      totalIncome: 95000,
      totalExpense: 120000,
    },
  });

  await prisma.cooperativeEntry.createMany({
    data: [
      {
        walletId: cooperativeWallet.id,
        type: "INCOME",
        amount: 45000,
        category: "MEMBERSHIP_CHARGE",
        description: "Membership charges collected from funded wallets",
        createdById: adminUser.id,
      },
      {
        walletId: cooperativeWallet.id,
        type: "INCOME",
        amount: 50000,
        category: "OTHER_INCOME",
        description: "Administrative service fee recovery",
        createdById: adminUser.id,
      },
      {
        walletId: cooperativeWallet.id,
        type: "EXPENSE",
        amount: 120000,
        category: "OPERATIONS",
        description: "Office operations and logistics",
        createdById: superAdmin.id,
      },
    ],
  });

  if (member1User.member && member2User.member) {
    await prisma.payment.createMany({
      data: [
        {
          memberId: member1User.member.id,
          amount: 50000,
          receiptUrl: "https://example.com/receipts/fund-001.jpg",
          status: "PENDING",
        },
        {
          memberId: member2User.member.id,
          amount: 80000,
          receiptUrl: "https://example.com/receipts/fund-002.jpg",
          status: "APPROVED",
          verifiedById: adminUser.id,
          verifiedAt: new Date(),
          netCreditAmount: 78400,
        },
      ],
    });
  }

  const packageOne = await prisma.package.create({
    data: {
      name: "School Support Package",
      totalAmount: 120000,
      durationMonths: 12,
      penaltyType: "PERCENTAGE",
      penaltyValue: 2.5,
      penaltyFrequency: "MONTHLY",
      isActive: true,
    },
  });

  const packageTwo = await prisma.package.create({
    data: {
      name: "Equipment Upgrade Package",
      totalAmount: 300000,
      durationMonths: 10,
      penaltyType: "FIXED",
      penaltyValue: 5000,
      penaltyFrequency: "MONTHLY",
      isActive: true,
    },
  });

  if (member1User.member && member2User.member) {
    await prisma.packageSubscription.createMany({
      data: [
        {
          packageId: packageOne.id,
          memberId: member1User.member.id,
          amountPaid: 40000,
          amountRemaining: 80000,
          penaltyAccrued: 0,
          status: "ACTIVE",
          nextDueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        {
          packageId: packageTwo.id,
          memberId: member2User.member.id,
          amountPaid: 50000,
          amountRemaining: 250000,
          penaltyAccrued: 5000,
          status: "LATE",
          nextDueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

  // ─── AUDIT EVENTS ─────────────────────────────────────────

  console.log("📋 Creating audit events...");

  await prisma.auditEvent.createMany({
    data: [
      {
        actorId: superAdmin.id,
        action: "SEED_DATABASE",
        entityType: "System",
        entityId: "system",
      },
      {
        actorId: superAdmin.id,
        action: "ACTIVATE_MEMBER",
        entityType: "Member",
        entityId: member1User.member?.id ?? "",
      },
      {
        actorId: adminUser.id,
        action: "APPROVE_LOAN",
        entityType: "LoanApplication",
        entityId: "seed-loan-1",
      },
    ],
  });

  console.log("");
  console.log("✅ Seed completed successfully!");
  console.log("");
  console.log("📋 Test Accounts:");
  console.log("   SUPER_ADMIN: admin@achievers.com / Admin@123");
  console.log("   ADMIN:       operations@achievers.com / Admin@123");
  console.log("   AUDITOR:     audit@achievers.com / Admin@123");
  console.log("   MEMBER:      adaeze@achievers.com / Member@123");
  console.log("   MEMBER:      chidi@achievers.com / Member@123");
  console.log("   MEMBER:      funke@achievers.com / Member@123");
  console.log("");
  console.log("💰 Member Wallets:");
  console.log(`   Adaeze: ₦150,000`);
  console.log(`   Chidi:  ₦250,000`);
  console.log(`   Funke:  ₦0 (pending)`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
