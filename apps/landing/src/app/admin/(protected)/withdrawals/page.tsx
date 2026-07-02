"use client";

import { useMemo, useState } from "react";
import { parseDate } from "@internationalized/date";
import { useForm, useWatch } from "react-hook-form";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { TransactionReceiptModal } from "@/components/admin/transaction-receipt-modal";
import { DataTable } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/form-input";
import type { DateRange } from "@/components/ui/form-input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { getCurrentMonthRange, isWithinDateRange } from "@/lib/date-range";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { CheckCircle2, Clock3, Send, Wallet } from "lucide-react";

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

interface TransactionFiltersForm {
  transactionDateRange: DateRange;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

export default function WithdrawalsPage() {
  const withdrawals = useApi<WalletWithdrawalsResponse>("/wallet/withdrawals");
  const transactions = useApi<MemberTransactionsResponse>("/transactions");
  const currentMonthRange = useMemo(() => getCurrentMonthRange(), []);
  const { control: filtersControl } = useForm<TransactionFiltersForm>({
    defaultValues: {
      transactionDateRange: {
        start: parseDate(currentMonthRange.from),
        end: parseDate(currentMonthRange.to),
      },
    },
  });
  const selectedDateRange = useWatch({
    control: filtersControl,
    name: "transactionDateRange",
  });
  const startDate =
    selectedDateRange?.start?.toString() ?? currentMonthRange.from;
  const endDate = selectedDateRange?.end?.toString() ?? currentMonthRange.to;
  const [tab, setTab] = useState<"requests" | "transactions">("requests");
  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<WalletWithdrawalsResponse["items"][number] | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "approve" | "reject" | "disburse" | null
  >(null);

  const withdrawalRows = withdrawals.data?.items ?? [];
  const pendingWithdrawals = withdrawalRows.filter((item) => item.status === "PENDING");
  const processedWithdrawals = withdrawalRows.filter((item) => item.status !== "PENDING");
  const visibleProcessedWithdrawals = processedWithdrawals.filter((item) =>
    isWithinDateRange(item.createdAt, startDate, endDate),
  );
  const approvedWithdrawals = withdrawalRows.filter((item) => item.status === "APPROVED");
  const disbursedWithdrawals = withdrawalRows.filter((item) =>
    ["DISBURSED", "COMPLETED"].includes(item.status),
  );
  const pendingAmount = pendingWithdrawals.reduce(
    (sum, item) => sum + Number(item.amount ?? 0),
    0,
  );
  const dateRangeToolbar = (
    <DateRangePicker
      className="w-full"
      control={filtersControl}
      label=""
      name="transactionDateRange"
    />
  );

  async function mutateWithdrawal(
    id: string,
    action: "approve" | "reject" | "disburse",
  ) {
    if (pendingAction) return;

    const labels = {
      approve: "approve this withdrawal request",
      reject: "reject this withdrawal request",
      disburse: "mark this withdrawal as disbursed",
    } as const;
    const confirmed = window.confirm(`Are you sure you want to ${labels[action]}?`);
    if (!confirmed) return;

    setPendingAction(action);
    try {
      await api.patch(`/wallet/withdrawals/${id}/${action}`);
      const successMessages = {
        approve: "Withdrawal approved successfully.",
        reject: "Withdrawal rejected successfully.",
        disburse: "Withdrawal marked as disbursed successfully.",
      } as const;
      showSuccessToast(successMessages[action]);
      await Promise.all([withdrawals.refetch(), transactions.refetch()]);
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || `Unable to ${action} withdrawal.`,
      );
      throw error;
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawals"
        subtitle="Approve member wallet withdrawal requests, then mark them as disbursed only after the bank transfer is complete."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Withdrawal requests waiting for approval."
          href="/admin/withdrawals"
          icon={<Clock3 className="h-5 w-5" />}
          title="Pending Requests"
          tone={pendingWithdrawals.length ? "amber" : "neutral"}
          value={pendingWithdrawals.length}
        />
        <DashboardMetricCard
          description="Total pending withdrawal value."
          href="/admin/withdrawals"
          icon={<Wallet className="h-5 w-5" />}
          title="Pending Amount"
          tone="green"
          value={currency.format(pendingAmount)}
        />
        <DashboardMetricCard
          description="Approved requests awaiting transfer."
          href="/admin/withdrawals"
          icon={<Send className="h-5 w-5" />}
          title="Awaiting Disbursement"
          value={approvedWithdrawals.length}
        />
        <DashboardMetricCard
          description="Withdrawals marked as disbursed."
          href="/admin/withdrawals"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Disbursed"
          value={disbursedWithdrawals.length}
        />
      </div>

      <AdminTabs
        items={[
          { id: "requests", label: "Requests" },
          { id: "transactions", label: "Transactions" },
        ]}
        meta={`${pendingWithdrawals.length} pending request(s)`}
        onChange={setTab}
        value={tab}
      />

      {tab === "requests" ? (
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
                  <button
                    className="rounded-full border border-primary-900/12 bg-white px-4 py-2 text-sm font-semibold text-text-800 transition hover:bg-background-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedWithdrawal(item);
                    }}
                    type="button"
                  >
                    View
                  </button>
                ),
              },
            ]}
            data={pendingWithdrawals}
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
                header: "Date",
                render: (item) => formatDateTime(item.createdAt),
                sortValue: (item) => new Date(item.createdAt),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                isAction: true,
                render: (item) => (
                  <button
                    className="rounded-full border border-primary-900/12 bg-white px-4 py-2 text-sm font-semibold text-text-800 transition hover:bg-background-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedWithdrawal(item);
                    }}
                    type="button"
                  >
                    View
                  </button>
                ),
              },
            ]}
            data={visibleProcessedWithdrawals}
            emptyDescription={
              transactions.error || "No withdrawal transactions found."
            }
            getRowKey={(item) => item.id}
            loading={withdrawals.loading || transactions.loading}
            toolbar={dateRangeToolbar}
            onRowClick={(item) => setSelectedWithdrawal(item)}
            searchableText={(item) =>
              `${item.member.fullName} ${item.member.membershipNumber} ${item.bankName} ${item.accountName} ${item.accountNumber} ${item.amount} ${item.status}`
            }
            searchPlaceholder="Search withdrawal transactions..."
          />
      )}

      {selectedWithdrawal ? (
        <TransactionReceiptModal
          title="Wallet Withdrawal"
          amount={selectedWithdrawal.amount}
          date={selectedWithdrawal.createdAt}
          status={selectedWithdrawal.status}
          reference={`WALLET-WD-${selectedWithdrawal.id.slice(0, 8)}`}
          fields={[
            { label: "Member", value: selectedWithdrawal.member.fullName },
            {
              label: "Membership No.",
              value: selectedWithdrawal.member.membershipNumber,
            },
            { label: "Bank", value: selectedWithdrawal.bankName },
            { label: "Account Name", value: selectedWithdrawal.accountName },
            {
              label: "Account Number",
              value: selectedWithdrawal.accountNumber,
            },
            {
              label: "Reason",
              value: selectedWithdrawal.rejectionReason || "-",
            },
          ]}
          timeline={[
            {
              label: "Requested",
              date: selectedWithdrawal.createdAt,
              status: "PENDING",
            },
            ...(selectedWithdrawal.approvedAt
              ? [
                  {
                    label: "Approved",
                    date: selectedWithdrawal.approvedAt,
                    status: "APPROVED",
                  },
                ]
              : []),
            ...(selectedWithdrawal.rejectedAt
              ? [
                  {
                    label: "Rejected",
                    date: selectedWithdrawal.rejectedAt,
                    status: "REJECTED",
                  },
                ]
              : []),
            ...(selectedWithdrawal.disbursedAt
              ? [
                  {
                    label: "Disbursed",
                    date: selectedWithdrawal.disbursedAt,
                    status: "DISBURSED",
                  },
                ]
              : []),
          ]}
          actions={
            <>
              {selectedWithdrawal.status === "PENDING" ? (
                <>
                  <button
                    className="rounded-full border border-[#f3b8b0] px-4 py-2 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(pendingAction)}
                    onClick={async () => {
                      await mutateWithdrawal(selectedWithdrawal.id, "reject");
                      setSelectedWithdrawal(null);
                    }}
                    type="button"
                  >
                    {pendingAction === "reject" ? "Rejecting..." : "Reject"}
                  </button>
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-800)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(pendingAction)}
                    onClick={async () => {
                      await mutateWithdrawal(selectedWithdrawal.id, "approve");
                      setSelectedWithdrawal(null);
                    }}
                    type="button"
                  >
                    {pendingAction === "approve" ? "Accepting..." : "Accept"}
                  </button>
                </>
              ) : null}
              {selectedWithdrawal.status === "APPROVED" ? (
                <button
                  className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-800)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={Boolean(pendingAction)}
                  onClick={async () => {
                    await mutateWithdrawal(selectedWithdrawal.id, "disburse");
                    setSelectedWithdrawal(null);
                  }}
                  type="button"
                >
                  {pendingAction === "disburse" ? "Disbursing..." : "Mark as disbursed"}
                </button>
              ) : null}
            </>
          }
          onClose={() => setSelectedWithdrawal(null)}
        />
      ) : null}
    </div>
  );
}
