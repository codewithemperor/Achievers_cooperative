"use client";

import Link from "next/link";
import { Activity, ArrowDownCircle, ArrowUpCircle, PiggyBank, Users } from "lucide-react";
import { Skeleton } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { useApi } from "@/hooks/useApi";
import { StatusBadge } from "@/components/ui/status-badge";

interface DashboardResponse {
  summary: {
    members: { total: number; active: number; pending: number };
    wallet: { totalBalance: number };
    savings: { totalBalance: number };
    loans: { totalDisbursed: number; pending: number };
    investments: { totalPrincipal: number };
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
        <h2 className="text-[15px] font-semibold text-[var(--color-dark)]">{title}</h2>
        <p className="mt-0.5 text-xs text-[var(--color-coop-muted)]">{subtitle}</p>
      </div>
      <Link className="shrink-0 text-xs font-semibold text-[var(--color-green)]" href={href}>
        View more
      </Link>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon,
  accentClass,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[rgba(26,46,26,0.08)] bg-white p-5 ${accentClass}`}>
      <div className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(26,46,26,0.05)]">
        {icon}
      </div>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[var(--color-coop-muted)]">{title}</p>
      <p className="text-2xl font-semibold text-[var(--color-dark)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-coop-muted)]">{sub}</p>
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

const card = "rounded-2xl border border-[rgba(26,46,26,0.08)] bg-white p-5";

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
        {dashboard.loading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
          : (
            <>
              <StatCard
                accentClass="border-t-2 border-t-[var(--color-dark)]"
                icon={<Users className="h-4 w-4 text-[var(--color-dark)]" />}
                sub={`${summary?.members.active ?? 0} active · ${summary?.members.pending ?? 0} pending`}
                title="Total Members"
                value={`${summary?.members.total ?? 0}`}
              />
              <StatCard
                accentClass="border-t-2 border-t-[var(--color-green)]"
                icon={<ArrowDownCircle className="h-4 w-4 text-[var(--color-green)]" />}
                sub={`Income ${currency.format(summary?.cooperativeTreasury.totalIncome ?? 0)}`}
                title="Cooperative Treasury"
                value={currency.format(summary?.cooperativeTreasury.balance ?? 0)}
              />
              <StatCard
                accentClass="border-t-2 border-t-amber-600"
                icon={<Activity className="h-4 w-4 text-amber-600" />}
                sub={`${summary?.loans.pending ?? 0} awaiting action`}
                title="Loans Disbursed"
                value={currency.format(summary?.loans.totalDisbursed ?? 0)}
              />
              <StatCard
                accentClass="border-t-2 border-t-blue-600"
                icon={<PiggyBank className="h-4 w-4 text-blue-600" />}
                sub={`Expense ${currency.format(summary?.cooperativeTreasury.totalExpense ?? 0)}`}
                title="Investments"
                value={currency.format(summary?.investments.totalPrincipal ?? 0)}
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
              render: (item) => <span className="font-medium text-[var(--color-dark)]">{item.member.fullName}</span>,
            },
            {
              key: "amount",
              header: "Amount",
              render: (item) => <span className="font-semibold text-[var(--color-dark)]">{currency.format(item.amount)}</span>,
            },
            {
              key: "date",
              header: "Date",
              render: (item) => <span className="text-[var(--color-coop-muted)]">{formatDate(item.createdAt)}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (item) => <StatusBadge status={item.status} variant="warning" />,
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
            href="/admin/loans"
            subtitle="Applications that still need approval"
            title="Loan Requests Pending Approval"
          />
          {dashboard.loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(dashboard.data?.pendingLoans ?? []).map((loan) => (
                <div key={loan.id} className="rounded-xl bg-[rgba(245,240,232,0.72)] px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--color-dark)]">{loan.member.fullName}</p>
                    <StatusBadge status={loan.status} variant="warning" />
                  </div>
                  <p className="mt-2 text-sm font-medium text-[var(--color-dark)]">{currency.format(loan.amount)}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-coop-muted)]">{loan.purpose}</p>
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
                render: (item) => <span className="font-medium text-[var(--color-dark)]">{item.category}</span>,
              },
              {
                key: "type",
                header: "Type",
                render: (item) => (
                  <span className={item.type === "INCOME" ? "text-[var(--color-green)]" : "text-[#b42318]"}>
                    {item.type}
                  </span>
                ),
              },
              {
                key: "amount",
                header: "Amount",
                render: (item) => (
                  <span className="flex items-center gap-2 text-[var(--color-coop-muted)]">
                    {item.type === "INCOME" ? (
                      <ArrowDownCircle className="h-4 w-4 text-[var(--color-green)]" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 text-[#b42318]" />
                    )}
                    {currency.format(item.amount)}
                  </span>
                ),
              },
              {
                key: "createdAt",
                header: "Date",
                render: (item) => <span className="text-[var(--color-coop-muted)]">{formatDate(item.createdAt)}</span>,
              },
            ]}
            data={dashboard.data?.recentTransactions.items ?? []}
            emptyDescription={dashboard.error ?? "No treasury transactions found."}
            loading={dashboard.loading}
          />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className={card}>
          <h2 className="mb-4 text-[15px] font-semibold text-[var(--color-dark)]">Membership Growth</h2>
          {dashboard.loading ? (
            <ListSkeleton rows={6} />
          ) : (
            <div className="divide-y divide-[rgba(26,46,26,0.06)]">
              {(dashboard.data?.membershipGrowth ?? []).slice(-6).map((item) => (
                <div key={item.month} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-[var(--color-coop-muted)]">{item.month}</span>
                  <span className="text-sm font-semibold text-[var(--color-dark)]">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-4 text-[15px] font-semibold text-[var(--color-dark)]">Loan Portfolio</h2>
          {dashboard.loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="divide-y divide-[rgba(26,46,26,0.06)]">
              {(dashboard.data?.loanPortfolio ?? []).map((item) => (
                <div key={item.status} className="flex items-center justify-between py-2.5">
                  <StatusBadge status={item.status} variant="info" />
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--color-dark)]">{currency.format(item.totalAmount)}</p>
                    <p className="text-xs text-[var(--color-coop-muted)]">{item.count} loans</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-4 text-[15px] font-semibold text-[var(--color-dark)]">Revenue</h2>
          {dashboard.loading ? (
            <ListSkeleton rows={6} />
          ) : (
            <div className="divide-y divide-[rgba(26,46,26,0.06)]">
              {(dashboard.data?.revenue ?? []).slice(-6).map((item) => (
                <div key={item.month} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-[var(--color-coop-muted)]">{item.month}</span>
                  <span className="text-sm font-semibold text-[var(--color-dark)]">{currency.format(item.total)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
