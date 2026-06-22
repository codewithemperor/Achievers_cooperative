"use client";

import { useMemo, useState, type ReactNode } from "react";
import { parseDate } from "@internationalized/date";
import { useForm, useWatch } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/form-input";
import type { DateRange } from "@/components/ui/form-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { TransactionReceiptModal } from "@/components/admin/transaction-receipt-modal";
import { useApi } from "@/hooks/useApi";
import { Clock3, PiggyBank, Receipt, Wallet } from "lucide-react";
import api from "@/lib/api";
import { getCurrentMonthRange, isWithinDateRange } from "@/lib/date-range";
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
    reference?: string | null;
    type?: string;
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
    rejectionReason?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    createdAt: string;
    member: {
      id: string;
      fullName: string;
      membershipNumber: string;
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
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "DISBURSED") return "success";
  return "warning";
}

export default function SavingsPage() {
  const [tab, setTab] = useState<"transactions" | "withdrawals">(
    "transactions",
  );
  const summary = useApi<SavingsSummary>("/reports/summary");
  const transactions =
    useApi<SavingsTransactionsResponse>("/savings/transactions");
  const withdrawals =
    useApi<SavingsWithdrawalsResponse>("/savings/withdrawals");
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
  const [selectedReceipt, setSelectedReceipt] = useState<{
    title: string;
    amount: number;
    date?: string | null;
    status: string;
    reference?: string | null;
    fields: Array<{ label: string; value?: string | number | null }>;
    timeline?: Array<{ label: string; date?: string | null; status?: string }>;
    actions?: ReactNode;
  } | null>(null);
  const [confirmingWithdrawal, setConfirmingWithdrawal] = useState<{
    id: string;
    action: "approve" | "reject";
    amount: number;
    memberName: string;
  } | null>(null);
  const [isMutatingWithdrawal, setIsMutatingWithdrawal] = useState(false);
  const transactionRows = transactions.data?.items ?? [];
  const withdrawalRows = withdrawals.data?.items ?? [];
  const pendingWithdrawals = withdrawalRows.filter((item) => item.status === "PENDING");
  const processedWithdrawals = withdrawalRows.filter((item) => item.status !== "PENDING");
  const savingsTransactionRows = [
    ...transactionRows.map((item) => ({
      ...item,
      source: "SAVINGS" as const,
      member: item.wallet.member,
      description: item.description || "Savings contribution",
      transactionType: "Savings",
    })),
    ...processedWithdrawals.map((item) => ({
      ...item,
      source: "SAVINGS_WITHDRAWAL" as const,
      member: item.member,
      description:
        item.status === "REJECTED"
          ? item.rejectionReason || "Savings withdrawal rejected"
          : `Savings withdrawal to ${item.bankName} - ${item.accountNumber}`,
      transactionType: "Withdrawal",
    })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const visibleSavingsTransactionRows = savingsTransactionRows.filter((item) =>
    isWithinDateRange(item.createdAt, startDate, endDate),
  );
  const dateRangeToolbar = (
    <DateRangePicker
      className="w-full"
      control={filtersControl}
      label=""
      name="transactionDateRange"
    />
  );
  const pendingWithdrawalAmount = pendingWithdrawals.reduce(
    (sum, item) => sum + Number(item.amount ?? 0),
    0,
  );

  async function mutateSavingsWithdrawal(
    id: string,
    action: "approve" | "reject",
  ) {
    try {
      await api.patch(`/savings/withdrawals/${id}/${action}`, {});
      showSuccessToast(
        `Withdrawal request ${action === "approve" ? "approved" : "rejected"} successfully.`,
      );
      await Promise.all([
        withdrawals.refetch(),
        transactions.refetch(),
        summary.refetch(),
      ]);
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message ||
          `Unable to ${action} withdrawal request.`,
      );
      throw error;
    }
  }

  function openWithdrawalReceipt(
    item: SavingsWithdrawalsResponse["items"][number],
  ) {
    setSelectedReceipt({
      title: "Savings Withdrawal Request",
      amount: item.amount,
      date: item.createdAt,
      status: item.status,
      reference: `SAVINGS-WD-${item.id.slice(0, 8)}`,
      fields: [
        { label: "Member", value: item.member.fullName },
        { label: "Membership No.", value: item.member.membershipNumber },
        { label: "Bank", value: item.bankName },
        { label: "Account Name", value: item.accountName },
        { label: "Account Number", value: item.accountNumber },
      ],
      timeline: [
        { label: "Requested", date: item.createdAt, status: "PENDING" },
        ...(item.approvedAt
          ? [
              {
                label: "Approved",
                date: item.approvedAt,
                status: "APPROVED",
              },
            ]
          : []),
        ...(item.rejectedAt
          ? [
              {
                label: "Rejected",
                date: item.rejectedAt,
                status: "REJECTED",
              },
            ]
          : []),
      ],
      actions:
        item.status === "PENDING" ? (
          <>
            <button
              className="rounded-full border border-[#f3b8b0] px-4 py-2 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff4f2]"
              onClick={() => {
                setConfirmingWithdrawal({
                  id: item.id,
                  action: "reject",
                  amount: item.amount,
                  memberName: item.member.fullName,
                });
              }}
              type="button"
            >
              Reject
            </button>
            <button
              className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-800)]"
              onClick={() => {
                setConfirmingWithdrawal({
                  id: item.id,
                  action: "approve",
                  amount: item.amount,
                  memberName: item.member.fullName,
                });
              }}
              type="button"
            >
              Accept
            </button>
          </>
        ) : null,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings"
        subtitle="Review savings-only transactions and manage member withdrawal requests."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Total balance in member savings."
          href="/admin/savings"
          icon={<PiggyBank className="h-5 w-5" />}
          title="Total Savings"
          value={currency.format(summary.data?.savings?.totalBalance ?? 0)}
          tone="green"
        />
        <DashboardMetricCard
          description="Savings contributions and related entries."
          href="/admin/savings"
          icon={<Receipt className="h-5 w-5" />}
          title="Savings Transactions"
          value={transactionRows.length}
        />
        <DashboardMetricCard
          description="Withdrawal requests waiting for review."
          href="/admin/savings"
          icon={<Clock3 className="h-5 w-5" />}
          title="Withdrawal Requests"
          tone={pendingWithdrawals.length ? "amber" : "neutral"}
          value={pendingWithdrawals.length}
        />
        <DashboardMetricCard
          description="Total savings withdrawals awaiting review."
          href="/admin/savings"
          icon={<Wallet className="h-5 w-5" />}
          title="Pending Withdrawal Amount"
          value={currency.format(pendingWithdrawalAmount)}
        />
      </div>

      <AdminTabs
        items={[
          { id: "transactions", label: "Transactions" },
          { id: "withdrawals", label: "Withdrawal Requests" },
        ]}
        meta={`${pendingWithdrawals.length} pending request(s)`}
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
              key: "type",
              header: "Type",
              render: (item) => item.transactionType,
              sortValue: (item) => item.transactionType,
            },
            {
              key: "description",
              header: "Description",
              render: (item) => item.description,
            },
            {
              key: "amount",
              header: "Amount",
              render: (item) => currency.format(item.amount),
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
            },
            {
              key: "date",
              header: "Created",
              render: (item) =>
                new Date(item.createdAt).toLocaleDateString("en-NG"),
            },
          ]}
          data={visibleSavingsTransactionRows}
          emptyDescription={
            transactions.error || "No savings transactions available yet."
          }
          loading={transactions.loading || withdrawals.loading}
          toolbar={dateRangeToolbar}
          onRowClick={(item) =>
            setSelectedReceipt({
              title:
                item.source === "SAVINGS"
                  ? "Savings Contribution"
                  : "Savings Withdrawal",
              amount: item.amount,
              date: item.createdAt,
              status: item.status,
              reference:
                item.source === "SAVINGS"
                  ? item.reference
                  : `SAVINGS-WD-${item.id.slice(0, 8)}`,
              fields: [
                ["Member", item.member.fullName],
                ["Membership No.", item.member.membershipNumber],
                ["Type", item.transactionType],
                ["Description", item.description],
                [
                  "Bank",
                  item.source === "SAVINGS_WITHDRAWAL" ? item.bankName : "-",
                ],
                [
                  "Account Name",
                  item.source === "SAVINGS_WITHDRAWAL" ? item.accountName : "-",
                ],
                [
                  "Account Number",
                  item.source === "SAVINGS_WITHDRAWAL"
                    ? item.accountNumber
                    : "-",
                ],
              ].map(([label, value]) => ({ label, value })),
              timeline:
                item.source === "SAVINGS_WITHDRAWAL"
                  ? [
                      {
                        label: "Requested",
                        date: item.createdAt,
                        status: "PENDING",
                      },
                      {
                        label:
                          item.status === "REJECTED" ? "Rejected" : "Approved",
                        date:
                          item.status === "REJECTED"
                            ? item.rejectedAt
                            : item.approvedAt,
                        status: item.status,
                      },
                    ]
                  : [
                      {
                        label: "Savings posted",
                        date: item.createdAt,
                        status: item.status,
                      },
                    ],
            })
          }
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
                    {item.accountName} - {item.accountNumber}
                  </p>
                </div>
              ),
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
            },
            {
              key: "createdAt",
              header: "Requested",
              render: (item) =>
                new Date(item.createdAt).toLocaleDateString("en-NG"),
              sortValue: (item) => new Date(item.createdAt),
            },
            {
              key: "action",
              header: "Action",
              align: "right",
              isAction: true,
              render: (item) => (
                <button
                  className="rounded-full border border-primary-900/12 bg-white px-4 py-2 text-sm font-semibold text-text-800 transition hover:bg-background-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    openWithdrawalReceipt(item);
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
            withdrawals.error || "No withdrawal requests available yet."
          }
          loading={withdrawals.loading}
          onRowClick={openWithdrawalReceipt}
        />
      )}
      {selectedReceipt ? (
        <TransactionReceiptModal
          {...selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      ) : null}
      <ConfirmModal
        confirmLabel={isMutatingWithdrawal ? "Processing..." : "Confirm"}
        isOpen={Boolean(confirmingWithdrawal)}
        message={
          confirmingWithdrawal?.action === "approve"
            ? `Approve this savings withdrawal of ${currency.format(confirmingWithdrawal.amount)} for ${confirmingWithdrawal.memberName}? The amount will be deducted from the member's savings balance.`
            : `Reject this savings withdrawal of ${currency.format(confirmingWithdrawal?.amount ?? 0)} for ${confirmingWithdrawal?.memberName ?? "this member"}?`
        }
        onCancel={() => {
          if (!isMutatingWithdrawal) setConfirmingWithdrawal(null);
        }}
        onConfirm={async () => {
          if (!confirmingWithdrawal || isMutatingWithdrawal) return;
          setIsMutatingWithdrawal(true);
          try {
            await mutateSavingsWithdrawal(
              confirmingWithdrawal.id,
              confirmingWithdrawal.action,
            );
            setConfirmingWithdrawal(null);
            setSelectedReceipt(null);
          } finally {
            setIsMutatingWithdrawal(false);
          }
        }}
        title={
          confirmingWithdrawal?.action === "approve"
            ? "Approve savings withdrawal?"
            : "Reject savings withdrawal?"
        }
      />
    </div>
  );
}
