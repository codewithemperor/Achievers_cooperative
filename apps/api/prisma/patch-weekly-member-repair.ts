// @ts-nocheck
import * as bcrypt from "bcryptjs";

import { prisma } from "../prisma";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = process.argv.includes("--dry-run") || !APPLY;
const JOINED_AT_CUTOFF = new Date("2025-05-16T09:00:00+01:00");

type LoanRepair = {
  names: string[];
  amount: number;
  openingBalance: number;
  startDate: string;
  repaymentFrequency: "WEEKLY" | "MONTHLY";
  tenorMonths: number;
};

const bashirat = {
  fullName: "Bashirat Olanike Diekola",
  phoneNumber: "08054588827",
  email: "bashiramakinde17@mail.com",
  homeAddress: "Number 21 Idiomo Powerline, Arulogun Road, Ojoo, Ibadan",
  stateOfOrigin: "Oyo",
  occupation: "Trader",
  dateOfBirth: "1984-04-21",
  maritalStatus: "MARRIED",
  identificationType: "NIN",
  identificationNumber: "94922419594",
  savings: 240_000,
};

const savingsRepairs = [
  { names: ["Adeshiyan Taofeek", "Adeshiyan Taofeeq"], amount: 1_289_000 },
  { names: ["Akintola Yusira Aweke", "Akintola Yusira"], amount: 83_250 },
  { names: ["Olaitan Ayotunde Abiodun", "Olaitan Ayotunde"], amount: 226_450 },
];

const loanRepairs: LoanRepair[] = [
  {
    names: ["Rafiu Kabir Olanrewaju", "Rafiu Kabir", "KB World"],
    amount: 500_000,
    openingBalance: 410_000,
    startDate: "2026-05-03",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Olasunkanmi Saheed", "OLASUNKANMI"],
    amount: 1_800_000,
    openingBalance: 731_000,
    startDate: "2025-11-30",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Gbadegesin Isiaka Aderoju", "Gbadegesin Isiaq Aderoju"],
    amount: 900_000,
    openingBalance: 215_750,
    startDate: "2025-08-17",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Nafiu Akintola", "Akintola Nafiu"],
    amount: 1_800_000,
    openingBalance: 851_850,
    startDate: "2026-01-07",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Adeshiyan Fatima Dasola", "Adeshiyan Fatima"],
    amount: 1_800_000,
    openingBalance: 400_000,
    startDate: "2025-12-01",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 5,
  },
  {
    names: ["Adeshiyan Taofeek", "Adeshiyan Taofeeq"],
    amount: 3_600_000,
    openingBalance: 3_600_000,
    startDate: "2026-04-05",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 10,
  },
  {
    names: ["Mohammed Dayo", "Muhammed Dayo", "Tajudeen Dayo"],
    amount: 400_000,
    openingBalance: 236_000,
    startDate: "2025-11-16",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 10,
  },
  {
    names: ["Sarafadeen Olaide Moshood", "Sarafa Olaide"],
    amount: 2_500_000,
    openingBalance: 1_735_000,
    startDate: "2026-01-18",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Adeyemi Adedayo Esther", "Adedayo Esther Adeyemi"],
    amount: 1_000_000,
    openingBalance: 738_000,
    startDate: "2026-03-01",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Gbadegesin John Adewale", "John Adewale Gbadegesin"],
    amount: 5_000_000,
    openingBalance: 1_900_000,
    startDate: "2025-12-07",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Olaitan Ayotunde Abiodun", "Olaitan Ayotunde"],
    amount: 630_000,
    openingBalance: 356_250,
    startDate: "2025-10-19",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Olakunle Olusola Aworinde", "Olusola Olakunle Aworinde"],
    amount: 1_500_000,
    openingBalance: 1_050_000,
    startDate: "2026-03-22",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 10,
  },
  {
    names: ["Ojelabi Oludare J", "Ojelabi Oludare Joshua"],
    amount: 170_000,
    openingBalance: 21_000,
    startDate: "2025-11-16",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Olapade Afeez Bayonle", "Afeez Bayonle Olapade"],
    amount: 3_000_000,
    openingBalance: 1_950_000,
    startDate: "2026-02-22",
    repaymentFrequency: "WEEKLY",
    tenorMonths: 10,
  },
  {
    names: ["Fakunle Alaba Samuel"],
    amount: 970_000,
    openingBalance: 855_000,
    startDate: "2026-03-16",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 10,
  },
  {
    names: ["Eweje Kamorudeen Salmon", "Eweje Kamorudeen Salman"],
    amount: 1_000_000,
    openingBalance: 700_000,
    startDate: "2026-02-08",
    repaymentFrequency: "MONTHLY",
    tenorMonths: 10,
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function money(value: unknown) {
  return Number(value ?? 0);
}

function isDifferent(left: number, right: number) {
  return Math.abs(left - right) >= 0.01;
}

function legacyDate(value: string) {
  return new Date(`${value}T09:00:00+01:00`);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function resolveSchedule(repair: LoanRepair) {
  const startDate = legacyDate(repair.startDate);
  const maturityDate = addMonths(startDate, repair.tenorMonths);
  if (repair.repaymentFrequency === "WEEKLY") {
    const installmentCount = Math.max(
      Math.ceil((maturityDate.getTime() - startDate.getTime()) / 604_800_000),
      1,
    );
    return {
      startDate,
      maturityDate,
      installmentCount,
      tenorUnit: "WEEKS",
    };
  }

  return {
    startDate,
    maturityDate,
    installmentCount: Math.max(repair.tenorMonths, 1),
    tenorUnit: "MONTHS",
  };
}

function nextRepaymentDate(repair: LoanRepair, paidSoFar: number, remainingBalance: number) {
  if (remainingBalance <= 0) return null;
  const schedule = resolveSchedule(repair);
  const installmentAmount = repair.amount / schedule.installmentCount;
  const paidInstallments =
    installmentAmount > 0 ? Math.floor(paidSoFar / installmentAmount) : 0;
  const nextStep = Math.min(paidInstallments + 1, schedule.installmentCount);
  const next = new Date(schedule.startDate);
  if (schedule.tenorUnit === "WEEKS") {
    next.setDate(next.getDate() + nextStep * 7);
  } else {
    next.setMonth(next.getMonth() + nextStep);
  }
  return next;
}

function isOpeningTransaction(tx: any) {
  const reference = String(tx.reference ?? "");
  const category = String(tx.category ?? "");
  const description = String(tx.description ?? "");
  return (
    reference.startsWith("OPENING-") ||
    category.toLowerCase().startsWith("opening") ||
    description.toLowerCase().startsWith("opening")
  );
}

async function nextMembershipNumber(client = prisma) {
  const count = await client.member.count();
  return `ACH-${String(count + 1).padStart(6, "0")}`;
}

async function findMemberByNames(names: string[], client = prisma) {
  const members = await client.member.findMany({
    include: { user: true, wallet: true, savingsAccounts: true },
  });
  const keys = names.map(normalize);
  return members.find((member) => {
    const memberKey = normalize(member.fullName);
    return keys.some(
      (key) => memberKey === key || memberKey.includes(key) || key.includes(memberKey),
    );
  });
}

async function ensureCooperativeWallet(client = prisma) {
  const wallet = await client.cooperativeWallet.findFirst();
  if (wallet) return wallet;
  return client.cooperativeWallet.create({ data: {} });
}

async function resolvedTransactionAmount(tx: any) {
  if (isOpeningTransaction(tx)) return money(tx.amount);
  const ledgerEntry = await prisma.financialLedgerEntry.findFirst({
    where: { sourceType: "Transaction", sourceId: tx.id },
    include: { lines: true },
  });
  const ledgerLine = ledgerEntry?.lines?.find((line) =>
    ["ASSOCIATION_AVAILABLE", "MEMBER_WALLET_LIABILITY", "PHYSICAL_TREASURY_CASH"].includes(line.account),
  );
  return money(ledgerLine?.amount ?? tx.amount);
}

async function laterLoanRepayments(member: any, loan: any) {
  if (!member?.wallet?.id) return { amount: 0, references: [] as string[] };
  const transactions = await prisma.transaction.findMany({
    where: {
      walletId: member.wallet.id,
      type: "LOAN_REPAYMENT",
      status: "APPROVED",
    },
    orderBy: { createdAt: "asc" },
  });
  let amount = 0;
  const references: string[] = [];
  for (const tx of transactions) {
    if (isOpeningTransaction(tx)) continue;
    const metadata = tx.metadata && typeof tx.metadata === "object" ? tx.metadata : {};
    const text = normalize(`${tx.reference ?? ""} ${tx.description ?? ""}`);
    const matchesLoan =
      metadata.loanId === loan.id ||
      text.includes(normalize(loan.id)) ||
      text.includes(normalize(loan.purpose ?? ""));
    if (!matchesLoan) continue;
    const txAmount = await resolvedTransactionAmount(tx);
    amount += txAmount;
    references.push(`${tx.reference ?? tx.id}:${txAmount}`);
  }
  return { amount, references };
}

async function ensureOpeningTransaction(
  client: any,
  input: {
    walletId: string;
    type: string;
    reference: string;
    amount: number;
    description: string;
    category: string;
    createdAt: Date;
    metadata: Record<string, unknown>;
  },
) {
  const existing = await client.transaction.findFirst({
    where: {
      walletId: input.walletId,
      type: input.type,
      reference: input.reference,
    },
  });

  if (existing) {
    await client.transaction.update({
      where: { id: existing.id },
      data: {
        amount: input.amount,
        status: "APPROVED",
        category: input.category,
        description: input.description,
        editable: false,
        lockReason: "Opening balance imported during non-destructive member repair.",
        metadata: input.metadata,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      },
    });
    return money(existing.amount);
  }

  await client.transaction.create({
    data: {
      walletId: input.walletId,
      type: input.type,
      amount: input.amount,
      status: "APPROVED",
      reference: input.reference,
      category: input.category,
      description: input.description,
      editable: false,
      lockReason: "Opening balance imported during non-destructive member repair.",
      metadata: input.metadata,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
  });
  return 0;
}

async function buildPatchPlan() {
  const report: string[] = [];
  let incomeDelta = 0;
  let expenseDelta = 0;
  const loanUpdates: any[] = [];

  const lateJoinedCount = await prisma.member.count({
    where: { joinedAt: { gt: JOINED_AT_CUTOFF } },
  });
  if (lateJoinedCount) {
    report.push(`Members with joinedAt later than cutoff: ${lateJoinedCount}`);
  }

  const bashiratExisting = await prisma.member.findFirst({
    where: {
      OR: [
        { phoneNumber: bashirat.phoneNumber },
        { user: { email: bashirat.email.toLowerCase() } },
      ],
    },
    include: { user: true, wallet: true, savingsAccounts: true },
  });
  if (!bashiratExisting) {
    report.push(`Create member: ${bashirat.fullName} with opening savings ${bashirat.savings.toLocaleString()}`);
    incomeDelta += bashirat.savings;
  }

  for (const repair of savingsRepairs) {
    const member = await findMemberByNames(repair.names);
    if (!member) {
      report.push(`Savings repair skipped, member not found: ${repair.names[0]}`);
      continue;
    }
    const current = money(member.savingsAccounts?.[0]?.balance);
    if (isDifferent(current, repair.amount)) {
      const delta = repair.amount - current;
      report.push(
        `Savings repair: ${member.fullName} ${current.toLocaleString()} -> ${repair.amount.toLocaleString()} (${delta >= 0 ? "+" : ""}${delta.toLocaleString()})`,
      );
      incomeDelta += delta;
    }
  }

  const ojelabi = await findMemberByNames(["Ojelabi Oludare J", "Ojelabi Oludare Joshua"]);
  if (ojelabi && ojelabi.phoneNumber !== "08038031847") {
    report.push(`Patch Ojelabi phone/password: ${ojelabi.phoneNumber} -> 08038031847`);
  }

  for (const repair of loanRepairs) {
    const member = await findMemberByNames(repair.names);
    if (!member) {
      report.push(`Loan repair skipped, member not found: ${repair.names[0]}`);
      continue;
    }
    const schedule = resolveSchedule(repair);
    const loan =
      (await prisma.loanApplication.findFirst({
        where: { memberId: member.id },
        orderBy: { submittedAt: "desc" },
      })) ?? null;
    const openingPaid = Math.max(repair.amount - repair.openingBalance, 0);
    const later = loan
      ? await laterLoanRepayments(member, loan)
      : { amount: 0, references: [] as string[] };
    const calculatedRemaining = Math.max(repair.amount - openingPaid - later.amount, 0);
    const calculatedStatus = calculatedRemaining <= 0 ? "COMPLETED" : "IN_PROGRESS";
    const paidSoFar = repair.amount - calculatedRemaining;
    const nextDue = nextRepaymentDate(repair, paidSoFar, calculatedRemaining);
    const oldOpeningDisbursement = member.wallet
      ? await prisma.transaction.findFirst({
          where: {
            walletId: member.wallet.id,
            type: "LOAN_DISBURSEMENT",
            OR: [
              { reference: { startsWith: "OPENING-LOAN-DISBURSEMENT" } },
              loan ? { metadata: { path: ["loanId"], equals: loan.id } as any } : {},
            ],
          },
        })
      : null;
    const oldOpeningRepayment = member.wallet
      ? await prisma.transaction.findFirst({
          where: {
            walletId: member.wallet.id,
            type: "LOAN_REPAYMENT",
            OR: [
              { reference: { startsWith: "OPENING-LOAN-REPAYMENT" } },
              loan ? { metadata: { path: ["loanId"], equals: loan.id } as any } : {},
            ],
          },
        })
      : null;

    const changed =
      !loan ||
      isDifferent(money(loan.amount), repair.amount) ||
      isDifferent(money(loan.disbursedAmount), repair.amount) ||
      isDifferent(money(loan.remainingBalance), calculatedRemaining) ||
      loan.status !== calculatedStatus ||
      loan.submittedAt?.getTime() !== schedule.startDate.getTime() ||
      loan.dueDate?.getTime() !== schedule.maturityDate.getTime();

    const alreadyRepaired = Boolean(!changed && loan);
    const oldDisbursementAmount = oldOpeningDisbursement
      ? money(oldOpeningDisbursement.amount)
      : alreadyRepaired
        ? repair.amount
        : money(loan ? loan.disbursedAmount : 0);
    const oldRepaymentAmount = oldOpeningRepayment
      ? money(oldOpeningRepayment.amount)
      : alreadyRepaired
        ? openingPaid
        : 0;
    if (changed) {
      incomeDelta += openingPaid - oldRepaymentAmount;
      expenseDelta += repair.amount - oldDisbursementAmount;
    }

    if (changed) {
      report.push(
        `Loan repair: ${member.fullName} amount=${repair.amount.toLocaleString()} openingBalance=${repair.openingBalance.toLocaleString()} laterPaid=${later.amount.toLocaleString()} finalBalance=${calculatedRemaining.toLocaleString()} status=${calculatedStatus}`,
      );
      if (later.references.length) {
        report.push(`  Later repayments used: ${later.references.join(", ")}`);
      }
    }

    loanUpdates.push({
      member,
      loan,
      repair,
      schedule,
      openingPaid,
      calculatedRemaining,
      calculatedStatus,
      nextDue,
    });
  }

  return { report, incomeDelta, expenseDelta, loanUpdates };
}

async function applyPatch(plan: Awaited<ReturnType<typeof buildPatchPlan>>) {
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      [
        ["MEMBERSHIP_CHARGE_RATE", "0"],
        ["COOPERATIVE_DEDUCTION_AMOUNT", "250"],
        ["MEMBERSHIP_FEE_AMOUNT", "20000"],
      ].map(([key, value]) =>
        tx.systemConfig.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );

    await tx.member.updateMany({
      where: { joinedAt: { gt: JOINED_AT_CUTOFF } },
      data: { joinedAt: JOINED_AT_CUTOFF },
    });

    const bashiratExisting = await tx.member.findFirst({
      where: {
        OR: [
          { phoneNumber: bashirat.phoneNumber },
          { user: { email: bashirat.email.toLowerCase() } },
        ],
      },
      include: { wallet: true },
    });

    if (!bashiratExisting) {
      const membershipNumber = await nextMembershipNumber(tx);
      const passwordHash = await bcrypt.hash(bashirat.phoneNumber, 12);
      const created = await tx.user.create({
        data: {
          email: bashirat.email.toLowerCase(),
          passwordHash,
          role: "MEMBER",
          member: {
            create: {
              fullName: bashirat.fullName,
              phoneNumber: bashirat.phoneNumber,
              membershipNumber,
              status: "ACTIVE",
              joinedAt: JOINED_AT_CUTOFF,
              address: bashirat.homeAddress,
              homeAddress: bashirat.homeAddress,
              stateOfOrigin: bashirat.stateOfOrigin,
              dateOfBirth: new Date(`${bashirat.dateOfBirth}T09:00:00+01:00`),
              occupation: bashirat.occupation,
              maritalStatus: bashirat.maritalStatus,
              identificationType: bashirat.identificationType,
              identificationNumber: bashirat.identificationNumber,
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
      await tx.savingsAccount.create({
        data: {
          memberId: created.member.id,
          balance: bashirat.savings,
          contributionFrequency: "MONTHLY",
        },
      });
      await tx.transaction.create({
        data: {
          walletId: created.member.wallet.id,
          type: "SAVINGS",
          amount: bashirat.savings,
          status: "APPROVED",
          reference: `OPENING-SAVINGS-${membershipNumber}`,
          category: "opening savings balance",
          description: `Opening savings balance for ${bashirat.fullName}`,
          editable: false,
          lockReason: "Opening balance imported during non-destructive member repair.",
          metadata: {
            memberId: created.member.id,
            memberName: bashirat.fullName,
            membershipNumber,
          },
          createdAt: JOINED_AT_CUTOFF,
          updatedAt: JOINED_AT_CUTOFF,
        },
      });
    }

    for (const repair of savingsRepairs) {
      const member = await findMemberByNames(repair.names, tx);
      if (!member) continue;
      const savingsAccount =
        member.savingsAccounts?.[0] ??
        (await tx.savingsAccount.create({
          data: {
            memberId: member.id,
            balance: 0,
            contributionFrequency: "MONTHLY",
          },
        }));
      await tx.savingsAccount.update({
        where: { id: savingsAccount.id },
        data: { balance: repair.amount },
      });
      if (member.wallet) {
        await ensureOpeningTransaction(tx, {
          walletId: member.wallet.id,
          type: "SAVINGS",
          reference: `OPENING-SAVINGS-${member.membershipNumber}`,
          amount: repair.amount,
          category: "opening savings balance",
          description: `Opening savings balance for ${member.fullName}`,
          createdAt: JOINED_AT_CUTOFF,
          metadata: {
            memberId: member.id,
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            savingsAccountId: savingsAccount.id,
          },
        });
      }
    }

    const ojelabi = await findMemberByNames(["Ojelabi Oludare J", "Ojelabi Oludare Joshua"], tx);
    if (ojelabi) {
      await tx.member.update({
        where: { id: ojelabi.id },
        data: { phoneNumber: "08038031847" },
      });
      await tx.user.update({
        where: { id: ojelabi.userId },
        data: { passwordHash: await bcrypt.hash("08038031847", 12) },
      });
    }

    for (const update of plan.loanUpdates) {
      const { member, repair, schedule, openingPaid, calculatedRemaining, calculatedStatus, nextDue } = update;
      if (!member.wallet) continue;
      const loan =
        update.loan ??
        (await tx.loanApplication.create({
          data: {
            memberId: member.id,
            amount: repair.amount,
            disbursedAmount: repair.amount,
            remainingBalance: calculatedRemaining,
            tenorMonths: repair.tenorMonths,
            tenorUnit: schedule.tenorUnit,
            purpose: `Legacy loan for ${member.fullName}`,
            status: calculatedStatus,
            submittedAt: schedule.startDate,
            approvedAt: schedule.startDate,
            disbursedAt: schedule.startDate,
            dueDate: schedule.maturityDate,
            nextRepaymentAt: nextDue,
          },
        }));

      await tx.loanApplication.update({
        where: { id: loan.id },
        data: {
          amount: repair.amount,
          disbursedAmount: repair.amount,
          remainingBalance: calculatedRemaining,
          tenorMonths: repair.tenorMonths,
          tenorUnit: schedule.tenorUnit,
          purpose: loan.purpose || `Legacy loan for ${member.fullName}`,
          status: calculatedStatus,
          submittedAt: schedule.startDate,
          approvedAt: schedule.startDate,
          disbursedAt: schedule.startDate,
          dueDate: schedule.maturityDate,
          nextRepaymentAt: nextDue,
        },
      });

      await tx.loanActivity.upsert({
        where: { id: `opening-activity-${loan.id}` },
        update: {
          previousAmount: 0,
          newAmount: repair.amount,
          deltaAmount: repair.amount,
          createdAt: schedule.startDate,
          metadata: {
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            legacyStartDate: repair.startDate,
            repaymentFrequency: repair.repaymentFrequency,
            maturityDate: schedule.maturityDate.toISOString(),
          },
        },
        create: {
          id: `opening-activity-${loan.id}`,
          loanId: loan.id,
          type: "DISBURSEMENT",
          previousAmount: 0,
          newAmount: repair.amount,
          deltaAmount: repair.amount,
          note: "Opening loan disbursement imported during non-destructive member repair.",
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

      await ensureOpeningTransaction(tx, {
        walletId: member.wallet.id,
        type: "LOAN_DISBURSEMENT",
        reference: `OPENING-LOAN-DISBURSEMENT-${member.membershipNumber}`,
        amount: repair.amount,
        category: "opening loan disbursement",
        description: `Opening loan disbursement for ${member.fullName}`,
        createdAt: schedule.startDate,
        metadata: {
          memberId: member.id,
          memberName: member.fullName,
          membershipNumber: member.membershipNumber,
          loanId: loan.id,
          loanName: loan.purpose,
          legacyStartDate: repair.startDate,
          repaymentFrequency: repair.repaymentFrequency,
        },
      });

      if (openingPaid > 0) {
        await ensureOpeningTransaction(tx, {
          walletId: member.wallet.id,
          type: "LOAN_REPAYMENT",
          reference: `OPENING-LOAN-REPAYMENT-${member.membershipNumber}`,
          amount: openingPaid,
          category: "opening loan repayment",
          description: `Opening loan repayment for ${loan.purpose}`,
          createdAt: schedule.startDate,
          metadata: {
            memberId: member.id,
            memberName: member.fullName,
            membershipNumber: member.membershipNumber,
            loanId: loan.id,
            loanName: loan.purpose,
            legacyStartDate: repair.startDate,
            repaymentFrequency: repair.repaymentFrequency,
          },
        });
      }
    }

    const netDelta = plan.incomeDelta - plan.expenseDelta;
    if (isDifferent(netDelta, 0) || isDifferent(plan.incomeDelta, 0) || isDifferent(plan.expenseDelta, 0)) {
      const wallet = await ensureCooperativeWallet(tx);
      await tx.cooperativeWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: netDelta },
          physicalTreasuryCash: { increment: netDelta },
          associationAvailableBalance: { increment: netDelta },
          totalIncome: { increment: plan.incomeDelta },
          totalExpense: { increment: plan.expenseDelta },
        },
      });

      if (isDifferent(netDelta, 0)) {
        await tx.financialLedgerEntry.create({
          data: {
            reference: `WEEKLY-MEMBER-REPAIR-${Date.now()}`,
            sourceType: "MemberRepair",
            sourceId: "patch-weekly-member-repair",
            description: "Non-destructive member, savings, loan, and weekly baseline repair",
            metadata: {
              incomeDelta: plan.incomeDelta,
              expenseDelta: plan.expenseDelta,
              netDelta,
              joinedAtCutoff: JOINED_AT_CUTOFF.toISOString(),
            },
            lines: {
              create: [
                {
                  account: "PHYSICAL_TREASURY_CASH",
                  direction: netDelta >= 0 ? "DEBIT" : "CREDIT",
                  amount: Math.abs(netDelta),
                },
                {
                  account: "ASSOCIATION_AVAILABLE",
                  direction: netDelta >= 0 ? "CREDIT" : "DEBIT",
                  amount: Math.abs(netDelta),
                },
              ],
            },
          },
        });
      }
    }
  }, { maxWait: 60_000, timeout: 300_000 });
}

async function main() {
  const plan = await buildPatchPlan();

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY"}`);
  console.log(`JoinedAt cutoff: ${JOINED_AT_CUTOFF.toISOString()}`);
  console.log(`Income delta: ${plan.incomeDelta.toLocaleString()}`);
  console.log(`Expense delta: ${plan.expenseDelta.toLocaleString()}`);
  console.log(`Net cooperative delta: ${(plan.incomeDelta - plan.expenseDelta).toLocaleString()}`);
  console.log("");
  if (plan.report.length) {
    for (const line of plan.report) console.log(`- ${line}`);
  } else {
    console.log("No repair changes detected.");
  }

  if (APPLY) {
    await applyPatch(plan);
    console.log("");
    console.log("Weekly/member repair patch applied.");
  } else {
    console.log("");
    console.log("Dry run only. Run with --apply to write corrections.");
  }
}

main()
  .catch((error) => {
    console.error("Weekly/member repair patch failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
