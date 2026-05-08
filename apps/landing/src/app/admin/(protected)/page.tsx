"use client";

import {
  Banknote,
  Bell,
  CheckCircle2,
  Clock3,
  CreditCard,
  Package,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { useApi } from "@/hooks/useApi";
import {
  DashboardMetricCard,
  DashboardPanel,
  DashboardRequestCard,
} from "@/components/admin/dashboard-card";

interface DashboardResponse {
  summary: {
    members: { total: number; active: number; pending: number };
    loans: { pending: number };
    investments: { pendingCancellations: number };
    packages: { pending: number };
    approvals: {
      walletWithdrawals: number;
      investmentCancellations: number;
      total: number;
    };
    autoDeduction: { status: string; lastRun: string };
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
      })
    : "-";
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton className="h-48 rounded-2xl" key={index} />
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const dashboard = useApi<DashboardResponse>("/reports/dashboard");
  const summary = dashboard.data?.summary;
  const pendingPayments = dashboard.data?.pendingPayments ?? [];
  const pendingLoans = dashboard.data?.pendingLoans ?? [];
  const pendingWithdrawals = dashboard.data?.pendingWalletWithdrawals ?? [];
  const investmentApprovals = summary?.investments.pendingCancellations ?? 0;
  const packageApprovals = summary?.packages.pending ?? 0;
  const totalPendingApprovals =
    pendingPayments.length +
    pendingLoans.length +
    pendingWithdrawals.length +
    investmentApprovals +
    packageApprovals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Quick view of member requests, approvals, and admin work that needs attention."
      />

      {dashboard.loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard
            description="Uploaded wallet-funding receipts waiting for review."
            href="/admin/payments"
            icon={<Receipt className="h-5 w-5" />}
            title="Payment Request"
            tone="green"
            value={pendingPayments.length}
          />
          <DashboardMetricCard
            description="Loan applications that have not been approved yet."
            href="/admin/loans"
            icon={<Banknote className="h-5 w-5" />}
            title="Loan Request"
            tone="neutral"
            value={pendingLoans.length || summary?.loans.pending || 0}
          />
          <DashboardMetricCard
            description="Wallet withdrawals awaiting approval or disbursement."
            href="/admin/withdrawals"
            icon={<Wallet className="h-5 w-5" />}
            title="Withdrawal Request"
            tone="neutral"
            value={pendingWithdrawals.length}
          />
          <DashboardMetricCard
            description="All requests and reviews currently waiting for action."
            href="/admin/investments"
            icon={<Bell className="h-5 w-5" />}
            title="Pending Approval"
            tone={totalPendingApprovals > 0 ? "amber" : "neutral"}
            value={totalPendingApprovals}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel
          href="/admin/payments"
          subtitle="Click any card to continue from the related admin page."
          title="Pending Requests"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {pendingPayments.slice(0, 4).map((payment) => (
              <DashboardRequestCard
                amount={currency.format(payment.amount)}
                href="/admin/payments"
                key={payment.id}
                meta={formatDate(payment.createdAt)}
                status={payment.status}
                subtitle="Payment proof needs verification"
                title={payment.member.fullName}
              />
            ))}
            {pendingLoans.slice(0, 4).map((loan) => (
              <DashboardRequestCard
                amount={currency.format(loan.amount)}
                href="/admin/loans"
                key={loan.id}
                meta={loan.purpose}
                status={loan.status}
                subtitle="Loan application needs review"
                title={loan.member.fullName}
              />
            ))}
            {!pendingPayments.length && !pendingLoans.length ? (
              <div className="rounded-2xl border border-dashed border-primary-900/12 bg-background-50 p-6 text-sm text-text-400 lg:col-span-2">
                No pending payment or loan requests right now.
              </div>
            ) : null}
          </div>
        </DashboardPanel>

        <DashboardPanel
          href="/admin/withdrawals"
          subtitle="Transfers that need approval or manual bank disbursement."
          title="Withdrawal Queue"
        >
          <div className="space-y-3">
            {pendingWithdrawals.slice(0, 5).map((withdrawal) => (
              <DashboardRequestCard
                amount={currency.format(withdrawal.amount)}
                href="/admin/withdrawals"
                key={withdrawal.id}
                meta={withdrawal.bankName}
                status={withdrawal.status}
                subtitle={withdrawal.member.membershipNumber}
                title={withdrawal.member.fullName}
              />
            ))}
            {!pendingWithdrawals.length ? (
              <div className="rounded-2xl border border-dashed border-primary-900/12 bg-background-50 p-6 text-sm text-text-400">
                No wallet withdrawal request is waiting.
              </div>
            ) : null}
          </div>
        </DashboardPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardPanel title="Approval Summary">
          <div className="grid gap-3">
            {[
              {
                title: "Payment approvals",
                count: pendingPayments.length,
                href: "/admin/payments",
                icon: CreditCard,
              },
              {
                title: "Loan approvals",
                count: pendingLoans.length || summary?.loans.pending || 0,
                href: "/admin/loans",
                icon: Banknote,
              },
              {
                title: "Withdrawal approvals",
                count: pendingWithdrawals.length,
                href: "/admin/withdrawals",
                icon: Wallet,
              },
              {
                title: "Investment cancellations",
                count: investmentApprovals,
                href: "/admin/investments",
                icon: TrendingUp,
              },
              {
                title: "Pending packages",
                count: packageApprovals,
                href: "/admin/packages",
                icon: Package,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <a
                  className="flex items-center justify-between rounded-2xl bg-background-50 p-3 transition hover:bg-white hover:shadow-sm"
                  href={item.href}
                  key={item.title}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--primary-700)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-text-900">
                      {item.title}
                    </span>
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-text-900">
                    {item.count}
                  </span>
                </a>
              );
            })}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Members">
          <div className="grid gap-3">
            <div className="rounded-2xl bg-background-50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--primary-700)]">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-semibold text-text-900">
                    {summary?.members.total ?? 0}
                  </p>
                  <p className="text-sm text-text-400">Total members</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-background-50 p-4">
                <p className="text-xl font-semibold text-text-900">
                  {summary?.members.active ?? 0}
                </p>
                <p className="text-xs text-text-400">Active</p>
              </div>
              <div className="rounded-2xl bg-background-50 p-4">
                <p className="text-xl font-semibold text-text-900">
                  {summary?.members.pending ?? 0}
                </p>
                <p className="text-xs text-text-400">Pending</p>
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel href="/admin/settings" title="System Status">
          <div className="space-y-3">
            <div className="rounded-2xl bg-background-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-900">
                    Auto deduction
                  </p>
                  <p className="mt-1 text-xs text-text-400">
                    Last run:{" "}
                    {summary?.autoDeduction.lastRun
                      ? formatDate(summary.autoDeduction.lastRun)
                      : "Never"}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-900">
                  {summary?.autoDeduction.status ?? "NEVER_RUN"}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-background-50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--primary-700)]">
                  {totalPendingApprovals > 0 ? (
                    <Clock3 className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-900">
                    {totalPendingApprovals > 0
                      ? "Admin attention needed"
                      : "No pending approval"}
                  </p>
                  <p className="text-xs text-text-400">
                    {totalPendingApprovals} item(s) waiting
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
