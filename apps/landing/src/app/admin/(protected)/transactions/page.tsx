"use client";

import { useMemo, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { Skeleton } from "@heroui/react";
import { useForm } from "react-hook-form";
import { AdminModal } from "@/components/ui/admin-modal";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import {
  NumberInput,
  TextInput,
  TextareaInput,
} from "@/components/ui/form-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface MemberTransactionsResponse {
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

  const summaryCards = (
    <div className="grid gap-4 md:grid-cols-4">
      {wallet.loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-[2rem]" />
        ))
      ) : (
        <>
          <div className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <p className="text-sm text-text-400">Treasury Cash</p>
            <p className="mt-2 text-3xl font-semibold text-text-900">
              {currency.format(wallet.data?.balance ?? 0)}
            </p>
          </div>
          <div className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <p className="text-sm text-text-400">Member Wallet Holdings</p>
            <p className="mt-2 text-3xl font-semibold text-text-900">
              {currency.format(wallet.data?.memberWalletHoldings ?? 0)}
            </p>
          </div>
          <div className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <p className="text-sm text-text-400">Money At Hand</p>
            <p className="mt-2 text-3xl font-semibold text-text-900">
              {currency.format(wallet.data?.combinedHoldings ?? 0)}
            </p>
          </div>
          <div className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <p className="text-sm text-text-400">Net Treasury Flow</p>
            <p className="mt-2 text-3xl font-semibold text-text-900">
              {currency.format(
                (wallet.data?.totalIncome ?? 0) -
                  (wallet.data?.totalExpense ?? 0),
              )}
            </p>
          </div>
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

      <div className="flex flex-wrap gap-2">
        <button
          className={
            tab === "member"
              ? "rounded-full bg-[var(--text-900)] px-4 py-2 text-sm font-semibold text-white"
              : "rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-text-900"
          }
          onClick={() => setTab("member")}
          type="button"
        >
          Member Transactions
        </button>
        <button
          className={
            tab === "treasury"
              ? "rounded-full bg-[var(--text-900)] px-4 py-2 text-sm font-semibold text-white"
              : "rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-text-900"
          }
          onClick={() => setTab("treasury")}
          type="button"
        >
          Treasury Ledger
        </button>
      </div>

      {summaryCards}

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
              header: "Edit",
              render: (item) =>
                item.editable ? (
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
    </div>
  );
}
