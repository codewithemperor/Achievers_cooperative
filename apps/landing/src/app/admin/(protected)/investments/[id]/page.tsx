"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Landmark, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { TransactionReceiptModal } from "@/components/admin/transaction-receipt-modal";
import { ActionMenu } from "@/components/ui/action-menu";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface InvestmentDetail {
  id: string;
  name: string;
  annualRate: number;
  minimumAmount: number;
  maximumAmount?: number | null;
  durationMonths: number;
  status: string;
  subscriptions: Array<{
    id: string;
    principal: number;
    maturityDate: string;
    maturityAmount: number;
    status: string;
    isDefaulter: boolean;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
  cancellationRequests?: Array<{
    id: string;
    reason?: string | null;
    status: string;
    rejectionReason?: string | null;
    createdAt: string;
    member: { id: string; fullName: string; membershipNumber: string };
    investment: {
      id: string;
      principal: number;
      maturityDate: string;
      product?: { id: string; name: string } | null;
    };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function InvestmentDetailPage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState<
    "subscribers" | "withdrawals" | "transactions"
  >("subscribers");
  const [selectedTransaction, setSelectedTransaction] = useState<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt?: string | null;
    member: { fullName: string; membershipNumber: string };
    description: string;
  } | null>(null);
  const investment = useApi<InvestmentDetail>(
    `/investments/products/${params.id}`,
  );
  const subscriptions = investment.data?.subscriptions ?? [];
  const cancellationRequests = investment.data?.cancellationRequests ?? [];
  const pendingCancellations = cancellationRequests.filter(
    (item) => item.status === "PENDING",
  );
  const totalInvested = subscriptions.reduce(
    (sum, item) => sum + (item.status === "APPROVED" ? item.principal : 0),
    0,
  );
  const investmentTransactions = [
    ...subscriptions.map((subscription) => ({
      id: `subscription-${subscription.id}`,
      type: "Subscription",
      amount: subscription.principal,
      status: subscription.status,
      createdAt: subscription.maturityDate,
      member: subscription.member,
      description: `Subscribed to ${investment.data?.name || "investment product"}`,
    })),
    ...cancellationRequests.map((request) => ({
      id: `withdrawal-${request.id}`,
      type: "Withdrawal",
      amount: request.investment.principal,
      status: request.status === "APPROVED" ? "WITHDRAWN" : request.status,
      createdAt: request.createdAt,
      member: request.member,
      description: request.reason || "Investment withdrawal request",
    })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={investment.data?.name || "Investment detail"}
        subtitle="Track product totals, expected payout, and every subscriber in a single table."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <DashboardMetricCard
          description="Configured return percentage for this product."
          href={`/admin/investments/${params.id}`}
          title="Annual Rate"
          value={`${investment.data?.annualRate ?? 0}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="green"
        />
        <DashboardMetricCard
          description="Minimum principal a member can subscribe with."
          href={`/admin/investments/${params.id}`}
          title="Minimum Amount"
          value={currency.format(investment.data?.minimumAmount ?? 0)}
          icon={<Landmark className="h-5 w-5" />}
        />
        <DashboardMetricCard
          description="Total principal currently subscribed to this product."
          href={`/admin/investments/${params.id}`}
          title="Amount Invested"
          value={currency.format(totalInvested)}
          icon={<Users className="h-5 w-5" />}
          tone="amber"
        />
        <DashboardMetricCard
          description="Cancellation requests waiting on this product."
          href={`/admin/investments/${params.id}`}
          title="Pending Withdrawals"
          value={pendingCancellations.length}
          icon={<TrendingUp className="h-5 w-5" />}
          tone={pendingCancellations.length > 0 ? "red" : "neutral"}
        />
      </section>

      <AdminTabs
        items={[
          { id: "subscribers", label: "Subscribers" },
          { id: "withdrawals", label: "Withdrawal Requests" },
          { id: "transactions", label: "Transactions" },
        ]}
        meta={`${pendingCancellations.length} pending`}
        onChange={setTab}
        value={tab}
      />

      {tab === "transactions" ? (
        <DataTable
          columns={[
            {
              key: "member",
              header: "Member",
              render: (item) => (
                <div>
                  <p className="font-semibold text-text-900 dark:text-text-50">
                    {item.member.fullName}
                  </p>
                  <p className="text-xs text-text-400">
                    {item.member.membershipNumber}
                  </p>
                </div>
              ),
              sortValue: (item) => item.member.fullName,
            },
            {
              key: "type",
              header: "Type",
              render: (item) => item.type,
              sortValue: (item) => item.type,
            },
            {
              key: "amount",
              header: "Amount",
              render: (item) => currency.format(item.amount),
              sortValue: (item) => item.amount,
            },
            {
              key: "status",
              header: "Status",
              render: (item) => (
                <StatusBadge
                  status={item.status}
                  variant={
                    ["APPROVED", "WITHDRAWN", "SUCCESSFUL"].includes(item.status)
                      ? "success"
                      : ["REJECTED"].includes(item.status)
                        ? "danger"
                        : "warning"
                  }
                />
              ),
              sortValue: (item) => item.status,
            },
            {
              key: "createdAt",
              header: "Date",
              render: (item) =>
                item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString("en-NG")
                  : "-",
              sortValue: (item) =>
                item.createdAt ? new Date(item.createdAt) : "",
            },
          ]}
          data={investmentTransactions}
          emptyDescription="No investment transactions found."
          getRowKey={(item) => item.id}
          loading={investment.loading}
          onRowClick={(item) => setSelectedTransaction(item)}
          searchableText={(item) =>
            `${item.member.fullName} ${item.member.membershipNumber} ${item.type} ${item.status} ${item.description}`
          }
          searchPlaceholder="Search investment transactions..."
        />
      ) : tab === "subscribers" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-900 dark:text-text-50">
              Subscribers
            </h2>
            <StatusBadge
              status={investment.data?.status || "UNKNOWN"}
              variant={
                investment.data?.status === "ACTIVE" ? "success" : "warning"
              }
            />
          </div>
          <DataTable
            columns={[
              {
                key: "subscriber",
                header: "Subscriber",
                render: (subscriber) => (
                  <div>
                    <p className="font-semibold text-text-900 dark:text-text-50">
                      {subscriber.member.fullName}
                    </p>
                    <p className="text-xs text-text-400">
                      {subscriber.member.membershipNumber}
                    </p>
                  </div>
                ),
                sortValue: (subscriber) => subscriber.member.fullName,
              },
              {
                key: "principal",
                header: "Principal",
                render: (subscriber) => currency.format(subscriber.principal),
                sortValue: (subscriber) => subscriber.principal,
              },
              {
                key: "maturityDate",
                header: "Maturity Date",
                render: (subscriber) =>
                  new Date(subscriber.maturityDate).toLocaleDateString("en-NG"),
                sortValue: (subscriber) => new Date(subscriber.maturityDate),
              },
              {
                key: "maturityAmount",
                header: "Maturity Amount",
                render: (subscriber) =>
                  currency.format(subscriber.maturityAmount),
                sortValue: (subscriber) => subscriber.maturityAmount,
              },
              {
                key: "status",
                header: "Status",
                render: (subscriber) => (
                  <StatusBadge
                    status={subscriber.status}
                    variant={
                      subscriber.status === "APPROVED" ? "success" : "warning"
                    }
                  />
                ),
                sortValue: (subscriber) => subscriber.status,
              },
              {
                key: "defaulting",
                header: "Defaulting",
                render: (subscriber) =>
                  subscriber.isDefaulter ? "Yes" : "No",
                sortValue: (subscriber) => (subscriber.isDefaulter ? 1 : 0),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                isAction: true,
                render: (subscriber) => (
                  <ActionMenu
                    items={[
                      {
                        label: "View member",
                        onSelect: () => {
                          window.location.href = `/admin/members/${subscriber.member.id}`;
                        },
                      },
                    ]}
                  />
                ),
              },
            ]}
            data={subscriptions}
            emptyDescription="No subscribers found for this investment product."
            getRowKey={(subscriber) => subscriber.id}
            loading={investment.loading}
            searchableText={(subscriber) =>
              `${subscriber.member.fullName} ${subscriber.member.membershipNumber} ${subscriber.status} ${subscriber.principal}`
            }
            searchPlaceholder="Search subscribers..."
          />
        </section>
      ) : (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-text-900 dark:text-text-50">
              Withdrawal Requests
            </h2>
            <p className="mt-1 text-sm text-text-400">
              Review cancellation and withdrawal requests for this product.
            </p>
          </div>
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-text-900 dark:text-text-50">
                      {item.member.fullName}
                    </p>
                    <p className="text-xs text-text-400">
                      {item.member.membershipNumber}
                    </p>
                  </div>
                ),
                sortValue: (item) => item.member.fullName,
              },
              {
                key: "principal",
                header: "Principal",
                render: (item) => currency.format(item.investment.principal),
                sortValue: (item) => item.investment.principal,
              },
              {
                key: "reason",
                header: "Reason",
                render: (item) => item.reason || "-",
              },
              {
                key: "createdAt",
                header: "Requested",
                render: (item) =>
                  new Date(item.createdAt).toLocaleDateString("en-NG"),
                sortValue: (item) => new Date(item.createdAt),
              },
              {
                key: "status",
                header: "Status",
                render: (item) => (
                  <StatusBadge
                    status={item.status}
                    variant={
                      item.status === "APPROVED"
                        ? "success"
                        : item.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  />
                ),
                sortValue: (item) => item.status,
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                isAction: true,
                render: (item) => (
                  <ActionMenu
                    items={[
                      {
                        label: "Approve",
                        tone: "success",
                        isDisabled: item.status !== "PENDING",
                        confirmTitle: "Approve cancellation?",
                        confirmMessage: `Approve this cancellation and refund ${currency.format(item.investment.principal)} to the member wallet?`,
                        onSelect: async () => {
                          try {
                            await api.patch(
                              `/investments/cancellations/${item.id}/approve`,
                            );
                            showSuccessToast(
                              "Investment cancellation approved.",
                            );
                            await investment.refetch();
                          } catch (error: any) {
                            showErrorToast(
                              error?.response?.data?.message ||
                                "Unable to approve cancellation.",
                            );
                          }
                        },
                      },
                      {
                        label: "Reject",
                        tone: "danger",
                        isDisabled: item.status !== "PENDING",
                        confirmTitle: "Reject cancellation?",
                        confirmMessage:
                          "Are you sure you want to reject this cancellation request?",
                        onSelect: async () => {
                          try {
                            await api.patch(
                              `/investments/cancellations/${item.id}/reject`,
                              {},
                            );
                            showSuccessToast(
                              "Investment cancellation rejected.",
                            );
                            await investment.refetch();
                          } catch (error: any) {
                            showErrorToast(
                              error?.response?.data?.message ||
                                "Unable to reject cancellation.",
                            );
                          }
                        },
                      },
                    ]}
                  />
                ),
              },
            ]}
            data={cancellationRequests}
            emptyDescription="No withdrawal requests found for this product."
            getRowKey={(request) => request.id}
            loading={investment.loading}
            searchableText={(request) =>
              `${request.member.fullName} ${request.member.membershipNumber} ${request.status} ${request.reason ?? ""}`
            }
            searchPlaceholder="Search withdrawal requests..."
          />
        </section>
      )}
      {selectedTransaction ? (
        <TransactionReceiptModal
          title="Investment Transaction"
          amount={selectedTransaction.amount}
          date={selectedTransaction.createdAt}
          status={selectedTransaction.status}
          reference={selectedTransaction.id}
          fields={[
            { label: "Member", value: selectedTransaction.member.fullName },
            {
              label: "Membership No.",
              value: selectedTransaction.member.membershipNumber,
            },
            { label: "Type", value: selectedTransaction.type },
            { label: "Product", value: investment.data?.name || "-" },
            { label: "Description", value: selectedTransaction.description },
          ]}
          timeline={[
            {
              label:
                selectedTransaction.type === "Withdrawal"
                  ? "Withdrawal requested"
                  : "Subscription created",
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
