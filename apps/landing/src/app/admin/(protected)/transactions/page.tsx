"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button, Skeleton } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "react-hook-form";
import { AdminModal } from "@/components/ui/admin-modal";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import {
  DatePickerInput,
  NumberInput,
  SelectInput,
  TextInput,
  TextareaInput,
} from "@/components/ui/form-input";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface TreasurySummary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
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

interface TransactionFormValues {
  type: string;
  category: string;
  description: string;
  amount: number | undefined;
  createdAt: ReturnType<typeof parseDate>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const typeOptions = [
  { id: "INCOME", label: "Income" },
  { id: "EXPENSE", label: "Expenses" },
];

function TreasuryForm({
  initialValues,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  initialValues?: TreasuryEntriesResponse["items"][number];
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<TransactionFormValues>({
    defaultValues: {
      type: initialValues?.type ?? "INCOME",
      category: initialValues?.category ?? "",
      description: initialValues?.description ?? "",
      amount: initialValues?.amount ?? undefined,
      createdAt: parseDate((initialValues?.createdAt ?? new Date().toISOString()).slice(0, 10)),
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <div className="grid gap-4 grid-cols-1">
        <SelectInput
          className="rounded-2xl"
          control={control}
          label="Type"
          name="type"
          options={typeOptions}
        />
        <DatePickerInput
          className="rounded-2xl"
          control={control}
          label="Date"
          name="createdAt"
        />
        <TextInput
          className="rounded-2xl "
          control={control}
          label="Transaction Name"
          name="category"
          placeholder="Loan disbursed, bank deposit, member payment"
        />
        <NumberInput
          className="rounded-2xl"
          control={control}
          label="Amount"
          name="amount"
          placeholder="Amount"
          min={0}
        />
        <TextareaInput
          className="rounded-2xl"
          control={control}
          label="Description"
          name="description"
          placeholder="Add a clear note about this bank movement"
          rows={4}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white"
          isDisabled={submitting}
          onPress={() => void submit()}
        >
          {submitting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </>
  );
}

export default function TransactionsPage() {
  const wallet = useApi<TreasurySummary>("/wallet/cooperative");
  const entries = useApi<TreasuryEntriesResponse>("/wallet/cooperative/entries");

  async function createEntry(values: TransactionFormValues) {
    try {
      await api.post("/wallet/cooperative/entries", {
        type: values.type,
        category: values.category,
        description: values.description,
        amount: Number(values.amount),
        createdAt: values.createdAt.toString(),
      });
      showSuccessToast("Treasury transaction added successfully.");
      await Promise.all([wallet.refetch(), entries.refetch()]);
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to add treasury transaction.");
      throw error;
    }
  }

  async function updateEntry(id: string, values: TransactionFormValues) {
    try {
      await api.patch(`/wallet/cooperative/entries/${id}`, {
        type: values.type,
        category: values.category,
        description: values.description,
        amount: Number(values.amount),
        createdAt: values.createdAt.toString(),
      });
      showSuccessToast("Treasury transaction updated successfully.");
      await Promise.all([wallet.refetch(), entries.refetch()]);
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to update treasury transaction.");
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Treasury inflow and outflow entries that reflect the cooperative's real bank position."
        actions={
          <AdminModal
            description="Record treasury inflow or outflow as a bank movement."
            title="Add Treasury Transaction"
            trigger={
              <button className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white" type="button">
                Add transaction
              </button>
            }
          >
            <TreasuryForm
              onSubmit={createEntry}
              pendingLabel="Saving..."
              submitLabel="Save transaction"
            />
          </AdminModal>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {wallet.loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-[2rem]" />)
        ) : (
          <>
            <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
              <p className="text-sm text-[var(--color-coop-muted)]">Current Balance</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-dark)]">{currency.format(wallet.data?.balance ?? 0)}</p>
            </div>
            <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
              <p className="text-sm text-[var(--color-coop-muted)]">Total Income</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-dark)]">{currency.format(wallet.data?.totalIncome ?? 0)}</p>
            </div>
            <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
              <p className="text-sm text-[var(--color-coop-muted)]">Total Expense</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-dark)]">{currency.format(wallet.data?.totalExpense ?? 0)}</p>
            </div>
          </>
        )}
      </div>

      <DataTable
        columns={[
          {
            key: "type",
            header: "Type",
            render: (item) => (
              <span className={item.type === "INCOME" ? "font-semibold text-[var(--color-green)]" : "font-semibold text-[#b42318]"}>
                {item.type}
              </span>
            ),
          },
          {
            key: "category",
            header: "Name",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.category}</span>,
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
            render: (item) => new Date(item.createdAt).toLocaleDateString("en-NG"),
          },
          {
            key: "actions",
            header: "Edit",
            render: (item) => (
              <AdminModal
                description="Update this treasury entry without changing the config of the rest of the ledger."
                title="Edit Treasury Transaction"
                trigger={
                  <button className="inline-flex items-center gap-2 font-semibold text-[var(--color-green)]" type="button">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                }
              >
                <TreasuryForm
                  initialValues={item}
                  onSubmit={(values) => updateEntry(item.id, values)}
                  pendingLabel="Updating..."
                  submitLabel="Update transaction"
                />
              </AdminModal>
            ),
          },
        ]}
        data={entries.data?.items ?? []}
        emptyDescription={entries.error || "No treasury transactions found."}
        loading={entries.loading}
      />
    </div>
  );
}
