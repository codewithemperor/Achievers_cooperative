"use client";

import { Activity, ArrowUpRight, PiggyBank, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable } from "@/components/ui/data-table";
import { useApi } from "@/hooks/useApi";
import { StatusBadge } from "@/components/ui/status-badge";

interface SummaryResponse {
  members: { total: number; active: number; pending: number };
  wallet: { totalBalance: number };
  savings: { totalBalance: number };
  loans: { totalDisbursed: number; pending: number };
  investments: { totalPrincipal: number };
}

interface TransactionReport {
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    memberName: string;
    reference?: string;
  }>;
}

interface DashboardReport {
  summary: SummaryResponse;
  membershipGrowth: Array<{ month: string; count: number }>;
  loanPortfolio: Array<{ status: string; count: number; totalAmount: number }>;
  revenue: Array<{ month: string; total: number }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function AdminDashboardPage() {
  const summary = useApi<SummaryResponse>("/reports/summary");
  const transactions = useApi<TransactionReport>("/reports/transactions?limit=6");
  const dashboard = useApi<DashboardReport>("/reports/dashboard");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Track membership growth, wallet position, loan exposure, and recent financial activity from the cooperative control center."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          change={`${summary.data?.members.active ?? 0} active members`}
          color="dark"
          icon={<Users className="h-5 w-5" />}
          title="Total Members"
          value={`${summary.data?.members.total ?? 0}`}
        />
        <StatCard
          change={`${summary.data?.members.pending ?? 0} pending review`}
          color="green"
          icon={<Wallet className="h-5 w-5" />}
          title="Wallet Balance"
          value={currency.format(summary.data?.wallet.totalBalance ?? 0)}
        />
        <StatCard
          change={`${summary.data?.loans.pending ?? 0} awaiting action`}
          color="sand"
          icon={<Activity className="h-5 w-5" />}
          title="Loans Disbursed"
          value={currency.format(summary.data?.loans.totalDisbursed ?? 0)}
        />
        <StatCard
          change="Current subscribed principal"
          color="gold"
          icon={<PiggyBank className="h-5 w-5" />}
          title="Investments"
          value={currency.format(summary.data?.investments.totalPrincipal ?? 0)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4 rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white/80 p-6 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-dark)]">Recent Transactions</h2>
              <p className="mt-1 text-sm text-[var(--color-coop-muted)]">Latest ledger activity from across member wallets.</p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-[var(--color-mid)]" />
          </div>

          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => <span className="font-medium text-[var(--color-dark)]">{item.memberName}</span>,
              },
              {
                key: "type",
                header: "Type",
                render: (item) => <StatusBadge status={item.type} variant="info" />,
              },
              {
                key: "amount",
                header: "Amount",
                render: (item) => <span className="font-semibold text-[var(--color-dark)]">{currency.format(item.amount)}</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (item) => (
                  <StatusBadge
                    status={item.status}
                    variant={item.status === "APPROVED" ? "success" : item.status === "PENDING" ? "warning" : "danger"}
                  />
                ),
              },
            ]}
            data={transactions.data?.items ?? []}
            emptyDescription={transactions.error || "No transaction entries have been recorded yet."}
          />
        </section>

        <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(232,224,208,0.88))] p-6 shadow-[0_18px_45px_rgba(26,46,26,0.05)]">
          <h2 className="text-xl font-semibold text-[var(--color-dark)]">Operational Snapshot</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] bg-white/80 p-4">
              <p className="text-sm text-[var(--color-coop-muted)]">Pending Members</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{summary.data?.members.pending ?? 0}</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/80 p-4">
              <p className="text-sm text-[var(--color-coop-muted)]">Savings Position</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">
                {currency.format(summary.data?.savings.totalBalance ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/80 p-4">
              <p className="text-sm text-[var(--color-coop-muted)]">Data Status</p>
              <p className="mt-2 text-sm text-[var(--color-dark)]">
                {summary.loading ? "Loading live metrics from the API..." : "Dashboard is using live API data."}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
          <h2 className="text-xl font-semibold text-[var(--color-dark)]">Membership Growth</h2>
          <div className="mt-4 space-y-3">
            {(dashboard.data?.membershipGrowth ?? []).slice(-6).map((item) => (
              <div key={item.month} className="flex items-center justify-between rounded-[1.25rem] bg-[rgba(245,240,232,0.72)] px-4 py-3">
                <span className="text-sm text-[var(--color-coop-muted)]">{item.month}</span>
                <span className="font-semibold text-[var(--color-dark)]">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
          <h2 className="text-xl font-semibold text-[var(--color-dark)]">Loan Portfolio</h2>
          <div className="mt-4 space-y-3">
            {(dashboard.data?.loanPortfolio ?? []).map((item) => (
              <div key={item.status} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.72)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge status={item.status} variant="info" />
                  <span className="font-semibold text-[var(--color-dark)]">{item.count}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-coop-muted)]">{currency.format(item.totalAmount)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
          <h2 className="text-xl font-semibold text-[var(--color-dark)]">Revenue</h2>
          <div className="mt-4 space-y-3">
            {(dashboard.data?.revenue ?? []).slice(-6).map((item) => (
              <div key={item.month} className="flex items-center justify-between rounded-[1.25rem] bg-[rgba(245,240,232,0.72)] px-4 py-3">
                <span className="text-sm text-[var(--color-coop-muted)]">{item.month}</span>
                <span className="font-semibold text-[var(--color-dark)]">{currency.format(item.total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
