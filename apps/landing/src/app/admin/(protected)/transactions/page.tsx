"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CreditCard,
  Lock,
  Pencil,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@heroui/react";
import { useForm } from "react-hook-form";
import { AdminModal } from "@/components/ui/admin-modal";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import {
  NumberInput,
  TextInput,
  TextareaInput,
} from "@/components/ui/form-input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DashboardMetricCard,
  DashboardPanel,
} from "@/components/admin/dashboard-card";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface MemberTransactionsResponse {
  total?: number;
  summary?: {
    total: number;
    pending: number;
    approvedCredits: number;
    approvedDebits: number;
  };
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    category?: string | null;
    description?: string | null;
    editable: boolean;
    lockReason?: string | null;
    createdAt: string;
    wallet: {
      member: {
        fullName: string;
        membershipNumber: string;
      };
    };
  }>;
}

interface TreasurySummary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  memberWalletHoldings: number;
  combinedHoldings: number;
}

interface TreasuryEntriesResponse {
  items: Array<{
    id: string;
    type: "INCOME" | "EXPENSE";
    amount: number;
    category: string;
    description: string;
    reference?: string | null;
    createdAt: string;
  }>;
}

interface TreasuryEntryValues {
  type: "INCOME" | "EXPENSE";
  amount: number | undefined;
  category: string;
  description: string;
  reference: string;
}

interface EditTransactionValues {
  amount: number | undefined;
  category: string;
  description: string;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function variantForStatus(status: string) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isCreditTransaction(type: string) {
  return ["FUNDING", "CREDIT", "REFUND", "INVESTMENT_MATURITY"].some((key) =>
    type.toUpperCase().includes(key),
  );
}

function TransactionEditForm({
  item,
  onSubmit,
  onSuccess,
}: {
  item: MemberTransactionsResponse["items"][number];
  onSubmit: (values: EditTransactionValues) => Promise<void>;
  onSuccess?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<EditTransactionValues>({
    defaultValues: {
      amount: item.amount,
      category: item.category || "",
      description: item.description || "",
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await onSubmit(values);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <div className="grid gap-4">
        <NumberInput
          className="rounded-2xl"
          control={control}
          label="Amount"
          name="amount"
          min={0}
        />
        <TextInput
          className="rounded-2xl"
          control={control}
          label="Category"
          name="category"
          placeholder="Manual adjustment"
        />
        <TextareaInput
          className="rounded-2xl"
          control={control}
          label="Description"
          name="description"
          placeholder="Why this transaction is being edited"
          rows={4}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <button
          className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
          disabled={submitting}
          onClick={() => void submit()}
          type="button"
        >
          {submitting ? "Saving..." : "Save changes"}
        </button>
      </div>
    </>
  );
}

export default function TransactionsPage() {
  const [tab, setTab] = useState<"member" | "treasury">("treasury");
  const [selectedTransaction, setSelectedTransaction] = useState<
    MemberTransactionsResponse["items"][number] | null
  >(null);
  const memberTransactions =
    useApi<MemberTransactionsResponse>("/transactions");
  const wallet = useApi<TreasurySummary>("/wallet/cooperative");
  const treasuryEntries = useApi<TreasuryEntriesResponse>(
    "/wallet/cooperative/entries",
  );
  const [creatingEntry, setCreatingEntry] = useState(false);
  const { control, handleSubmit, reset, setValue, watch } =
    useForm<TreasuryEntryValues>({
      defaultValues: {
        type: "INCOME",
        amount: undefined,
        category: "",
        description: "",
        reference: "",
      },
    });

  const treasuryRows = useMemo(
    () => treasuryEntries.data?.items ?? [],
    [treasuryEntries.data],
  );
  const transactionRows = useMemo(
    () => memberTransactions.data?.items ?? [],
    [memberTransactions.data],
  );

  const memberSummary = useMemo(() => {
    if (memberTransactions.data?.summary) {
      return {
        total: memberTransactions.data.summary.total,
        pending: memberTransactions.data.summary.pending,
        totalCredits: memberTransactions.data.summary.approvedCredits,
        totalDebits: memberTransactions.data.summary.approvedDebits,
      };
    }

    const approvedRows = transactionRows.filter(
      (item) => item.status === "APPROVED",
    );
    const totalCredits = approvedRows
      .filter((item) => isCreditTransaction(item.type))
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalDebits = approvedRows
      .filter((item) => !isCreditTransaction(item.type))
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

    return {
      total: transactionRows.length,
      pending: transactionRows.filter((item) => item.status === "PENDING")
        .length,
      totalCredits,
      totalDebits,
    };
  }, [memberTransactions.data?.summary, transactionRows]);

  async function updateTransaction(id: string, values: EditTransactionValues) {
    try {
      await api.patch(`/transactions/${id}`, values);
      showSuccessToast("Transaction updated successfully.");
      await memberTransactions.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to update transaction.",
      );
      throw error;
    }
  }

  const createTreasuryEntry = (close?: () => void) =>
    handleSubmit(async (values) => {
      try {
        setCreatingEntry(true);
        await api.post("/wallet/cooperative/entries", {
          type: values.type,
          amount: Number(values.amount),
          category: values.category,
          description: values.description,
          reference: values.reference || undefined,
        });
        showSuccessToast("Treasury entry added successfully.");
        reset();
        await Promise.all([wallet.refetch(), treasuryEntries.refetch()]);
        close?.();
      } catch (error: any) {
        showErrorToast(
          error?.response?.data?.message || "Unable to add treasury entry.",
        );
      } finally {
        setCreatingEntry(false);
      }
    });

  const summaryCards =
    tab === "member" ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Member wallet transactions currently loaded."
          href="/admin/transactions"
          icon={<CreditCard className="h-5 w-5" />}
          title="Member Transactions"
          tone="green"
          value={memberSummary.total}
        />
        <DashboardMetricCard
          description="Transactions still waiting for settlement or review."
          href="/admin/transactions"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Pending"
          tone={memberSummary.pending ? "amber" : "neutral"}
          value={memberSummary.pending}
        />
        <DashboardMetricCard
          description="Approved wallet credits in the current result set."
          href="/admin/transactions"
          icon={<TrendingUp className="h-5 w-5" />}
          title="Approved Credits"
          value={currency.format(memberSummary.totalCredits)}
        />
        <DashboardMetricCard
          description="Approved wallet debits in the current result set."
          href="/admin/transactions"
          icon={<TrendingDown className="h-5 w-5" />}
          title="Approved Debits"
          value={currency.format(memberSummary.totalDebits)}
        />
      </div>
    ) : (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {wallet.loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-[2rem]" />
        ))
      ) : (
        <>
          <DashboardMetricCard
            description="Current cooperative treasury wallet balance."
            href="/admin/transactions"
            icon={<CreditCard className="h-5 w-5" />}
            title="Treasury Cash"
            tone="green"
            value={currency.format(wallet.data?.balance ?? 0)}
          />
          <DashboardMetricCard
            description="Total balances held inside member wallets."
            href="/admin/transactions"
            icon={<CreditCard className="h-5 w-5" />}
            title="Member Wallet Holdings"
            value={currency.format(wallet.data?.memberWalletHoldings ?? 0)}
          />
          <DashboardMetricCard
            description="Treasury cash plus member wallet holdings."
            href="/admin/transactions"
            icon={<TrendingUp className="h-5 w-5" />}
            title="Money At Hand"
            value={currency.format(wallet.data?.combinedHoldings ?? 0)}
          />
          <DashboardMetricCard
            description="Total treasury income minus total treasury expense."
            href="/admin/transactions"
            icon={<TrendingDown className="h-5 w-5" />}
            title="Net Treasury Flow"
            tone={
              (wallet.data?.totalIncome ?? 0) -
                (wallet.data?.totalExpense ?? 0) <
              0
                ? "red"
                : "neutral"
            }
            value={currency.format(
              (wallet.data?.totalIncome ?? 0) -
                (wallet.data?.totalExpense ?? 0),
            )}
          />
        </>
      )}
    </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Review member wallet activity, auto-generated deductions, and treasury entries in one admin workspace."
        actions={
          <AdminModal
            description="Create a treasury income or expense entry and watch the summary cards update immediately."
            title="Add Treasury Entry"
            trigger={
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white"
                type="button"
              >
                Add transaction
              </button>
            }
          >
            {({ close }) => (
              <>
                <div className="grid gap-4">
                  <select
                    className="min-h-12 rounded-2xl border border-[var(--primary-900)/12] bg-white px-4 text-sm text-text-900 outline-none"
                    onChange={(event) =>
                      setValue(
                        "type",
                        event.target.value as "INCOME" | "EXPENSE",
                      )
                    }
                    value={watch("type")}
                  >
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Amount"
                    name={"amount" as never}
                    min={0}
                  />
                  <TextInput
                    className="rounded-2xl"
                    control={control}
                    label="Category"
                    name={"category" as never}
                    placeholder="Operations"
                  />
                  <TextareaInput
                    className="rounded-2xl"
                    control={control}
                    label="Description"
                    name={"description" as never}
                    placeholder="Describe this entry"
                    rows={4}
                  />
                  <TextInput
                    className="rounded-2xl"
                    control={control}
                    label="Reference"
                    name={"reference" as never}
                    placeholder="Optional reference"
                  />
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                    disabled={creatingEntry}
                    onClick={() => void createTreasuryEntry(close)()}
                    type="button"
                  >
                    {creatingEntry ? "Saving..." : "Create entry"}
                  </button>
                </div>
              </>
            )}
          </AdminModal>
        }
      />

      <AdminTabs
        items={[
          { id: "treasury", label: "Treasury Ledger" },
          { id: "member", label: "Member Transactions" },
        ]}
        onChange={setTab}
        value={tab}
      />

      {summaryCards}

      <DashboardPanel
        title={tab === "treasury" ? "How Treasury Stats Are Calculated" : "How Member Transaction Stats Are Calculated"}
        subtitle={
          tab === "treasury"
            ? "These cards come from the cooperative wallet summary endpoint, not from the visible ledger rows alone."
            : "These cards come from the transaction API summary for the currently requested result set."
        }
      >
        {tab === "treasury" ? (
          <div className="grid gap-3 text-sm text-text-500 dark:text-text-300 md:grid-cols-2">
            <p>
              <span className="font-semibold text-text-900 dark:text-text-50">
                Treasury Cash:
              </span>{" "}
              the cooperative wallet balance stored on the backend.
            </p>
            <p>
              <span className="font-semibold text-text-900 dark:text-text-50">
                Member Wallet Holdings:
              </span>{" "}
              the sum of all member wallet available and pending balances.
            </p>
            <p>
              <span className="font-semibold text-text-900 dark:text-text-50">
                Money At Hand:
              </span>{" "}
              treasury cash plus member wallet holdings.
            </p>
            <p>
              <span className="font-semibold text-text-900 dark:text-text-50">
                Net Treasury Flow:
              </span>{" "}
              total treasury income minus total treasury expense.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 text-sm text-text-500 dark:text-text-300 md:grid-cols-2">
            <p>
              <span className="font-semibold text-text-900 dark:text-text-50">
                Member Transactions:
              </span>{" "}
              total transaction records returned by the API summary.
            </p>
            <p>
              <span className="font-semibold text-text-900 dark:text-text-50">
                Pending:
              </span>{" "}
              transactions still waiting for approval, settlement, or review.
            </p>
            <p>
              <span className="font-semibold text-text-900 dark:text-text-50">
                Approved Credits:
              </span>{" "}
              approved funding, credit, refund, and maturity transactions.
            </p>
            <p>
              <span className="font-semibold text-text-900 dark:text-text-50">
                Approved Debits:
              </span>{" "}
              approved deductions, withdrawals, and other debit transactions.
            </p>
          </div>
        )}
      </DashboardPanel>

      {tab === "member" ? (
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
              key: "type",
              header: "Type",
              render: (item) => (
                <div>
                  <p className="font-semibold text-text-900">
                    {item.type.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-text-400">
                    {item.category || "No category"}
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
              key: "createdAt",
              header: "Date",
              render: (item) => formatDateTime(item.createdAt),
              sortValue: (item) => new Date(item.createdAt),
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
              key: "edit",
              header: "Actions",
              align: "right",
              isAction: true,
              render: (item) =>
                item.editable ? (
                  <div onClick={(event) => event.stopPropagation()}>
                    <AdminModal
                      description="Only manual/admin-created transactions can be edited. Changes are written to the audit trail."
                      title="Edit Transaction"
                      trigger={
                        <button
                          className="inline-flex items-center gap-2 font-semibold text-[var(--primary-700)]"
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      }
                    >
                      {({ close }) => (
                        <TransactionEditForm
                          item={item}
                          onSubmit={(values) =>
                            updateTransaction(item.id, values)
                          }
                          onSuccess={close}
                        />
                      )}
                    </AdminModal>
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-2 text-sm text-text-400"
                    title={
                      item.lockReason || "This transaction cannot be edited."
                    }
                  >
                    <Lock className="h-4 w-4" />
                    Locked
                  </div>
                ),
            },
          ]}
          data={memberTransactions.data?.items ?? []}
          emptyDescription={
            memberTransactions.error || "No member transactions found."
          }
          loading={memberTransactions.loading}
          onRowClick={(item) => setSelectedTransaction(item)}
          searchableText={(item) =>
            `${item.wallet.member.fullName} ${item.wallet.member.membershipNumber} ${item.type} ${item.status} ${item.reference ?? ""} ${item.createdAt}`
          }
          searchPlaceholder="Search member transactions..."
        />
      ) : (
        <>
          <DataTable
            columns={[
              {
                key: "type",
                header: "Type",
                render: (item) => (
                  <span
                    className={
                      item.type === "INCOME"
                        ? "font-semibold text-[var(--primary-700)]"
                        : "font-semibold text-[#b42318]"
                    }
                  >
                    {item.type}
                  </span>
                ),
              },
              {
                key: "category",
                header: "Name",
                render: (item) => (
                  <span className="font-semibold text-text-900">
                    {item.category}
                  </span>
                ),
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
                key: "createdAt",
                header: "Created At",
                render: (item) =>
                  new Date(item.createdAt).toLocaleDateString("en-NG"),
              },
            ]}
            data={treasuryRows}
            emptyDescription={
              treasuryEntries.error || "No treasury transactions found."
            }
            loading={treasuryEntries.loading}
          />
        </>
      )}
      {selectedTransaction ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4 backdrop-blur-sm">
          <button
            aria-label="Close transaction details"
            className="absolute inset-0"
            onClick={() => setSelectedTransaction(null)}
            type="button"
          />
          <div
            aria-modal="true"
            className="relative z-[101] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-primary-900/8 bg-white shadow-[0_24px_60px_var(--primary-900)/12] dark:border-[var(--background-700)] dark:bg-[var(--background-900)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-primary-900/8 px-5 py-4 sm:px-6 dark:border-[var(--background-700)]">
              <div>
                <h2 className="text-2xl font-semibold text-text-900 dark:text-text-50">
                  Transaction Details
                </h2>
                <p className="mt-2 text-sm text-text-400">
                  {selectedTransaction.wallet.member.fullName} -{" "}
                  {formatDateTime(selectedTransaction.createdAt)}
                </p>
              </div>
              <button
                className="rounded-full border border-primary-900/12 px-3 py-1 text-sm text-text-900 dark:border-[var(--background-700)] dark:text-text-100"
                onClick={() => setSelectedTransaction(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 sm:px-6 sm:py-5">
              {[
                ["Member", selectedTransaction.wallet.member.fullName],
                [
                  "Membership No.",
                  selectedTransaction.wallet.member.membershipNumber,
                ],
                ["Type", selectedTransaction.type.replaceAll("_", " ")],
                ["Amount", currency.format(selectedTransaction.amount)],
                ["Status", selectedTransaction.status.replaceAll("_", " ")],
                ["Date", formatDateTime(selectedTransaction.createdAt)],
                ["Reference", selectedTransaction.reference || "-"],
                ["Category", selectedTransaction.category || "-"],
                ["Description", selectedTransaction.description || "-"],
                [
                  "Edit State",
                  selectedTransaction.editable
                    ? "Editable"
                    : selectedTransaction.lockReason || "Locked",
                ],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]"
                  key={label}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                    {label}
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-text-900 dark:text-text-50">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
