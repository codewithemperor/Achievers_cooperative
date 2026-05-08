"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Layers3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { ActionMenu } from "@/components/ui/action-menu";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { TransactionReceiptModal } from "@/components/admin/transaction-receipt-modal";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";

interface PackageDetail {
  id: string;
  name: string;
  totalAmount: number;
  durationMonths: number;
  startDate?: string | null;
  endDate?: string | null;
  penaltyType: string;
  penaltyValue: number;
  penaltyFrequency: string;
  isActive: boolean;
  subscriptions: Array<{
    id: string;
    status: string;
    amountPaid: number;
    amountRemaining: number;
    penaltyAccrued: number;
    subscribedAmount?: number;
    nextDueAt?: string | null;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
  transactions?: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    category?: string | null;
    description?: string | null;
    createdAt: string;
    wallet?: {
      member?: { id: string; fullName: string; membershipNumber: string };
    };
  }>;
}

function getStatusVariant(status: string) {
  const value = status.toUpperCase();
  if (["APPROVED", "COMPLETED", "ACTIVE"].includes(value)) return "success";
  if (["REJECTED", "OVERDUE", "DEFAULTING"].includes(value)) return "danger";
  if (["DISBURSED", "IN_PROGRESS"].includes(value)) return "info";
  if (value === "PENDING") return "warning";
  return "neutral";
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const tabs = [
  { id: "ALL", label: "All" },
  { id: "DEFAULTING", label: "Defaulting" },
  { id: "TRANSACTIONS", label: "Transactions" },
];

export default function PackageDetailPage() {
  const params = useParams<{ id: string }>();
  const packageDetail = useApi<PackageDetail>(`/packages/${params.id}`);
  const [tab, setTab] = useState("ALL");
  const [selectedTransaction, setSelectedTransaction] = useState<
    NonNullable<PackageDetail["transactions"]>[number] | null
  >(null);

  const subscriptions = packageDetail.data?.subscriptions ?? [];
  const filteredSubscriptions = useMemo(() => {
    if (tab === "DEFAULTING") {
      return subscriptions.filter(
        (item) =>
          item.penaltyAccrued > 0 ||
          (item.nextDueAt ? new Date(item.nextDueAt) < new Date() : false),
      );
    }
    return subscriptions;
  }, [subscriptions, tab]);

  const totalPaid = subscriptions.reduce(
    (sum, item) => sum + item.amountPaid,
    0,
  );
  const payableSubscriptions = subscriptions.filter((item) =>
    ["APPROVED", "DISBURSED", "IN_PROGRESS", "COMPLETED"].includes(item.status),
  );
  const totalOutstanding = payableSubscriptions.reduce(
    (sum, item) => sum + item.amountRemaining,
    0,
  );
  const totalPenalty = subscriptions.reduce(
    (sum, item) => sum + item.penaltyAccrued,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={packageDetail.data?.name || "Package detail"}
        subtitle="Review totals, status, and every subscriber with default visibility from one table."
        actions={
          packageDetail.data ? (
            <ConfirmActionButton
              confirmTitle={
                packageDetail.data.isActive
                  ? "Deactivate package?"
                  : "Activate package?"
              }
              confirmMessage={
                packageDetail.data.isActive
                  ? "This will stop new subscriptions for the package until it is activated again."
                  : "This will make the package available for new subscriptions again."
              }
              label={packageDetail.data.isActive ? "Deactivate" : "Activate"}
              onConfirm={async () => {
                try {
                  await api.patch(`/packages/${params.id}`, {
                    isActive: !packageDetail.data?.isActive,
                  });
                  showSuccessToast("Package status updated successfully.");
                  await packageDetail.refetch();
                } catch (error: any) {
                  showErrorToast(
                    error?.response?.data?.message ||
                      "Unable to update package status.",
                  );
                }
              }}
              tone={packageDetail.data.isActive ? "danger" : "success"}
            />
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Configured package target amount."
          href={`/admin/packages/${params.id}`}
          icon={<Layers3 className="h-5 w-5" />}
          title="Total Amount"
          value={currency.format(packageDetail.data?.totalAmount ?? 0)}
          tone="green"
        />
        <DashboardMetricCard
          description="Total amount collected from subscribers."
          href={`/admin/packages/${params.id}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Paid So Far"
          value={currency.format(totalPaid)}
        />
        <DashboardMetricCard
          description="Remaining balance across subscribers."
          href={`/admin/packages/${params.id}`}
          icon={<Clock3 className="h-5 w-5" />}
          title="Outstanding"
          value={currency.format(totalOutstanding)}
          tone="amber"
        />
        <DashboardMetricCard
          description="Total penalty accrued by subscribers."
          href={`/admin/packages/${params.id}`}
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Penalty Accrued"
          value={currency.format(totalPenalty)}
          tone={totalPenalty > 0 ? "red" : "neutral"}
        />
      </section>

      {packageDetail.data?.startDate && packageDetail.data?.endDate ? (
        <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
          <p className="text-sm text-text-400">Repayment schedule</p>
          <p className="mt-2 text-lg font-semibold text-text-900">
            {new Date(packageDetail.data.startDate).toLocaleDateString("en-NG")}{" "}
            - {new Date(packageDetail.data.endDate).toLocaleDateString("en-NG")}
          </p>
          <p className="mt-1 text-sm text-text-400">Weekly repayment cycle</p>
        </section>
      ) : null}

      <AdminTabs
        items={tabs}
        onChange={setTab}
        value={tab}
      />

      {tab === "TRANSACTIONS" ? (
        <DataTable
          columns={[
            {
              key: "member",
              header: "Member",
              render: (transaction) => (
                <div>
                  <p className="font-semibold text-text-900 dark:text-text-50">
                    {transaction.wallet?.member?.fullName || "Member"}
                  </p>
                  <p className="text-xs text-text-400">
                    {transaction.wallet?.member?.membershipNumber || "-"}
                  </p>
                </div>
              ),
              sortValue: (transaction) =>
                transaction.wallet?.member?.fullName || "",
            },
            {
              key: "type",
              header: "Type",
              render: (transaction) => transaction.type.replaceAll("_", " "),
              sortValue: (transaction) => transaction.type,
            },
            {
              key: "amount",
              header: "Amount",
              render: (transaction) => currency.format(transaction.amount),
              sortValue: (transaction) => transaction.amount,
            },
            {
              key: "status",
              header: "Status",
              render: (transaction) => (
                <StatusBadge
                  status={transaction.status}
                  variant={getStatusVariant(transaction.status) as any}
                />
              ),
              sortValue: (transaction) => transaction.status,
            },
            {
              key: "createdAt",
              header: "Date",
              render: (transaction) =>
                new Date(transaction.createdAt).toLocaleDateString("en-NG"),
              sortValue: (transaction) => new Date(transaction.createdAt),
            },
          ]}
          data={packageDetail.data?.transactions ?? []}
          emptyDescription="No package transactions found."
          getRowKey={(transaction) => transaction.id}
          loading={packageDetail.loading}
          onRowClick={(transaction) => setSelectedTransaction(transaction)}
          searchableText={(transaction) =>
            `${transaction.wallet?.member?.fullName || ""} ${transaction.wallet?.member?.membershipNumber || ""} ${transaction.type} ${transaction.status} ${transaction.description || ""} ${transaction.reference || ""}`
          }
          searchPlaceholder="Search package transactions..."
        />
      ) : (
        <DataTable
          columns={[
          {
            key: "subscriber",
            header: "Subscriber",
            render: (subscription) => (
              <div>
                <p className="font-semibold text-text-900 dark:text-text-50">
                  {subscription.member.fullName}
                </p>
                <p className="text-xs text-text-400">
                  {subscription.member.membershipNumber}
                </p>
              </div>
            ),
            sortValue: (subscription) => subscription.member.fullName,
          },
          {
            key: "paid",
            header: "Paid",
            render: (subscription) => currency.format(subscription.amountPaid),
            sortValue: (subscription) => subscription.amountPaid,
          },
          {
            key: "remaining",
            header: "Remaining",
            render: (subscription) =>
              currency.format(subscription.amountRemaining),
            sortValue: (subscription) => subscription.amountRemaining,
          },
          {
            key: "penalty",
            header: "Penalty",
            render: (subscription) =>
              currency.format(subscription.penaltyAccrued),
            sortValue: (subscription) => subscription.penaltyAccrued,
          },
          {
            key: "nextDue",
            header: "Next Due",
            render: (subscription) =>
              subscription.nextDueAt
                ? new Date(subscription.nextDueAt).toLocaleDateString("en-NG")
                : "-",
            sortValue: (subscription) =>
              subscription.nextDueAt ? new Date(subscription.nextDueAt) : "",
          },
          {
            key: "status",
            header: "Status",
            render: (subscription) => (
              <StatusBadge
                status={subscription.status}
                variant={getStatusVariant(subscription.status) as any}
              />
            ),
            sortValue: (subscription) => subscription.status,
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            isAction: true,
            render: (subscription) => (
              <ActionMenu
                items={[
                  {
                    label: "View details",
                    onSelect: () => {
                      window.location.href = `/admin/packages/subscriptions/${subscription.id}`;
                    },
                  },
                  {
                    label: "Accept",
                    tone: "success",
                    isDisabled: subscription.status !== "PENDING",
                    confirmTitle: "Approve package subscription?",
                    confirmMessage:
                      "This will move the subscription into the approved stage.",
                    onSelect: async () => {
                      try {
                        await api.post(
                          `/packages/subscriptions/${subscription.id}/approve`,
                        );
                        showSuccessToast("Package subscription approved.");
                        await packageDetail.refetch();
                      } catch (error: any) {
                        showErrorToast(
                          error?.response?.data?.message ||
                            "Unable to approve subscription.",
                        );
                      }
                    },
                  },
                  {
                    label: "Reject",
                    tone: "danger",
                    isDisabled: subscription.status !== "PENDING",
                    confirmTitle: "Reject package subscription?",
                    confirmMessage:
                      "This subscription will be rejected and removed from the active workflow.",
                    onSelect: async () => {
                      try {
                        await api.post(
                          `/packages/subscriptions/${subscription.id}/reject`,
                        );
                        showSuccessToast("Package subscription rejected.");
                        await packageDetail.refetch();
                      } catch (error: any) {
                        showErrorToast(
                          error?.response?.data?.message ||
                            "Unable to reject subscription.",
                        );
                      }
                    },
                  },
                ]}
              />
            ),
          },
        ]}
          data={filteredSubscriptions}
          emptyDescription="No subscribers found for this package."
          getRowKey={(subscription) => subscription.id}
          loading={packageDetail.loading}
          searchableText={(subscription) =>
            `${subscription.member.fullName} ${subscription.member.membershipNumber} ${subscription.status} ${subscription.amountPaid} ${subscription.amountRemaining}`
          }
          searchPlaceholder="Search subscribers..."
        />
      )}
      {selectedTransaction ? (
        <TransactionReceiptModal
          title="Package Transaction"
          amount={selectedTransaction.amount}
          date={selectedTransaction.createdAt}
          status={selectedTransaction.status}
          reference={selectedTransaction.reference}
          fields={[
            {
              label: "Member",
              value: selectedTransaction.wallet?.member?.fullName || "Member",
            },
            {
              label: "Membership No.",
              value:
                selectedTransaction.wallet?.member?.membershipNumber || "-",
            },
            {
              label: "Type",
              value: selectedTransaction.type.replaceAll("_", " "),
            },
            { label: "Category", value: selectedTransaction.category || "-" },
            {
              label: "Description",
              value: selectedTransaction.description || "-",
            },
          ]}
          timeline={[
            {
              label: "Transaction posted",
              date: selectedTransaction.createdAt,
              status: selectedTransaction.status,
            },
          ]}
          onClose={() => setSelectedTransaction(null)}
        />
      ) : null}
    </div>
  );
}
