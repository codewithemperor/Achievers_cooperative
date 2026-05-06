"use client";

import { useMemo, useState } from "react";
import {
  Tab,
  TabIndicator,
  TabList,
  TabListContainer,
  TabPanel,
  TabsRoot,
} from "@heroui/react";
import { ActionMenu } from "@/components/ui/action-menu";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface WalletWithdrawalsResponse {
  items: Array<{
    id: string;
    amount: number;
    status: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    rejectionReason?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    disbursedAt?: string | null;
    createdAt: string;
    member: {
      id: string;
      fullName: string;
      membershipNumber: string;
    };
  }>;
}

interface MemberTransactionsResponse {
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    description?: string | null;
    createdAt: string;
    wallet?: {
      member?: {
        fullName: string;
        membershipNumber: string;
      };
    };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function variantForStatus(status: string) {
  const value = status.toUpperCase();
  if (["APPROVED", "DISBURSED", "COMPLETED"].includes(value)) return "success";
  if (["REJECTED", "FAILED"].includes(value)) return "danger";
  if (value === "PENDING") return "warning";
  return "neutral";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-NG");
}

function DetailModal({
  item,
  onClose,
}: {
  item: WalletWithdrawalsResponse["items"][number];
  onClose: () => void;
}) {
  const rows = [
    ["Member", item.member.fullName],
    ["Member number", item.member.membershipNumber],
    ["Withdrawal ID", item.id],
    ["Amount", currency.format(item.amount)],
    ["Status", item.status],
    ["Bank", item.bankName],
    ["Account name", item.accountName],
    ["Account number", item.accountNumber],
    ["Requested", formatDateTime(item.createdAt)],
    ["Approved", formatDateTime(item.approvedAt)],
    ["Rejected", formatDateTime(item.rejectedAt)],
    ["Disbursed", formatDateTime(item.disbursedAt)],
    ["Reason", item.rejectionReason || "-"],
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <button
        aria-label="Close detail"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-[101] max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text-900">
              Withdrawal details
            </h2>
            <p className="mt-1 text-sm text-text-400">{item.id}</p>
          </div>
          <button
            className="rounded-xl border border-primary-900/12 px-3 py-1.5 text-sm font-semibold text-text-900"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div className="rounded-xl bg-background-50 p-4" key={label}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-400">
                {label}
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-text-900">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WithdrawalsPage() {
  const withdrawals = useApi<WalletWithdrawalsResponse>("/wallet/withdrawals");
  const transactions = useApi<MemberTransactionsResponse>("/transactions");
  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<WalletWithdrawalsResponse["items"][number] | null>(null);

  const withdrawalTransactions = useMemo(
    () =>
      (transactions.data?.items ?? []).filter((item) =>
        item.type.toUpperCase().includes("WITHDRAW"),
      ),
    [transactions.data],
  );

  async function mutateWithdrawal(
    id: string,
    action: "approve" | "reject" | "disburse",
  ) {
    try {
      await api.patch(`/wallet/withdrawals/${id}/${action}`);
      showSuccessToast(`Withdrawal ${action}d successfully.`);
      await Promise.all([withdrawals.refetch(), transactions.refetch()]);
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || `Unable to ${action} withdrawal.`,
      );
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawals"
        subtitle="Approve member wallet withdrawal requests, then mark them as disbursed only after the bank transfer is complete."
      />

      <TabsRoot defaultSelectedKey="requests">
        <TabListContainer className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary-900/10 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <TabList
            aria-label="Withdrawal sections"
            className="relative flex w-full gap-1 rounded-xl bg-background-100 p-1 sm:w-auto"
          >
            <Tab
              className="relative z-10 flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-text-500 selected:text-text-900 sm:flex-none"
              id="requests"
            >
              Requests
            </Tab>
            <Tab
              className="relative z-10 flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-text-500 selected:text-text-900 sm:flex-none"
              id="transactions"
            >
              Transactions
            </Tab>
            <TabIndicator className="rounded-lg bg-white shadow-sm" />
          </TabList>
          <p className="px-2 text-xs font-medium text-text-400">
            {(withdrawals.data?.items ?? []).filter((item) => item.status === "PENDING").length} pending request(s)
          </p>
        </TabListContainer>

        <TabPanel id="requests">
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
                sortValue: (item) => item.member.fullName,
              },
              {
                key: "account",
                header: "Account",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-text-900">
                      {item.bankName}
                    </p>
                    <p className="text-xs text-text-400">
                      {item.accountName} - {item.accountNumber}
                    </p>
                  </div>
                ),
                sortValue: (item) => item.bankName,
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
                    variant={variantForStatus(item.status) as any}
                  />
                ),
                sortValue: (item) => item.status,
              },
              {
                key: "createdAt",
                header: "Requested",
                render: (item) => formatDateTime(item.createdAt),
                sortValue: (item) => new Date(item.createdAt),
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
                        label: "View details",
                        onSelect: () => setSelectedWithdrawal(item),
                      },
                      {
                        label: "Approve",
                        tone: "success",
                        isDisabled: item.status !== "PENDING",
                        confirmTitle: "Approve withdrawal?",
                        confirmMessage:
                          "Are you sure you want to approve this request?",
                        onSelect: () => mutateWithdrawal(item.id, "approve"),
                      },
                      {
                        label: "Reject",
                        tone: "danger",
                        isDisabled: item.status !== "PENDING",
                        confirmTitle: "Reject withdrawal?",
                        confirmMessage:
                          "Are you sure you want to reject this request?",
                        onSelect: () => mutateWithdrawal(item.id, "reject"),
                      },
                      {
                        label: "Disburse",
                        tone: "success",
                        isDisabled: item.status !== "APPROVED",
                        confirmTitle: "Disburse withdrawal?",
                        confirmMessage: `Confirm that transfer has been made to ${item.accountName} at ${item.bankName} (${item.accountNumber}) before marking this as disbursed.`,
                        onSelect: () => mutateWithdrawal(item.id, "disburse"),
                      },
                    ]}
                  />
                ),
              },
            ]}
            data={withdrawals.data?.items ?? []}
            emptyDescription={
              withdrawals.error || "No withdrawal requests found."
            }
            getRowKey={(item) => item.id}
            loading={withdrawals.loading}
            searchableText={(item) =>
              `${item.member.fullName} ${item.member.membershipNumber} ${item.bankName} ${item.accountName} ${item.accountNumber} ${item.amount} ${item.status}`
            }
            searchPlaceholder="Search withdrawals..."
          />
        </TabPanel>

        <TabPanel id="transactions">
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-text-900">
                      {item.wallet?.member?.fullName || "Member"}
                    </p>
                    <p className="text-xs text-text-400">
                      {item.wallet?.member?.membershipNumber || "-"}
                    </p>
                  </div>
                ),
                sortValue: (item) => item.wallet?.member?.fullName || "",
              },
              {
                key: "reference",
                header: "Reference",
                render: (item) => item.reference || item.description || "-",
                sortValue: (item) => item.reference || item.description || "",
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
                    variant={variantForStatus(item.status) as any}
                  />
                ),
                sortValue: (item) => item.status,
              },
              {
                key: "createdAt",
                header: "Date",
                render: (item) => formatDateTime(item.createdAt),
                sortValue: (item) => new Date(item.createdAt),
              },
            ]}
            data={withdrawalTransactions}
            emptyDescription={
              transactions.error || "No withdrawal transactions found."
            }
            getRowKey={(item) => item.id}
            loading={transactions.loading}
            searchableText={(item) =>
              `${item.wallet?.member?.fullName || ""} ${item.wallet?.member?.membershipNumber || ""} ${item.reference || ""} ${item.description || ""} ${item.amount} ${item.status}`
            }
            searchPlaceholder="Search withdrawal transactions..."
          />
        </TabPanel>
      </TabsRoot>

      {selectedWithdrawal ? (
        <DetailModal
          item={selectedWithdrawal}
          onClose={() => setSelectedWithdrawal(null)}
        />
      ) : null}
    </div>
  );
}
