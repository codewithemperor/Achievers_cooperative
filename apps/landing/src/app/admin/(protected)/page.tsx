"use client";

import Link from "next/link";
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock3,
  PiggyBank,
  Users,
} from "lucide-react";
import { Skeleton } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { useApi } from "@/hooks/useApi";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";

interface DashboardResponse {
  summary: {
    members: { total: number; active: number; pending: number };
    wallet: { totalBalance: number };
    savings: { totalBalance: number };
    loans: { totalDisbursed: number; pending: number };
    investments: { totalPrincipal: number; pendingCancellations: number };
    packages: { pending: number };
    approvals: {
      walletWithdrawals: number;
      investmentCancellations: number;
      total: number;
    };
    autoDeduction: { status: string; lastRun: string };
    cooperativeTreasury: {
      balance: number;
      totalIncome: number;
      totalExpense: number;
    };
  };
  membershipGrowth: Array<{ month: string; count: number }>;
  loanPortfolio: Array<{ status: string; count: number; totalAmount: number }>;
  revenue: Array<{ month: string; total: number }>;
  recentTransactions: {
    items: Array<{
      id: string;
      type: "INCOME" | "EXPENSE";
      amount: number;
      category: string;
      description: string;
      createdAt: string;
    }>;
  };
  pendingPayments: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt?: string;
    member: { fullName: string };
  }>;
  pendingLoans: Array<{
    id: string;
    amount: number;
    status: string;
    purpose: string;
    member: { fullName: string };
  }>;
  pendingWalletWithdrawals: Array<{
    id: string;
    amount: number;
    status: string;
    bankName: string;
    createdAt: string;
    member: { fullName: string; membershipNumber: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function formatDate(iso?: string) {
  return iso
    ? new Date(iso).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";
}

function SectionHeader({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-bold text-text-900 dark:text-text-50">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-text-400">{subtitle}</p>
      </div>
      <Link
        className="shrink-0 text-xs font-semibold text-[var(--primary-600)] hover:text-[var(--primary-700)] dark:text-[var(--primary-400)]"
        href={href}
      >
        View more
      </Link>
    </div>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 rounded-xl" />
      ))}
    </div>
  );
}

const card =
  "rounded-2xl border border-[var(--background-200)] bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]";

function AttentionCard({
  title,
  value,
  subtitle,
  href,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  href: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    neutral: "bg-background-50 text-text-900",
    warning: "bg-[#fff7e6] text-[#9a5b00]",
    danger: "bg-[#fff1f0] text-[#b42318]",
    success: "bg-[#edf7ed] text-[var(--primary-800)]",
  }[tone];

  return (
    <Link
      className="group rounded-2xl border border-primary-900/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      href={href}
    >
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}
      >
        {tone === "success" ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Clock3 className="h-5 w-5" />
        )}
      </div>
      <p className="text-sm font-semibold text-text-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-text-900">{value}</p>
      <p className="mt-1 text-xs text-text-400">{subtitle}</p>
    </Link>
  );
}

function MiniBarChart({
  items,
}: {
  items: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="space-y-3">
      {items.map((item) => {
        return (
          <div
            className="grid grid-cols-[72px_1fr_auto] items-center gap-3"
            key={item.label}
          >
            <span className="truncate text-xs font-medium text-text-400">
              {item.label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-background-100">
              <span
                className="block h-full rounded-full bg-[var(--primary-600)]"
                style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }}
              />
            </span>
            <span className="text-xs font-semibold text-text-900">
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboardPage() {
  const dashboard = useApi<DashboardResponse>("/reports/dashboard");
  const summary = dashboard.data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Membership, cooperative treasury, approvals, and activity in one overview."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AttentionCard
          href="/admin/withdrawals"
          subtitle="Wallet transfers waiting for review"
          title="Withdrawal Requests"
          tone={(summary?.approvals.walletWithdrawals ?? 0) > 0 ? "warning" : "success"}
          value={summary?.approvals.walletWithdrawals ?? 0}
        />
        <AttentionCard
          href="/admin/payments"
          subtitle="Uploaded receipts awaiting verification"
          title="Payment Requests"
          tone={(dashboard.data?.pendingPayments.length ?? 0) > 0 ? "warning" : "success"}
          value={dashboard.data?.pendingPayments.length ?? 0}
        />
        <AttentionCard
          href="/admin/investments"
          subtitle="Investment cancellations needing action"
          title="Investment Reviews"
          tone={(summary?.investments.pendingCancellations ?? 0) > 0 ? "danger" : "success"}
          value={summary?.investments.pendingCancellations ?? 0}
        />
        <AttentionCard
          href="/admin/settings"
          subtitle={
            summary?.autoDeduction.lastRun
              ? `Last run ${formatDate(summary.autoDeduction.lastRun)}`
              : "No successful run yet"
          }
          title="Auto Deduction"
          tone={summary?.autoDeduction.status === "FAILED" ? "danger" : "neutral"}
          value={summary?.autoDeduction.status ?? "NEVER_RUN"}
        />
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))
        ) : (
          <>
            <StatCard
              accent="dark"
              icon={<Users className="h-5 w-5" />}
              sub={`${summary?.members.active ?? 0} active · ${summary?.members.pending ?? 0} pending`}
              title="Total Members"
              value={`${summary?.members.total ?? 0}`}
            />
            <StatCard
              accent="green"
              icon={<ArrowDownCircle className="h-5 w-5" />}
              sub={`Income ${currency.format(summary?.cooperativeTreasury.totalIncome ?? 0)}`}
              title="Cooperative Treasury"
              value={currency.format(summary?.cooperativeTreasury.balance ?? 0)}
            />
            <StatCard
              accent="amber"
              icon={<Activity className="h-5 w-5" />}
              sub={`${summary?.loans.pending ?? 0} awaiting action`}
              title="Loans Disbursed"
              value={currency.format(summary?.loans.totalDisbursed ?? 0)}
            />
            <StatCard
              accent="blue"
              icon={<PiggyBank className="h-5 w-5" />}
              sub={`${summary?.investments.pendingCancellations ?? 0} cancellations pending`}
              title="Investments"
              value={currency.format(summary?.investments.totalPrincipal ?? 0)}
            />
            <StatCard
              accent="red"
              icon={<Activity className="h-5 w-5" />}
              sub={`${summary?.approvals.walletWithdrawals ?? 0} wallet withdrawals · ${summary?.packages.pending ?? 0} packages`}
              title="Pending Approvals"
              value={`${summary?.approvals.total ?? 0}`}
            />
            <StatCard
              accent={
                summary?.autoDeduction.status === "FAILED" ? "red" : "dark"
              }
              icon={<Activity className="h-5 w-5" />}
              sub={
                summary?.autoDeduction.lastRun
                  ? `Last run ${formatDate(summary.autoDeduction.lastRun)}`
                  : "No successful run yet"
              }
              title="Auto Deduction"
              value={summary?.autoDeduction.status ?? "NEVER_RUN"}
            />
          </>
        )}
      </div>

      <section className={card}>
        <SectionHeader
          href="/admin/payments"
          subtitle="Wallet-funding payments waiting for review"
          title="Recent Payments Pending Approval"
        />
        <DataTable
          columns={[
            {
              key: "member",
              header: "Member",
              render: (item) => (
                <span className="font-medium text-text-900 dark:text-text-50">
                  {item.member.fullName}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              render: (item) => (
                <span className="font-semibold text-text-900 dark:text-text-50">
                  {currency.format(item.amount)}
                </span>
              ),
            },
            {
              key: "date",
              header: "Date",
              render: (item) => (
                <span className="text-text-400">
                  {formatDate(item.createdAt)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (item) => (
                <StatusBadge status={item.status} variant="warning" />
              ),
            },
          ]}
          data={dashboard.data?.pendingPayments ?? []}
          emptyDescription={dashboard.error ?? "No pending payments."}
          loading={dashboard.loading}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={card}>
          <SectionHeader
            href="/admin/withdrawals"
            subtitle="Wallet withdrawals that require approval or transfer"
            title="Wallet Withdrawals Pending"
          />
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => (
                  <div>
                    <p className="font-medium text-text-900 dark:text-text-50">
                      {item.member.fullName}
                    </p>
                    <p className="text-xs text-text-400">
                      {item.member.membershipNumber}
                    </p>
                  </div>
                ),
              },
              {
                key: "amount",
                header: "Amount",
                render: (item) => currency.format(item.amount),
              },
              {
                key: "bank",
                header: "Bank",
                render: (item) => item.bankName,
              },
              {
                key: "status",
                header: "Status",
                render: (item) => (
                  <StatusBadge status={item.status} variant="warning" />
                ),
              },
            ]}
            data={dashboard.data?.pendingWalletWithdrawals ?? []}
            emptyDescription={dashboard.error ?? "No pending withdrawals."}
            loading={dashboard.loading}
          />
        </section>

        <section className={card}>
          <SectionHeader
            href="/admin/loans"
            subtitle="Applications that still need approval"
            title="Loan Requests Pending Approval"
          />
          {dashboard.loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(dashboard.data?.pendingLoans ?? []).map((loan) => (
                <div
                  key={loan.id}
                  className="rounded-xl bg-[var(--background-50)] px-4 py-3 dark:bg-[var(--background-800)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-text-900 dark:text-text-50">
                      {loan.member.fullName}
                    </p>
                    <StatusBadge status={loan.status} variant="warning" />
                  </div>
                  <p className="mt-2 text-sm font-medium text-text-900 dark:text-text-50">
                    {currency.format(loan.amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-text-400">{loan.purpose}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={card}>
          <SectionHeader
            href="/admin/transactions"
            subtitle="Latest treasury inflow and outflow entries"
            title="Recent Transactions"
          />
          <DataTable
            columns={[
              {
                key: "category",
                header: "Name",
                render: (item) => (
                  <span className="font-medium text-text-900 dark:text-text-50">
                    {item.category}
                  </span>
                ),
              },
              {
                key: "type",
                header: "Type",
                render: (item) => (
                  <span
                    className={
                      item.type === "INCOME"
                        ? "text-[var(--primary-600)] dark:text-[var(--primary-400)]"
                        : "text-red-500"
                    }
                  >
                    {item.type}
                  </span>
                ),
              },
              {
                key: "amount",
                header: "Amount",
                render: (item) => (
                  <span className="flex items-center gap-2 text-text-500">
                    {item.type === "INCOME" ? (
                      <ArrowDownCircle className="h-4 w-4 text-[var(--primary-600)] dark:text-[var(--primary-400)]" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 text-red-500" />
                    )}
                    {currency.format(item.amount)}
                  </span>
                ),
              },
              {
                key: "createdAt",
                header: "Date",
                render: (item) => (
                  <span className="text-text-400">
                    {formatDate(item.createdAt)}
                  </span>
                ),
              },
            ]}
            data={dashboard.data?.recentTransactions.items ?? []}
            emptyDescription={
              dashboard.error ?? "No treasury transactions found."
            }
            loading={dashboard.loading}
          />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className={card}>
          <h2 className="mb-4 text-sm font-bold text-text-900 dark:text-text-50">
            Membership Growth
          </h2>
          {dashboard.loading ? (
            <ListSkeleton rows={6} />
          ) : (
            <MiniBarChart
              items={(dashboard.data?.membershipGrowth ?? [])
                .slice(-6)
                .map((item) => ({ label: item.month, value: item.count }))}
            />
          )}
        </section>

        <section className={card}>
          <h2 className="mb-4 text-sm font-bold text-text-900 dark:text-text-50">
            Loan Portfolio
          </h2>
          {dashboard.loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="space-y-3">
              {(dashboard.data?.loanPortfolio ?? []).map((item) => (
                <div key={item.status} className="rounded-xl bg-background-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <StatusBadge status={item.status} variant="info" />
                    <p className="text-xs text-text-400">{item.count} loans</p>
                  </div>
                  <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                    {currency.format(item.totalAmount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-4 text-sm font-bold text-text-900 dark:text-text-50">
            Revenue
          </h2>
          {dashboard.loading ? (
            <ListSkeleton rows={6} />
          ) : (
            <MiniBarChart
              items={(dashboard.data?.revenue ?? [])
                .slice(-6)
                .map((item) => ({ label: item.month, value: item.total }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
