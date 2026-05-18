// @ts-nocheck
import * as bcrypt from "bcryptjs";

import { prisma } from "../prisma";

type AppendMember = {
  fullName: string;
  phoneNumber: string;
  email: string;
  homeAddress: string;
  stateOfOrigin: string;
  occupation: string;
  dateOfBirth: string;
  maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
  identificationType?: "VOTERS_CARD" | "NIN" | "NATIONAL_PASSPORT";
  identificationNumber?: string;
  referral?: string;
  savings: number;
  loan?: {
    amount: number;
    paid?: number;
    balance?: number;
    remainingMonths?: number;
    startDate?: string;
    repaymentFrequency?: "MONTHLY" | "WEEKLY";
    tenorMonths?: number;
  };
};

const members: AppendMember[] = [
  {
    fullName: "Jinadu Temitope Samuel",
    phoneNumber: "08063198574",
    email: "jjnadutemitope@gmail.com",
    homeAddress: "No 2 Alabebe Police Station Street, Monatan, Ibadan",
    stateOfOrigin: "Osun",
    occupation: "Farmer",
    dateOfBirth: "1990-05-03",
    maritalStatus: "SINGLE",
    identificationType: "NIN",
    identificationNumber: "79178888637",
    referral: "Sodiq Olanike Jelilat",
    savings: 561_000,
  },
  {
    fullName: "Ige Yemisi Juliet",
    phoneNumber: "08163187989",
    email: "igeyemesi665@gmail.com",
    homeAddress: "No 3 Northgate Sasa, Ojoo, Ibadan",
    stateOfOrigin: "Oyo",
    occupation: "Trading",
    dateOfBirth: "1984-06-09",
    identificationType: "NIN",
    identificationNumber: "10358072939",
    savings: 88_500,
  },
  {
    fullName: "Nafiu Akintola",
    phoneNumber: "08131273789",
    email: "ajibolaakintola32@gmail.com",
    homeAddress: "8, Akorede Community, Akinrinlo, Olorisaoko, Moniya, Ibadan",
    stateOfOrigin: "Oyo",
    occupation: "Trading",
    dateOfBirth: "1990-04-04",
    identificationType: "NIN",
    identificationNumber: "18797837829",
    savings: 295_000,
    loan: { amount: 1_800_000, paid: 948_150, balance: 851_850, startDate: "2026-01-07", repaymentFrequency: "WEEKLY", tenorMonths: 10 },
  },
  {
    fullName: "Akintola Yusira Aweke",
    phoneNumber: "09066815384",
    email: "yusiraakintola@gmail.com",
    homeAddress: "8, Akorede Community, Akinrinlo, Olorisaoko, Moniya, Ibadan",
    stateOfOrigin: "Oyo",
    occupation: "Trading",
    dateOfBirth: "1990-09-20",
    identificationType: "NIN",
    identificationNumber: "72061981947",
    savings: 73_250,
  },
  {
    fullName: "Olatunji Hakeem Ajagbe",
    phoneNumber: "09025146565",
    email: "hakeemajagbe20@gmail.com",
    homeAddress: "Pending address",
    stateOfOrigin: "Osun",
    occupation: "Mechanic",
    dateOfBirth: "1995-05-20",
    identificationType: "NIN",
    identificationNumber: "23648815411",
    referral: "Nafiu Akintola",
    savings: 356_700,
  },
  {
    fullName: "Adeshiyan Taofeek",
    phoneNumber: "07030968313",
    email: "adeshiyantaofeek@gmail.com",
    homeAddress: "No 16, Behind Bovas Filling Station, IITA, Ibadan",
    stateOfOrigin: "Oyo",
    occupation: "Trading",
    dateOfBirth: "1990-01-01",
    maritalStatus: "MARRIED",
    identificationType: "NIN",
    identificationNumber: "PENDING-TAOFEEK",
    savings: 0,
    loan: { amount: 3_600_000, paid: 0, balance: 3_600_000, startDate: "2026-04-12", repaymentFrequency: "MONTHLY", tenorMonths: 10 },
  },
  {
    fullName: "Olaitan Ayotunde Abiodun",
    phoneNumber: "09064408107",
    email: "olaitanayotunde6440@gmail.com",
    homeAddress: "Akinrinlo Community, Olorisaoko, Moniya, Ibadan",
    stateOfOrigin: "Oyo",
    occupation: "Trading",
    dateOfBirth: "1990-01-01",
    maritalStatus: "MARRIED",
    identificationType: "NIN",
    identificationNumber: "PENDING-OLAITAN",
    savings: 0,
  },
];

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function monthsFromNow(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

function legacyDate(value: string) {
  return new Date(`${value}T09:00:00+01:00`);
}

function addLegacyMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function legacyLoanSchedule(loan: NonNullable<AppendMember["loan"]>) {
  if (!loan.startDate) {
    const tenorMonths = Math.max(loan.remainingMonths ?? loan.tenorMonths ?? 12, 1);
    const startDate = new Date();
    return {
      startDate,
      maturityDate: monthsFromNow(tenorMonths),
      tenorMonths,
      tenorUnit: "MONTHS" as const,
      repaymentFrequency: "MONTHLY",
    };
  }

  const startDate = legacyDate(loan.startDate);
  const totalTenorMonths = Math.max(loan.tenorMonths ?? 10, 1);
  const repaymentFrequency = loan.repaymentFrequency ?? "MONTHLY";
  const maturityDate = addLegacyMonths(startDate, totalTenorMonths);

  if (repaymentFrequency === "WEEKLY") {
    const weeks = Math.max(
      Math.ceil((maturityDate.getTime() - startDate.getTime()) / 604_800_000),
      1,
    );
    return {
      startDate,
      maturityDate,
      tenorMonths: totalTenorMonths,
      installmentCount: weeks,
      tenorUnit: "WEEKS" as const,
      repaymentFrequency,
    };
  }

  return {
    startDate,
    maturityDate,
    tenorMonths: totalTenorMonths,
    installmentCount: totalTenorMonths,
    tenorUnit: "MONTHS" as const,
    repaymentFrequency,
  };
}

function nextLoanRepaymentDate(
  loan: NonNullable<AppendMember["loan"]>,
  schedule: ReturnType<typeof legacyLoanSchedule>,
  balance: number,
) {
  if (balance <= 0) return null;

  const totalAmount = Number(loan.amount);
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

async function nextMembershipNumber() {
  const count = await prisma.member.count();
  return `ACH-${String(count + 1).padStart(6, "0")}`;
}

async function findReferrer(referral?: string) {
  if (!referral) return undefined;
  const members = await prisma.member.findMany({
    select: { id: true, fullName: true },
  });
  const key = normalizeKey(referral);
  return members.find((member) => normalizeKey(member.fullName) === key || normalizeKey(member.fullName).includes(key))?.id;
}

async function ensureCooperativeWallet() {
  const wallet = await prisma.cooperativeWallet.findFirst();
  if (wallet) return wallet;
  return prisma.cooperativeWallet.create({ data: {} });
}

async function main() {
  await Promise.all(
    [
      ["MEMBERSHIP_CHARGE_RATE", "0"],
      ["COOPERATIVE_DEDUCTION_AMOUNT", "250"],
      ["MEMBERSHIP_FEE_AMOUNT", "20000"],
    ].map(([key, value]) =>
      prisma.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );

  let createdCount = 0;
  let skippedCount = 0;
  let totalSavings = 0;
  let totalLoanDisbursed = 0;
  let totalLoanRepaid = 0;

  for (const item of members) {
    const existing = await prisma.member.findFirst({
      where: {
        OR: [
          { phoneNumber: item.phoneNumber },
          { user: { email: item.email.toLowerCase() } },
        ],
      },
      include: { user: true },
    });

    if (existing) {
      skippedCount += 1;
      console.log(`Skipped existing member: ${item.fullName}`);
      continue;
    }

    const membershipNumber = await nextMembershipNumber();
    const passwordHash = await bcrypt.hash(item.phoneNumber, 12);
    const referrerId = await findReferrer(item.referral);

    const created = await prisma.user.create({
      data: {
        email: item.email.toLowerCase(),
        passwordHash,
        role: "MEMBER",
        member: {
          create: {
            fullName: item.fullName,
            phoneNumber: item.phoneNumber,
            membershipNumber,
            status: "ACTIVE",
            referrerId,
            address: item.homeAddress,
            homeAddress: item.homeAddress,
            stateOfOrigin: item.stateOfOrigin,
            dateOfBirth: new Date(item.dateOfBirth),
            occupation: item.occupation,
            maritalStatus: item.maritalStatus ?? "MARRIED",
            identificationType: item.identificationType ?? "NIN",
            identificationNumber: item.identificationNumber?.trim() || `PENDING-${membershipNumber}`,
            identificationPicture: "",
            wallet: {
              create: {
                availableBalance: 0,
                pendingBalance: 0,
                totalFunded: 0,
                totalCharges: 0,
                currency: "NGN",
              },
            },
          },
        },
      },
      include: { member: { include: { wallet: true } } },
    });

    const member = created.member!;
    const walletId = member.wallet!.id;

    const savingsAccount = await prisma.savingsAccount.create({
      data: {
        memberId: member.id,
        balance: item.savings,
        contributionFrequency: "MONTHLY",
      },
    });

    await prisma.transaction.create({
      data: {
        walletId,
        type: "SAVINGS",
        amount: item.savings,
        status: "APPROVED",
        reference: `OPENING-SAVINGS-${membershipNumber}`,
        category: "opening savings balance",
        description: `Opening savings balance for ${item.fullName}`,
        editable: false,
        lockReason: "Opening balance imported during append-only member import.",
        metadata: { memberId: member.id, memberName: item.fullName, membershipNumber, savingsAccountId: savingsAccount.id },
      },
    });
    totalSavings += item.savings;

    if (item.loan && item.loan.amount > 0) {
      const paid = item.loan.paid ?? Math.max(item.loan.amount - (item.loan.balance ?? item.loan.amount), 0);
      const balance = item.loan.balance ?? Math.max(item.loan.amount - paid, 0);
      const schedule = legacyLoanSchedule(item.loan);
      const loan = await prisma.loanApplication.create({
        data: {
          memberId: member.id,
          amount: item.loan.amount,
          disbursedAmount: item.loan.amount,
          remainingBalance: balance,
          tenorMonths: schedule.tenorMonths,
          tenorUnit: schedule.tenorUnit,
          purpose: `Legacy loan for ${item.fullName}`,
          status: balance <= 0 ? "COMPLETED" : "IN_PROGRESS",
          submittedAt: schedule.startDate,
          approvedAt: schedule.startDate,
          disbursedAt: schedule.startDate,
          dueDate: schedule.maturityDate,
          nextRepaymentAt: nextLoanRepaymentDate(item.loan, schedule, balance),
        },
      });

      await prisma.loanActivity.create({
        data: {
          loanId: loan.id,
          type: "DISBURSEMENT",
          previousAmount: 0,
          newAmount: item.loan.amount,
          deltaAmount: item.loan.amount,
          note: "Opening loan disbursement imported during append-only member import.",
          createdAt: schedule.startDate,
          metadata: {
            memberName: item.fullName,
            membershipNumber,
            legacyStartDate: item.loan.startDate ?? null,
            repaymentFrequency: schedule.repaymentFrequency,
            maturityDate: schedule.maturityDate.toISOString(),
          },
        },
      });

      await prisma.transaction.create({
        data: {
          walletId,
          type: "LOAN_DISBURSEMENT",
          amount: item.loan.amount,
          status: "APPROVED",
          reference: `OPENING-LOAN-DISBURSEMENT-${membershipNumber}`,
          category: "opening loan disbursement",
          description: `Opening loan disbursement for ${item.fullName}`,
          editable: false,
          lockReason: "Opening balance imported during append-only member import.",
          metadata: { memberId: member.id, memberName: item.fullName, membershipNumber, loanId: loan.id, loanName: loan.purpose },
        },
      });

      if (paid > 0) {
        await prisma.transaction.create({
          data: {
            walletId,
            type: "LOAN_REPAYMENT",
            amount: paid,
            status: "APPROVED",
            reference: `OPENING-LOAN-REPAYMENT-${membershipNumber}`,
            category: "opening loan repayment",
            description: `Opening loan repayment for ${loan.purpose}`,
            editable: false,
            lockReason: "Opening balance imported during append-only member import.",
            metadata: { memberId: member.id, memberName: item.fullName, membershipNumber, loanId: loan.id, loanName: loan.purpose },
            createdAt: schedule.startDate,
            updatedAt: schedule.startDate,
          },
        });
      }

      totalLoanDisbursed += item.loan.amount;
      totalLoanRepaid += paid;
    }

    createdCount += 1;
    console.log(`Created member: ${item.fullName}`);
  }

  const associationDelta = totalSavings + totalLoanRepaid - totalLoanDisbursed;
  const wallet = await ensureCooperativeWallet();
  await prisma.cooperativeWallet.update({
    where: { id: wallet.id },
    data: {
      balance: { increment: associationDelta },
      physicalTreasuryCash: { increment: associationDelta },
      associationAvailableBalance: { increment: associationDelta },
      totalIncome: { increment: totalSavings + totalLoanRepaid },
      totalExpense: { increment: totalLoanDisbursed },
    },
  });

  await prisma.financialLedgerEntry.create({
    data: {
      reference: `APPEND-MEMBERS-${Date.now()}`,
      sourceType: "Seed",
      sourceId: "append-members",
      description: "Append-only member import balance adjustment",
      metadata: {
        createdCount,
        skippedCount,
        totalSavings,
        totalLoanRepaid,
        totalLoanDisbursed,
        associationDelta,
      },
      lines: {
        create: [
          {
            account: associationDelta >= 0 ? "PHYSICAL_TREASURY_CASH" : "ASSOCIATION_AVAILABLE",
            direction: "DEBIT",
            amount: Math.abs(associationDelta),
          },
          {
            account: associationDelta >= 0 ? "ASSOCIATION_AVAILABLE" : "PHYSICAL_TREASURY_CASH",
            direction: "CREDIT",
            amount: Math.abs(associationDelta),
          },
        ],
      },
    },
  });

  console.log("Append-only member import completed.");
  console.log(`Created: ${createdCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Association delta: ${associationDelta.toLocaleString()}`);
}

main()
  .catch((error) => {
    console.error("Append-only member import failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
