"use client";

import Link from "next/link";
import { ArrowRightLeft, BellRing, Landmark, MoonStar, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { useMemberData } from "@/hooks/use-member-data";
import { useProfileData } from "@/hooks/use-profile-data";
import { formatMoney, initialsFromName } from "@/lib/member-format";

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
  { label: "Transfer", href: "/wallet", icon: ArrowRightLeft },
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
    gradient: "from-[#245f4f] via-[#194f49] to-[#123d42]",
  },
  {
    title: "Savings balance",
    valueKey: "savings" as const,
    eyebrow: "Steady growth",
    caption: "Review your contribution rhythm and latest savings movement.",
    href: "/savings",
    ctaLabel: "Open savings",
    icon: <PiggyBank className="h-5 w-5" />,
    gradient: "from-[#1d7d58] via-[#176a53] to-[#105347]",
  },
  {
    title: "Investments",
    valueKey: "investments" as const,
    eyebrow: "Opportunity",
    caption: "Track active products and expected maturity returns.",
    href: "/investments",
    ctaLabel: "View products",
    icon: <TrendingUp className="h-5 w-5" />,
    gradient: "from-[#3f8c53] via-[#2d7549] to-[#1b5c40]",
  },
  {
    title: "Loan balance",
    valueKey: "loans" as const,
    eyebrow: "Repayment",
    caption: "Stay ahead of due dates and repayment milestones.",
    href: "/loans",
    ctaLabel: "Manage loan",
    icon: <Landmark className="h-5 w-5" />,
    gradient: "from-[#8c4a4a] via-[#784146] to-[#5f3340]",
  },
];

export default function DashboardPage() {
  const { data, loading } = useMemberData<DashboardPayload>("/members/me/dashboard", fallbackData);
  const profile = useProfileData(fallbackProfile);
  const member = profile.data.member;
  const displayName = member?.fullName || data.profile.fullName || "Member";

  const cardValues = {
    wallet: formatMoney(data.wallet.availableBalance),
    savings: formatMoney(data.summary.totalSavings),
    investments: formatMoney(data.summary.totalInvestments),
    loans: formatMoney(data.summary.activeLoan?.remainingBalance ?? 0),
  };

  return (
    <div className="space-y-6">
      <section className="pt-1 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/18 text-sm font-semibold backdrop-blur-md">
              {member?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
              ) : (
                initialsFromName(displayName)
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{displayName}</p>
              <p className="text-sm text-white/72">{member?.membershipNumber || data.profile.membershipNumber}</p>
            </div>
          </div>

          <div className="rounded-full border border-white/16 bg-white/10 p-1.5 backdrop-blur-md">
            <ThemeToggle className="border-white/12 bg-transparent hover:bg-white/10 dark:border-white/10 dark:bg-transparent" />
          </div>
        </div>
      </section>

      <section className="space-y-3 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/82">Quick actions</p>
          <MoonStar className="h-4 w-4 text-white/60" />
        </div>
        <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex min-w-[145px] items-center gap-2 rounded-2xl border border-white/14 bg-[rgba(10,46,39,0.26)] px-4 py-3 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/18">
                <action.icon className="h-4 w-4" />
              </span>
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between text-white">
          <p className="text-sm text-white/82">Cards and accounts ({cardMeta.length})</p>
          <span className="text-xs text-white/56">{loading ? "Syncing..." : "Live"}</span>
        </div>

        <div className="hide-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3">
          {cardMeta.map((card) => (
            <div key={card.title} className="w-[84%] shrink-0 snap-center">
              <SummaryCard
                eyebrow={card.eyebrow}
                title={card.title}
                value={cardValues[card.valueKey]}
                caption={card.caption}
                href={card.href}
                ctaLabel={card.ctaLabel}
                icon={card.icon}
                gradient={card.gradient}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-2">
          {cardMeta.slice(0, 3).map((card, index) => (
            <span
              key={card.title}
              className={`h-2 w-2 rounded-full ${index === 1 ? "bg-[var(--primary-400)]" : "bg-white/35"}`}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-white/92 px-4 py-5 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[1.35rem] font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">
              Recent transactions
            </h2>
            <p className="mt-1 text-sm text-[var(--text-400)]">
              {data.summary.transactionCount} total activity records available
            </p>
          </div>
          <Link
            href="/transactions"
            className="rounded-2xl border border-[var(--background-200)] px-4 py-2 text-sm font-medium text-[var(--text-700)] dark:border-white/10 dark:text-[var(--text-200)]"
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
                subtitle={item.reference || item.description || "Member transaction"}
                amount={item.amount}
                status={item.status}
                timestamp={item.createdAt}
              />
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
              Your recent activity will appear here after your first transaction.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
