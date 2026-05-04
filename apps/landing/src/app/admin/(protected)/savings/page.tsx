"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { useApi } from "@/hooks/useApi";
import { PiggyBank } from "lucide-react";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface SavingsSummary {
  savings: {
    totalBalance: number;
  };
}

interface SavingsTransactionsResponse {
  items: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    description?: string | null;
    wallet: {
      member: {
        id: string;
        fullName: string;
        membershipNumber: string;
      };
    };
  }>;
}

interface SavingsWithdrawalsResponse {
  items: Array<{
    id: string;
    amount: number;
    status: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    createdAt: string;
    member: {
      id: string;
      fullName: string;
      membershipNumber: string;
    };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function SavingsPage() {
  const [tab, setTab] = useState<"transactions" | "withdrawals">(
    "transactions",
  );
  const summary = useApi<SavingsSummary>("/reports/summary");
  const transactions =
    useApi<SavingsTransactionsResponse>("/savings/transactions");
  const withdrawals =
    useApi<SavingsWithdrawalsResponse>("/savings/withdrawals");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings"
        subtitle="Review savings-only transactions and manage member withdrawal requests."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Savings"
          value={currency.format(summary.data?.savings?.totalBalance ?? 0)}
          accent="green"
          icon={<PiggyBank className="h-5 w-5" />}
        />
        <StatCard
          title="Savings Transactions"
          value={String(transactions.data?.items.length ?? 0)}
          accent="blue"
        />
        <StatCard
          title="Withdrawal Requests"
          value={String(withdrawals.data?.items.length ?? 0)}
          accent="dark"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "transactions", label: "Savings Transactions" },
          { id: "withdrawals", label: "Savings Withdrawal Requests" },
        ].map((item) => (
          <button
            key={item.id}
            className={
              tab === item.id
                ? "rounded-full bg-[var(--text-900)] px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-text-900"
            }
            onClick={() =>
              setTab(item.id as "transactions" | "withdrawals")
            }
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "transactions" ? (
        <DataTable
          columns={[
            {
              key: "member",
              header: "Member",
              render: (item) => (
                <div>
                  <p className="font-semibold text-text-900">
                    {item.wallet.member.fullName}
                  </p>
                  <p className="text-xs text-text-400">
                    {item.wallet.member.membershipNumber}
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
              key: "description",
              header: "Description",
              render: (item) => item.description || "Savings contribution",
            },
            {
              key: "status",
              header: "Status",
              render: (item) => item.status,
            },
            {
              key: "date",
              header: "Created",
              render: (item) =>
                new Date(item.createdAt).toLocaleDateString("en-NG"),
            },
          ]}
          data={transactions.data?.items ?? []}
          emptyDescription={
            transactions.error || "No savings transactions available yet."
          }
          loading={transactions.loading}
        />
      ) : (
        <DataTable
          columns={[
            {
              key: "member",
              header: "Member",
              render: (item) => (
                <div>
                  <p className="font-semibold text-text-900">
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
              header: "Bank Account",
              render: (item) => (
                <div>
                  <p className="font-medium text-text-900">{item.bankName}</p>
                  <p className="text-xs text-text-400">
                    {item.accountName} · {item.accountNumber}
                  </p>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (item) => item.status,
            },
            {
              key: "action",
              header: "Action",
              render: (item) =>
                item.status === "PENDING" ? (
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-full bg-[var(--primary-700)] px-3 py-1 text-xs font-semibold text-white"
                      onClick={async () => {
                        try {
                          await api.patch(
                            `/savings/withdrawals/${item.id}/approve`,
                          );
                          showSuccessToast(
                            "Withdrawal request approved successfully.",
                          );
                          await withdrawals.refetch();
                          await summary.refetch();
                        } catch (error: any) {
                          showErrorToast(
                            error?.response?.data?.message ||
                              "Unable to approve withdrawal request.",
                          );
                        }
                      }}
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-full bg-[#b42318] px-3 py-1 text-xs font-semibold text-white"
                      onClick={async () => {
                        try {
                          await api.patch(
                            `/savings/withdrawals/${item.id}/reject`,
                            {},
                          );
                          showSuccessToast(
                            "Withdrawal request rejected successfully.",
                          );
                          await withdrawals.refetch();
                        } catch (error: any) {
                          showErrorToast(
                            error?.response?.data?.message ||
                              "Unable to reject withdrawal request.",
                          );
                        }
                      }}
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  "-"
                ),
            },
          ]}
          data={withdrawals.data?.items ?? []}
          emptyDescription={
            withdrawals.error || "No withdrawal requests available yet."
          }
          loading={withdrawals.loading}
        />
      )}
    </div>
  );
}
