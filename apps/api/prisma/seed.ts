// @ts-nocheck
import * as bcrypt from "bcryptjs";

import { prisma } from "../prisma";

function monthsFromNow(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

async function createMemberUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  phoneNumber: string;
  membershipNumber: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "WITHDRAWN";
  referrerId?: string;
  homeAddress: string;
  stateOfOrigin: string;
  dateOfBirth: string;
  occupation: string;
  maritalStatus: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
  identificationNumber: string;
  identificationPicture: string;
  identificationType: "VOTERS_CARD" | "NIN" | "NATIONAL_PASSPORT";
  avatarUrl?: string;
  availableBalance?: number;
  pendingBalance?: number;
  totalFunded?: number;
  totalCharges?: number;
}) {
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      role: "MEMBER",
      member: {
        create: {
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          membershipNumber: input.membershipNumber,
          status: input.status,
          referrerId: input.referrerId,
          address: input.homeAddress,
          homeAddress: input.homeAddress,
          stateOfOrigin: input.stateOfOrigin,
          dateOfBirth: new Date(input.dateOfBirth),
          occupation: input.occupation,
          maritalStatus: input.maritalStatus,
          identificationNumber: input.identificationNumber,
          identificationPicture: input.identificationPicture,
          identificationType: input.identificationType,
          avatarUrl: input.avatarUrl,
          wallet: {
            create: {
              availableBalance: input.availableBalance ?? 0,
              pendingBalance: input.pendingBalance ?? 0,
              totalFunded: input.totalFunded ?? input.availableBalance ?? 0,
              totalCharges: input.totalCharges ?? 0,
              currency: "NGN",
            },
          },
        },
      },
    },
    include: { member: { include: { wallet: true } } },
  });
}

async function main() {
  console.log("Seeding Achievers Cooperative database...");

  const adminPasswordHash = await bcrypt.hash("Admin@123", 12);
  const memberPasswordHash = await bcrypt.hash("Member@123", 12);

  console.log("Cleaning existing data...");
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

  console.log("Creating users and members...");

  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@achievers.com",
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN",
    },
  });

  const member1User = await createMemberUser({
    email: "adaeze@achievers.com",
    passwordHash: memberPasswordHash,
    fullName: "Adaeze Okonkwo",
    phoneNumber: "08012345678",
    membershipNumber: "ACH-000001",
    status: "ACTIVE",
    homeAddress: "12 Palm Avenue, Enugu",
    stateOfOrigin: "Enugu",
    dateOfBirth: "1990-04-12",
    occupation: "Trader",
    maritalStatus: "MARRIED",
    identificationNumber: "70123456789",
    identificationPicture: "https://example.com/ids/adaeze-nin.jpg",
    identificationType: "NIN",
    avatarUrl: "https://example.com/avatars/adaeze.jpg",
    availableBalance: 150000,
    pendingBalance: 5000,
    totalFunded: 180000,
    totalCharges: 25000,
  });

  const member2User = await createMemberUser({
    email: "chidi@achievers.com",
    passwordHash: memberPasswordHash,
    fullName: "Chidi Eze",
    phoneNumber: "08023456789",
    membershipNumber: "ACH-000002",
    status: "ACTIVE",
    referrerId: member1User.member?.id,
    homeAddress: "44 Market Road, Awka",
    stateOfOrigin: "Anambra",
    dateOfBirth: "1988-09-25",
    occupation: "Engineer",
    maritalStatus: "SINGLE",
    identificationNumber: "A12345678",
    identificationPicture: "https://example.com/ids/chidi-passport.jpg",
    identificationType: "NATIONAL_PASSPORT",
    avatarUrl: "https://example.com/avatars/chidi.jpg",
    availableBalance: 250000,
    pendingBalance: 0,
    totalFunded: 320000,
    totalCharges: 40000,
  });

  const member3User = await createMemberUser({
    email: "funke@achievers.com",
    passwordHash: memberPasswordHash,
    fullName: "Funke Adeyemi",
    phoneNumber: "08034567890",
    membershipNumber: "ACH-000003",
    status: "INACTIVE",
    referrerId: member1User.member?.id,
    homeAddress: "6 Liberty Street, Ibadan",
    stateOfOrigin: "Oyo",
    dateOfBirth: "1994-01-16",
    occupation: "Teacher",
    maritalStatus: "MARRIED",
    identificationNumber: "VIN-33445566",
    identificationPicture: "https://example.com/ids/funke-voters-card.jpg",
    identificationType: "VOTERS_CARD",
    avatarUrl: "https://example.com/avatars/funke.jpg",
    availableBalance: 0,
    pendingBalance: 0,
    totalFunded: 0,
    totalCharges: 0,
  });

  console.log("Creating investment products...");

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

  console.log("Creating sample transactions...");

  if (member1User.member?.wallet) {
    await prisma.transaction.createMany({
      data: [
        {
          walletId: member1User.member.wallet.id,
          type: "WALLET_FUNDING",
          amount: 150000,
          status: "APPROVED",
          reference: "FUND-SEED-001",
          category: "wallet",
          description: "Initial wallet funding",
          editable: false,
          lockReason: "Seeded approved funding entry",
        },
        {
          walletId: member1User.member.wallet.id,
          type: "MEMBERSHIP_FEE",
          amount: 5000,
          status: "APPROVED",
          reference: "MF-SEED-001",
          category: "fee",
          description: "Membership fee charge",
          editable: false,
          lockReason: "System fee charge",
        },
        {
          walletId: member1User.member.wallet.id,
          type: "SAVINGS",
          amount: 20000,
          status: "APPROVED",
          reference: "SAVE-SEED-001",
          category: "savings",
          description: "Savings contribution",
          editable: false,
        },
      ],
    });
  }

  if (member2User.member?.wallet) {
    await prisma.transaction.createMany({
      data: [
        {
          walletId: member2User.member.wallet.id,
          type: "WALLET_FUNDING",
          amount: 250000,
          status: "APPROVED",
          reference: "FUND-SEED-002",
          category: "wallet",
          description: "Initial wallet funding",
          editable: false,
          lockReason: "Seeded approved funding entry",
        },
        {
          walletId: member2User.member.wallet.id,
          type: "INVESTMENT_DEPOSIT",
          amount: 100000,
          status: "APPROVED",
          reference: "INV-SEED-001",
          category: "investment",
          description: "Investment principal contribution",
          editable: false,
        },
        {
          walletId: member2User.member.wallet.id,
          type: "WEEKLY_COOPERATIVE",
          amount: 10000,
          status: "APPROVED",
          reference: "COOP-SEED-001",
          category: "cooperative",
          description: "Weekly cooperative deduction",
          editable: false,
          lockReason: "Automated deduction",
        },
      ],
    });
  }

  console.log("Creating savings accounts...");

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

  console.log("Creating sample loan applications...");

  if (member1User.member && member2User.member) {
    await prisma.loanApplication.create({
      data: {
        memberId: member1User.member.id,
        guarantorOneId: member2User.member.id,
        amount: 100000,
        tenorMonths: 6,
        purpose: "Business expansion",
        status: "APPROVED",
        approvedAt: new Date(),
        remainingBalance: 40000,
      },
    });
  }

  if (member2User.member && member1User.member && member3User.member) {
    await prisma.loanApplication.create({
      data: {
        memberId: member2User.member.id,
        guarantorOneId: member1User.member.id,
        guarantorTwoId: member3User.member.id,
        amount: 200000,
        tenorMonths: 12,
        purpose: "Equipment purchase",
        status: "PENDING",
        remainingBalance: 200000,
      },
    });
  }

  console.log("Creating investment subscriptions...");

  if (member1User.member) {
    await prisma.investmentSubscription.create({
      data: {
        memberId: member1User.member.id,
        productId: product1.id,
        principal: 50000,
        maturityDate: monthsFromNow(6),
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
        maturityDate: monthsFromNow(12),
        status: "APPROVED",
      },
    });
  }

  console.log("Creating system config...");

  const systemConfigs = [
    { key: "MEMBERSHIP_FEE_AMOUNT", value: "5000" },
    { key: "COOPERATIVE_DEDUCTION_DAY", value: "MONDAY" },
    { key: "COOPERATIVE_DEDUCTION_AMOUNT", value: "10000" },
    { key: "MEMBER_TERMS_HTML", value: "<p>Members agree to weekly deductions, cooperative rules, and accurate profile documentation.</p>" },
    { key: "BANK_ACCOUNT_NAME", value: "Achievers Cooperative Society" },
    { key: "BANK_ACCOUNT_NUMBER", value: "0123456789" },
    { key: "BANK_NAME", value: "Community Trust Bank" },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.create({ data: config });
  }

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
        category: "MEMBERSHIP_FEE",
        description: "Membership fees collected from members",
        createdById: superAdmin.id,
      },
      {
        walletId: cooperativeWallet.id,
        type: "INCOME",
        amount: 50000,
        category: "SERVICE_FEE",
        description: "Administrative service fee recovery",
        createdById: superAdmin.id,
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
          verifiedById: superAdmin.id,
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

  console.log("Creating audit events...");

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
        actorId: superAdmin.id,
        action: "APPROVE_LOAN",
        entityType: "LoanApplication",
        entityId: "seed-loan-1",
      },
    ],
  });

  console.log("");
  console.log("Seed completed successfully!");
  console.log("");
  console.log("Test Accounts:");
  console.log("  SUPER_ADMIN: admin@achievers.com / Admin@123");
  console.log("  MEMBER:      adaeze@achievers.com / Member@123");
  console.log("  MEMBER:      chidi@achievers.com / Member@123");
  console.log("  MEMBER:      funke@achievers.com / Member@123");
  console.log("");
  console.log("Member Wallets:");
  console.log("  Adaeze: NGN 150,000");
  console.log("  Chidi:  NGN 250,000");
  console.log("  Funke:  NGN 0 (inactive)");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
