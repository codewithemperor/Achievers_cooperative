"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  Copy,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { PullToRefresh } from "@/components/pull-to-refresh";
import {
  TransactionDetailModal,
  type TransactionDetailItem,
} from "@/components/transaction-detail-modal";
import { MemberModal } from "@/components/member-modal";
import { useMemberData } from "@/hooks/use-member-data";
import { useProfileData } from "@/hooks/use-profile-data";
import { formatMoney, initialsFromName } from "@/lib/member-format";
import { Avatar, ScrollShadow, Spinner } from "@heroui/react";

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
    pendingPackagesTotal?: number;
    pendingLoansTotal?: number;
    activeLoan: {
      id?: string;
      amount?: number;
      approvedAmount?: number;
      disbursedAmount?: number;
      remainingToDisburse?: number;
      amountPaidSoFar?: number;
      remainingBalance: number;
      status?: string;
    } | null;
    activePackage: {
      totalAmount?: number;
      subscribedAmount: number;
      amountPaid?: number;
      amountRemaining: number;
      packageName: string;
      status: string;
    } | null;
    weeklyDeduction?: {
      weeklyAmount: number;
      outstandingAmount: number;
      prepaidAmount: number;
      totalPaid: number;
      paidThisMonth: number;
      nextDueAt?: string | null;
    };
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
  cooperativeAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  cooperativeAccounts?: Array<{
    bankName: string;
    accountNumber: string;
    accountName: string;
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
    weeklyDeduction: {
      weeklyAmount: 0,
      outstandingAmount: 0,
      prepaidAmount: 0,
      totalPaid: 0,
      paidThisMonth: 0,
      nextDueAt: null,
    },
  },
  recentTransactions: [],
  cooperativeAccounts: [],
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
  { label: "Weekly", href: "/weekly-deductions", icon: CalendarDays },
  { label: "Alerts", href: "/notifications", icon: BellRing },
];

const loanActiveGradient = "from-[#7a0d16] via-[#5d0910] to-[#340407]";
const loanIdleGradient = "from-[#064b5f] via-[#09384b] to-[#0b2435]";

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
    title: "Loan balance",
    valueKey: "loans" as const,
    eyebrow: "Repayment",
    caption: "Stay ahead of due dates and repayment milestones.",
    href: "/loans",
    ctaLabel: "Manage loan",
    icon: <Landmark className="h-5 w-5" />,
    gradient: loanIdleGradient,
  },
  {
    title: "Outstanding Weekly dues",
    valueKey: "weekly" as const,
    eyebrow: "Association",
    caption: "Track your weekly cooperative contribution and prepayments.",
    href: "/weekly-deductions",
    ctaLabel: "Pay dues",
    icon: <CalendarDays className="h-5 w-5" />,
    gradient: "from-[#0f4f46] via-[#0d3d37] to-[#082622]",
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
];

export default function DashboardPage() {
  const { data, loading, refreshing, hasCachedData, refetch } =
    useMemberData<DashboardPayload>("/members/me/dashboard", fallbackData);
  const profile = useProfileData(fallbackProfile);
  const member = profile.data.member;
  const displayName = member?.fullName || data.profile.fullName || "Member";
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionDetailItem | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [copyToast, setCopyToast] = useState("");
  const cooperativeAccounts = data.cooperativeAccounts?.length
    ? data.cooperativeAccounts
    : data.cooperativeAccount
      ? [data.cooperativeAccount]
      : [];

  const cardValues = {
    wallet: formatMoney(data.wallet.availableBalance),
    savings: formatMoney(data.summary.totalSavings),
    investments: formatMoney(data.summary.totalInvestments),
    packages: formatMoney(data.summary.activePackage?.amountRemaining ?? 0),
    loans: formatMoney(data.summary.activeLoan?.remainingBalance ?? 0),
    weekly: formatMoney(data.summary.weeklyDeduction?.outstandingAmount ?? 0),
  };

  async function copyAccountDetail(value: string) {
    await navigator.clipboard?.writeText(value);
    setCopyToast("Copied successfully");
    window.setTimeout(() => setCopyToast(""), 1800);
  }

  return (
    <PullToRefresh
      className="space-y-6 -mt-6 -mx-5 overflow-hidden bg-[linear-gradient(180deg,var(--color-primary-600)_0%,var(--color-primary-700)_17rem,var(--color-background-50)_17rem,var(--color-background-50)_100%)] dark:bg-[linear-gradient(180deg,var(--color-primary-200)_0%,var(--color-primary-300)_17rem,var(--color-background-50)_17rem,var(--color-background-50)_100%)]"
      onRefresh={refetch}
    >
      {(loading || refreshing) && (
        <div className="pointer-events-none fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] flex justify-center px-5">
          <div className="flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/90 px-3 py-2 text-xs font-semibold text-text-700 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-background-900/90 dark:text-text-100">
            <Spinner size="sm" />
            <span>
              {hasCachedData
                ? "Refreshing dashboard..."
                : "Loading dashboard..."}
            </span>
          </div>
        </div>
      )}

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
                  ? loanActiveGradient
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
                    dashboard={true}
                    title={card.title}
                    value={cardValues[card.valueKey]}
                    caption={
                      card.valueKey === "packages"
                        ? data.summary.activePackage
                          ? `Your active package is worth ${formatMoney(data.summary.activePackage.totalAmount ?? data.summary.activePackage.subscribedAmount)}, with ${formatMoney(data.summary.pendingPackagesTotal ?? 0)} still waiting for approval.`
                          : `You have ${formatMoney(data.summary.pendingPackagesTotal ?? 0)} in package requests waiting for approval.`
                        : card.valueKey === "loans"
                          ? data.summary.activeLoan
                            ? `Your approved loan is ${formatMoney(data.summary.activeLoan.approvedAmount ?? data.summary.activeLoan.amount ?? 0)}. ${formatMoney(data.summary.activeLoan.disbursedAmount ?? 0)} has been disbursed, ${formatMoney(data.summary.activeLoan.remainingToDisburse ?? 0)} is still available for disbursement, and ${formatMoney(data.summary.activeLoan.remainingBalance)} is outstanding.`
                            : `You have ${formatMoney(data.summary.pendingLoansTotal ?? 0)} in loan requests waiting for approval.`
                          : card.valueKey === "weekly"
                            ? `Weekly due is ${formatMoney(data.summary.weeklyDeduction?.weeklyAmount ?? 0)}. You have prepaid ${formatMoney(data.summary.weeklyDeduction?.prepaidAmount ?? 0)} and paid ${formatMoney(data.summary.weeklyDeduction?.paidThisMonth ?? 0)} this month.`
                            : card.caption
                    }
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

      {/* Association Account */}
      {cooperativeAccounts.length ? (
        <section className="-mt-3 bg-primary-100/60">
          <div className="flex min-h-14 items-center justify-between gap-4 rounded-2xl  px-4 py-3 ">
            <p className="min-w-0 truncate text-base font-semibold text-text-900 dark:text-text-50">
              Association account details
            </p>
            <button
              className="shrink-0 rounded-full border border-background-200 bg-background-50 px-4 py-2 text-xs font-semibold text-text-700 transition-colors hover:bg-background-100 dark:border-white/10 dark:bg-background-800 dark:text-text-200"
              onClick={() => setIsAccountModalOpen(true)}
              type="button"
            >
              View
            </button>
          </div>
        </section>
      ) : null}

      {/* Recent Transactions */}
      <section className="rounded-t-[28px] bg-background-50 px-5 pb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold font-display tracking-tight text-text-900 dark:text-text-50">
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
                onClick={() => setSelectedTransaction(item)}
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
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
      <MemberModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Association account details"
        description="Use these details when making cooperative payments."
      >
        <div className="grid gap-3">
          {cooperativeAccounts.map((account, index) => (
            <div
              className="rounded-2xl border border-background-200 bg-background-50 p-4 dark:border-background-700 dark:bg-background-900"
              key={`${account.bankName}-${account.accountNumber}-${index}`}
            >
              {[
                ["Bank name", account.bankName],
                ["Account number", account.accountNumber],
                ["Account name", account.accountName],
              ].map(([label, value]) => (
                <div
                  className="flex items-center justify-between gap-3 border-b border-background-200 py-3 first:pt-0 last:border-0 last:pb-0 dark:border-background-700"
                  key={label}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-400">
                      {label}
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold text-text-900 dark:text-text-50">
                      {value || "-"}
                    </p>
                  </div>
                  {value ? (
                    <button
                      aria-label={`Copy ${label}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-background-200 bg-white text-text-700 transition-colors hover:bg-background-100 dark:border-background-700 dark:bg-background-800 dark:text-text-200"
                      onClick={() => void copyAccountDetail(value)}
                      type="button"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </MemberModal>
      {copyToast ? (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-text-900 px-4 py-2 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-text-900">
          {copyToast}
        </div>
      ) : null}
    </PullToRefresh>
  );
}
