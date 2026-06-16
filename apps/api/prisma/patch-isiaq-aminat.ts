// @ts-nocheck
import * as bcrypt from "bcryptjs";
import { prisma } from "../prisma";

const memberData = {
  fullName: "Isiaq Aminat",
  phoneNumber: "08146739116",
  email: "isiaka123aminat@gmail.com",
  homeAddress: "No 15 road 1 Ifeloju Akinrilo Olorisaoko, Ibadan",
  stateOfOrigin: "Oyo",
  occupation: "Mechanical Engineer",
  dateOfBirth: "1991-08-06",
  maritalStatus: "MARRIED" as const,
  identificationType: "NIN" as const,
  identificationNumber: "47657472303",
  referralNames: [
    "Aderoju Isiaka Gbadegesin",
    "Gbadegesin Isiaka Aderoju",
    "Gbadegesin Isiaq Aderoju",
  ],
  savings: 67_300,
};

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function nextMembershipNumber(tx: typeof prisma) {
  const members = await tx.member.findMany({
    select: { membershipNumber: true },
  });
  const nextNumber =
    members.reduce((max, member) => {
      const match = member.membershipNumber.match(/^ACH-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

  return `ACH-${String(nextNumber).padStart(6, "0")}`;
}

async function findReferrerId(tx: typeof prisma) {
  const members = await tx.member.findMany({
    select: { id: true, fullName: true },
  });
  const referralKeys = memberData.referralNames.map(normalizeKey);

  return members.find((member) => {
    const memberKey = normalizeKey(member.fullName);
    return referralKeys.some((referralKey) => {
      const referralTokens = referralKey.match(/[a-z0-9]+/g) ?? [];
      return (
        memberKey === referralKey ||
        memberKey.includes(referralKey) ||
        referralKey.includes(memberKey) ||
        referralTokens.every((token) => memberKey.includes(token))
      );
    });
  })?.id;
}

async function ensureCooperativeWallet(tx: typeof prisma) {
  const existing = await tx.cooperativeWallet.findFirst();
  if (existing) return existing;
  return tx.cooperativeWallet.create({ data: {} });
}

async function main() {
  const passwordHash = await bcrypt.hash(memberData.phoneNumber, 12);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.member.findFirst({
      where: {
        OR: [
          { phoneNumber: memberData.phoneNumber },
          { user: { email: memberData.email.toLowerCase() } },
        ],
      },
      include: {
        user: { select: { email: true } },
        savingsAccounts: true,
      },
    });

    if (existing) {
      return {
        action: "skipped",
        reason: "Member already exists",
        member: {
          id: existing.id,
          fullName: existing.fullName,
          membershipNumber: existing.membershipNumber,
          email: existing.user.email,
          savings: existing.savingsAccounts.reduce((sum, account) => sum + Number(account.balance), 0),
        },
      };
    }

    const membershipNumber = await nextMembershipNumber(tx as typeof prisma);
    const referrerId = await findReferrerId(tx as typeof prisma);
    const joinedAt = new Date();

    const created = await tx.user.create({
      data: {
        email: memberData.email.toLowerCase(),
        passwordHash,
        role: "MEMBER",
        member: {
          create: {
            fullName: memberData.fullName,
            phoneNumber: memberData.phoneNumber,
            membershipNumber,
            status: "ACTIVE",
            joinedAt,
            referrerId,
            address: memberData.homeAddress,
            homeAddress: memberData.homeAddress,
            stateOfOrigin: memberData.stateOfOrigin,
            dateOfBirth: new Date(`${memberData.dateOfBirth}T09:00:00+01:00`),
            occupation: memberData.occupation,
            maritalStatus: memberData.maritalStatus,
            identificationType: memberData.identificationType,
            identificationNumber: memberData.identificationNumber,
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
      include: {
        member: {
          include: {
            wallet: true,
            referrer: { select: { fullName: true, membershipNumber: true } },
          },
        },
      },
    });

    const member = created.member!;
    const wallet = member.wallet!;
    const savingsAccount = await tx.savingsAccount.create({
      data: {
        memberId: member.id,
        balance: memberData.savings,
        contributionFrequency: "MONTHLY",
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "SAVINGS",
        amount: memberData.savings,
        status: "APPROVED",
        reference: `OPENING-SAVINGS-${membershipNumber}`,
        category: "opening savings balance",
        description: `Opening savings balance for ${memberData.fullName}`,
        editable: false,
        lockReason: "Opening balance imported during one-member seed patch.",
        metadata: {
          memberId: member.id,
          memberName: memberData.fullName,
          membershipNumber,
          savingsAccountId: savingsAccount.id,
          referrerId,
        },
        createdAt: joinedAt,
        updatedAt: joinedAt,
      },
    });

    const cooperativeWallet = await ensureCooperativeWallet(tx as typeof prisma);
    await tx.cooperativeWallet.update({
      where: { id: cooperativeWallet.id },
      data: {
        balance: { increment: memberData.savings },
        physicalTreasuryCash: { increment: memberData.savings },
        associationAvailableBalance: { increment: memberData.savings },
        totalIncome: { increment: memberData.savings },
      },
    });

    await tx.financialLedgerEntry.create({
      data: {
        reference: `OPENING-SAVINGS-LEDGER-${membershipNumber}`,
        sourceType: "Transaction",
        sourceId: transaction.id,
        description: `Opening savings balance for ${memberData.fullName}`,
        metadata: {
          memberId: member.id,
          memberName: memberData.fullName,
          membershipNumber,
          savingsAccountId: savingsAccount.id,
        },
        lines: {
          create: [
            {
              account: "PHYSICAL_TREASURY_CASH",
              direction: "DEBIT",
              amount: memberData.savings,
              memberId: member.id,
            },
            {
              account: "ASSOCIATION_AVAILABLE",
              direction: "CREDIT",
              amount: memberData.savings,
              memberId: member.id,
            },
          ],
        },
      },
    });

    return {
      action: "created",
      member: {
        id: member.id,
        fullName: member.fullName,
        membershipNumber,
        email: created.email,
        phoneNumber: member.phoneNumber,
        referrer: member.referrer
          ? `${member.referrer.fullName} (${member.referrer.membershipNumber})`
          : null,
        savings: memberData.savings,
        defaultPassword: memberData.phoneNumber,
      },
    };
  }, { maxWait: 10000, timeout: 30000 });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Isiaq Aminat seed patch failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
