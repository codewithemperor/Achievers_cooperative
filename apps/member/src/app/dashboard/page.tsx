"use client";

import Link from "next/link";
import {
  ArrowRightLeft,
  BellRing,
  BriefcaseBusiness,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { useMemberData } from "@/hooks/use-member-data";
import { useProfileData } from "@/hooks/use-profile-data";
import { formatMoney, initialsFromName } from "@/lib/member-format";
import { Avatar, ScrollShadow } from "@heroui/react";

interface DashboardPayload {
  profile: {
    fullName: string;
    membershipNumber: string;
    status: string;
    joinedAt: string;
  };
  wallet: {
    availableBalance: number;
    pendingBalance: number;
    currency: string;
  };
  summary: {
    totalSavings: number;
    totalInvestments: number;
    transactionCount: number;
    pendingPaymentsTotal: number;
    pendingPaymentsCount: number;
    activeLoan: { remainingBalance: number } | null;
    activePackage: {
      subscribedAmount: number;
      amountRemaining: number;
      packageName: string;
      status: string;
    } | null;
  };
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    description?: string | null;
    reference?: string | null;
  }>;
}

const fallbackData: DashboardPayload = {
  profile: {
    fullName: "Member",
    membershipNumber: "ACH-000000",
    status: "ACTIVE",
    joinedAt: new Date().toISOString(),
  },
  wallet: {
    availableBalance: 0,
    pendingBalance: 0,
    currency: "NGN",
  },
  summary: {
    totalSavings: 0,
    totalInvestments: 0,
    transactionCount: 0,
    pendingPaymentsTotal: 0,
    pendingPaymentsCount: 0,
    activeLoan: null,
    activePackage: null,
  },
  recentTransactions: [],
};

const fallbackProfile = {
  id: "demo",
  email: "member@example.com",
  member: {
    id: "member-demo",
    fullName: "John Smith",
    phoneNumber: "08000000000",
    membershipNumber: "ACH-000000",
    status: "ACTIVE",
    joinedAt: new Date().toISOString(),
    avatarUrl: null,
  },
};

const quickActions = [
  { label: "Wallet", href: "/wallet", icon: ArrowRightLeft },
  { label: "Savings", href: "/savings", icon: PiggyBank },
  { label: "Loans", href: "/loans", icon: Wallet },
  { label: "Packages", href: "/packages", icon: Landmark },
  { label: "Invest", href: "/investments", icon: TrendingUp },
  { label: "Alerts", href: "/notifications", icon: BellRing },
];

const cardMeta = [
  {
    title: "Wallet balance",
    valueKey: "wallet" as const,
    eyebrow: "Primary account",
    caption: "Available for wallet spending and internal transfers.",
    href: "/wallet",
    ctaLabel: "Fund wallet",
    icon: <Wallet className="h-5 w-5" />,
    gradient: "from-[#2a2420] via-[#1f1a17] to-[#151210]",
  },
  {
    title: "Savings balance",
    valueKey: "savings" as const,
    eyebrow: "Steady growth",
    caption: "Review your contribution rhythm and latest savings movement.",
    href: "/savings",
    ctaLabel: "Open savings",
    icon: <PiggyBank className="h-5 w-5" />,

    gradient: "from-[#2a0a0a] via-[#200808] to-[#160505]",
  },
  {
    title: "Investments",
    valueKey: "investments" as const,
    eyebrow: "Opportunity",
    caption: "Track active products and expected maturity returns.",
    href: "/investments",
    ctaLabel: "View products",
    icon: <TrendingUp className="h-5 w-5" />,
    // Deep indigo / dark lavender
    gradient: "from-[#16112e] via-[#110d26] to-[#0c081e]",
  },
  {
    title: "Package plan",
    valueKey: "packages" as const,
    eyebrow: "Subscriptions",
    caption:
      "Track your active package progress and outstanding contributions.",
    href: "/packages",
    ctaLabel: "Open packages",
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    gradient: "from-[#7c3a00] via-[#5e2b00] to-[#341700]",
  },
  {
    title: "Loan balance",
    valueKey: "loans" as const,
    eyebrow: "Repayment",
    caption: "Stay ahead of due dates and repayment milestones.",
    href: "/loans",
    ctaLabel: "Manage loan",
    icon: <Landmark className="h-5 w-5" />,
    gradient: "from-[#5b0b12] via-[#43080d] to-[#260406]",
  },
];

export default function DashboardPage() {
  const { data, loading } = useMemberData<DashboardPayload>(
    "/members/me/dashboard",
    fallbackData,
  );
  const profile = useProfileData(fallbackProfile);
  const member = profile.data.member;
  const displayName = member?.fullName || data.profile.fullName || "Member";

  const cardValues = {
    wallet: formatMoney(data.wallet.availableBalance),
    savings: formatMoney(data.summary.totalSavings),
    investments: formatMoney(data.summary.totalInvestments),
    packages: formatMoney(data.summary.activePackage?.subscribedAmount ?? 0),
    loans: formatMoney(data.summary.activeLoan?.remainingBalance ?? 0),
  };

  return (
    <div className="space-y-6 -mt-6 -mx-5 overflow-hidden bg-[linear-gradient(180deg,var(--color-primary-600)_0%,var(--color-primary-700)_17rem,var(--color-background-50)_17rem,var(--color-background-50)_100%)] dark:bg-[linear-gradient(180deg,var(--color-primary-200)_0%,var(--color-primary-300)_17rem,var(--color-background-50)_17rem,var(--color-background-50)_100%)]">
      {/* Header */}
      <section className="text-white px-5 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar>
              <Avatar.Image alt={displayName} src={member?.avatarUrl || ""} />
              <Avatar.Fallback>{initialsFromName(displayName)}</Avatar.Fallback>
            </Avatar>

            <div className="min-w-0">
              <p className="truncate font-display font-semibold">
                {displayName}
              </p>
              <p className="text-xs text-white/70">
                {member?.membershipNumber || data.profile.membershipNumber}
              </p>
            </div>
          </div>

          <div className="rounded-full border border-white/16 bg-white/10 p-1.5 backdrop-blur-md">
            <ThemeToggle />
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="space-y-2 text-white">
        <div className="flex items-center justify-between px-5">
          <p className="text-xs text-white/80">Quick actions</p>
        </div>
        <div className="w-full">
          <ScrollShadow orientation="horizontal">
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
              {quickActions.map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex  items-center gap-2 rounded-2xl border border-white/14 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl
                    ${index === 0 ? "ml-5" : ""}
                    ${index === quickActions.length - 1 ? "mr-5" : ""}
                  `}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/18">
                    <action.icon className="h-4 w-4" />
                  </span>
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
          </ScrollShadow>
        </div>
      </section>

      {/* Cards & Accounts */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-white px-5">
          <p className="text-xs text-white/80">
            Cards and accounts ({cardMeta.length})
          </p>
          <span className="text-xs text-white/56">
            {loading ? "Syncing..." : "Live"}
          </span>
        </div>

        <ScrollShadow orientation="horizontal">
          <div className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
            {cardMeta.map((card, index) => {
              const gradient =
                card.valueKey === "loans" && data.summary.activeLoan
                  ? "from-[#7a0d16] via-[#5d0910] to-[#340407]"
                  : card.gradient;

              return (
                <div
                  key={card.title}
                  className={`w-[84%] shrink-0 snap-center
                  ${index === 0 ? "ml-5" : ""}
                  ${index === cardMeta.length - 1 ? "mr-5" : ""}
                `}
                >
                  <SummaryCard
                    eyebrow={card.eyebrow}
                    title={card.title}
                    value={cardValues[card.valueKey]}
                    caption={card.caption}
                    href={card.href}
                    ctaLabel={card.ctaLabel}
                    icon={card.icon}
                    gradient={gradient}
                  />
                </div>
              );
            })}
          </div>
        </ScrollShadow>
      </section>

      {/* Recent Transactions — sits on background-50 */}
      <section className="rounded-t-[28px] bg-background-50 px-5 pb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold font-display tracking-tight text-text-900">
              Recent transactions
            </h2>
            <p className="text-xs text-text-500">
              {data.summary.transactionCount} total activity records available
            </p>
          </div>
          <Link
            href="/transactions"
            className="rounded-2xl border border-background-200 dark:border-white/10 px-4 py-2 text-xs font-medium text-text-700"
          >
            View all
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {data.recentTransactions.length ? (
            data.recentTransactions.map((item) => (
              <TransactionCard
                key={item.id}
                type={item.type}
                title={item.description || undefined}
                subtitle={
                  item.reference || item.description || "Member transaction"
                }
                amount={item.amount}
                status={item.status}
                timestamp={item.createdAt}
              />
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-background-300 px-5 py-10 text-center text-sm text-text-400">
              Your recent activity will appear here after your first
              transaction.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
