"use client";

import Link from "next/link";
import { useMemberData } from "../lib/use-member-data";

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
    activeLoan: { remainingBalance: number } | null;
  };
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  cooperativeAccount: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
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
    activeLoan: null,
  },
  recentTransactions: [],
  cooperativeAccount: {
    bankName: "Community Trust Bank",
    accountName: "Achievers Cooperative Society",
    accountNumber: "0123456789",
  },
};

const quickActions = [
  { label: "Add Money", href: "/wallet" },
  { label: "Loans", href: "/loans" },
  { label: "Savings", href: "/savings" },
  { label: "Packages", href: "/dashboard" },
  { label: "Investments", href: "/investments" },
  { label: "Transactions", href: "/transactions" },
  { label: "Support", href: "/profile" },
];

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function DashboardPage() {
  const { data, error } = useMemberData<DashboardPayload>("/members/me/dashboard", fallbackData);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[linear-gradient(145deg,#17321e,#2d5a27,#5f7c54)] p-6 text-white shadow-[0_20px_50px_rgba(23,50,30,0.18)]">
        <p className="text-sm text-white/70">Welcome back</p>
        <h1 className="mt-1 text-2xl font-semibold">{data.profile.fullName}</h1>
        <p className="mt-1 text-sm text-white/70">{data.profile.membershipNumber}</p>
        <div className="mt-6 rounded-[1.5rem] bg-white/10 p-5 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.18em] text-white/70">Wallet balance</p>
          <p className="mt-2 text-3xl font-semibold">{money.format(data.wallet.availableBalance)}</p>
          <div className="mt-4">
            <Link
              href="/wallet"
              className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-green)]"
            >
              Add money to wallet
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-white/70">Pending deductions</p>
              <p className="mt-1 font-medium">{money.format(data.wallet.pendingBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-white/70">Active loan balance</p>
              <p className="mt-1 font-medium">{money.format(data.summary.activeLoan?.remainingBalance ?? 0)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Cooperative account details</h2>
            <p className="mt-2 text-sm text-[var(--brand-moss)]">
              Use these details when funding your wallet, then upload the payment receipt for approval.
            </p>
          </div>
          <button
            className="rounded-full border border-[var(--brand-stroke)] bg-white px-4 py-2 text-xs font-semibold text-[var(--brand-ink)]"
            onClick={() => void navigator.clipboard.writeText(data.cooperativeAccount.accountNumber)}
            type="button"
          >
            Copy account number
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Bank</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{data.cooperativeAccount.bankName || "-"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Account name</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{data.cooperativeAccount.accountName || "-"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Account number</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{data.cooperativeAccount.accountNumber || "-"}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.6rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-4">
          <p className="text-sm text-[var(--brand-moss)]">Total savings</p>
          <p className="mt-2 text-xl font-semibold text-[var(--brand-ink)]">{money.format(data.summary.totalSavings)}</p>
        </div>
        <div className="rounded-[1.6rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-4">
          <p className="text-sm text-[var(--brand-moss)]">Investments</p>
          <p className="mt-2 text-xl font-semibold text-[var(--brand-ink)]">{money.format(data.summary.totalInvestments)}</p>
        </div>
        <div className="rounded-[1.6rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-4">
          <p className="text-sm text-[var(--brand-moss)]">Transactions</p>
          <p className="mt-2 text-xl font-semibold text-[var(--brand-ink)]">{data.summary.transactionCount}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Quick actions</h2>
          {error ? <span className="text-xs text-[var(--brand-moss)]">Showing fallback data</span> : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white px-4 py-4 text-sm font-semibold text-[var(--brand-ink)] transition hover:border-[var(--brand-green)] hover:text-[var(--brand-green)]"
              href={action.href}
              key={action.label}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Recent activity</h2>
          <Link href="/transactions" className="text-sm font-semibold text-[var(--brand-green)]">
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {data.recentTransactions.length ? (
            data.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[var(--brand-ink)]">{transaction.type.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-[var(--brand-moss)]">
                      {new Date(transaction.createdAt).toLocaleDateString("en-NG")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[var(--brand-ink)]">{money.format(transaction.amount)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">{transaction.status}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-[var(--brand-stroke)] bg-white p-6 text-sm text-[var(--brand-moss)]">
              Recent transaction activity will appear here once your member session is connected.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
