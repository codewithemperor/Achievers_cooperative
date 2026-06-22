"use client";

import { Bell, Banknote, Package, PiggyBank, Receipt, TrendingUp, Wallet } from "lucide-react";
import { DashboardMetricCard, DashboardPanel, DashboardRequestCard } from "@/components/admin/dashboard-card";
import { PageHeader } from "@/components/ui/page-header";
import { useApi } from "@/hooks/useApi";

interface NotificationsResponse {
  summary: {
    loans: { pending: number };
    investments: { pendingCancellations: number };
    packages: { pending: number };
    approvals?: {
      walletWithdrawals: number;
      savingsWithdrawals: number;
      investmentCancellations: number;
      total: number;
    };
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
  pendingSavingsWithdrawals: Array<{
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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(iso?: string) {
  return iso
    ? new Date(iso).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
      })
    : "-";
}

export default function NotificationsPage() {
  const dashboard = useApi<NotificationsResponse>("/reports/dashboard");
  const pendingPayments = dashboard.data?.pendingPayments ?? [];
  const pendingLoans = dashboard.data?.pendingLoans ?? [];
  const pendingWithdrawals = dashboard.data?.pendingWalletWithdrawals ?? [];
  const pendingSavingsWithdrawals =
    dashboard.data?.pendingSavingsWithdrawals ?? [];
  const pendingWithdrawalRequests = [
    ...pendingWithdrawals.map((withdrawal) => ({
      ...withdrawal,
      accountType: "Wallet withdrawal",
      href: "/admin/withdrawals",
    })),
    ...pendingSavingsWithdrawals.map((withdrawal) => ({
      ...withdrawal,
      accountType: "Savings withdrawal",
      href: "/admin/savings",
    })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const pendingInvestments =
    dashboard.data?.summary.investments.pendingCancellations ?? 0;
  const pendingPackages = dashboard.data?.summary.packages.pending ?? 0;
  const total =
    pendingPayments.length +
    pendingLoans.length +
    pendingWithdrawalRequests.length +
    pendingInvestments +
    pendingPackages;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Requests and approvals that need admin attention."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="All open approval and request items."
          href="/admin/notifications"
          icon={<Bell className="h-5 w-5" />}
          title="Total Alerts"
          tone={total ? "amber" : "neutral"}
          value={total}
        />
        <DashboardMetricCard
          description="Payment proofs awaiting verification."
          href="/admin/payments"
          icon={<Receipt className="h-5 w-5" />}
          title="Payments"
          value={pendingPayments.length}
        />
        <DashboardMetricCard
          description="Withdrawal requests awaiting action."
          href="/admin/withdrawals"
          icon={<Wallet className="h-5 w-5" />}
          title="Withdrawals"
          value={pendingWithdrawalRequests.length}
        />
        <DashboardMetricCard
          description="Loan requests awaiting review."
          href="/admin/loans"
          icon={<Banknote className="h-5 w-5" />}
          title="Loans"
          value={pendingLoans.length}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardPanel href="/admin/payments" title="Payment Requests">
          <div className="space-y-3">
            {pendingPayments.map((payment) => (
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
            {!pendingPayments.length ? (
              <p className="rounded-2xl border border-dashed border-primary-900/12 bg-background-50 p-5 text-sm text-text-400">
                No payment request is waiting.
              </p>
            ) : null}
          </div>
        </DashboardPanel>

        <DashboardPanel href="/admin/withdrawals" title="Withdrawal Requests">
          <div className="space-y-3">
            {pendingWithdrawalRequests.map((withdrawal) => (
              <DashboardRequestCard
                amount={currency.format(withdrawal.amount)}
                href={withdrawal.href}
                key={`${withdrawal.accountType}-${withdrawal.id}`}
                meta={withdrawal.bankName}
                status={withdrawal.status}
                subtitle={`${withdrawal.accountType} - ${withdrawal.member.membershipNumber}`}
                title={withdrawal.member.fullName}
              />
            ))}
            {!pendingWithdrawalRequests.length ? (
              <p className="rounded-2xl border border-dashed border-primary-900/12 bg-background-50 p-5 text-sm text-text-400">
                No withdrawal request is waiting.
              </p>
            ) : null}
          </div>
        </DashboardPanel>

        <DashboardPanel href="/admin/loans" title="Loan Requests">
          <div className="space-y-3">
            {pendingLoans.map((loan) => (
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
            {!pendingLoans.length ? (
              <p className="rounded-2xl border border-dashed border-primary-900/12 bg-background-50 p-5 text-sm text-text-400">
                No loan request is waiting.
              </p>
            ) : null}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Other Approvals">
          <div className="grid gap-3">
            {[
              {
                title: "Savings withdrawals",
                count: pendingSavingsWithdrawals.length,
                href: "/admin/savings",
                icon: PiggyBank,
              },
              {
                title: "Investment cancellations",
                count: pendingInvestments,
                href: "/admin/investments",
                icon: TrendingUp,
              },
              {
                title: "Pending package requests",
                count: pendingPackages,
                href: "/admin/packages",
                icon: Package,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <a
                  className="flex items-center justify-between rounded-2xl bg-background-50 p-4 transition hover:bg-white hover:shadow-sm dark:hover:bg-[var(--background-800)]"
                  href={item.href}
                  key={item.title}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--primary-700)] dark:bg-[var(--background-900)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-text-900 dark:text-text-50">
                      {item.title}
                    </span>
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-text-900 dark:bg-[var(--background-900)] dark:text-text-50">
                    {item.count}
                  </span>
                </a>
              );
            })}
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
