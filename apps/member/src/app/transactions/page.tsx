"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@heroui/react";
import { useForm, useWatch } from "react-hook-form";
import { parseDate } from "@internationalized/date";
import { TransactionCard } from "@/components/transaction-card";
import { DateRangePicker } from "@/components/form-input";
import type { DateRange } from "@/components/form-input";
import {
  TransactionDetailModal,
  type TransactionDetailItem,
} from "@/components/transaction-detail-modal";
import { useMemberData } from "@/hooks/use-member-data";

interface TransactionsPayload {
  items: Array<TransactionDetailItem & {
    id: string;
    source: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    description?: string | null;
    createdAt: string;
  }>;
}

const fallback: TransactionsPayload = { items: [] };

interface TransactionFiltersForm {
  transactionDateRange: DateRange;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange() {
  const now = new Date();
  return {
    from: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function toIsoBoundary(value: string, position: "start" | "end") {
  return new Date(
    `${value}T${position === "start" ? "00:00:00.000" : "23:59:59.999"}`,
  ).toISOString();
}

const filters = [
  { key: "ALL", label: "All" },
  { key: "WALLET", label: "Wallet" },
  { key: "SAVINGS", label: "Savings" },
  { key: "LOANS", label: "Loans" },
  { key: "PACKAGE", label: "Package" },
  { key: "INVESTMENT", label: "Investment" },
];

export default function TransactionsPage() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionDetailItem | null>(null);
  const currentMonthRange = useMemo(() => getCurrentMonthRange(), []);
  const { control } = useForm<TransactionFiltersForm>({
    defaultValues: {
      transactionDateRange: {
        start: parseDate(currentMonthRange.from),
        end: parseDate(currentMonthRange.to),
      },
    },
  });
  const selectedDateRange = useWatch({
    control,
    name: "transactionDateRange",
  });
  const startDate = selectedDateRange?.start?.toString() ?? currentMonthRange.from;
  const endDate = selectedDateRange?.end?.toString() ?? currentMonthRange.to;
  const transactionsPath = `/wallet/transactions?type=ALL&limit=100&from=${encodeURIComponent(toIsoBoundary(startDate, "start"))}&to=${encodeURIComponent(toIsoBoundary(endDate, "end"))}`;
  const { data, loading } = useMemberData<TransactionsPayload>(
    transactionsPath,
    fallback,
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return data.items.filter((item) => {
      const type = item.type.toUpperCase();
      const categoryMatches =
        filter === "ALL" ||
        (filter === "WALLET" &&
          (type.includes("WALLET") ||
            type.includes("FUNDING") ||
            type.includes("MEMBERSHIP_CHARGE"))) ||
        (filter === "SAVINGS" && type.includes("SAVING")) ||
        (filter === "LOANS" && type.includes("LOAN")) ||
        (filter === "PACKAGE" && type.includes("PACKAGE")) ||
        (filter === "INVESTMENT" && type.includes("INVEST"));

      if (!categoryMatches) return false;
      if (!normalizedSearch) return true;

      return [
        item.type,
        item.status,
        item.source,
        item.reference,
        item.description,
        item.amount?.toString(),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [data.items, filter, search]);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-[1.8rem] font-semibold tracking-tight text-text-900 dark:text-text-50">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-text-400">
          Review every wallet posting, repayment, and contribution in one place.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-400">
            Search transactions
          </span>
          <input
            className="min-h-12 rounded-2xl border border-background-200 bg-background-50 px-4 text-sm text-text-900 outline-none transition-colors focus:border-primary-400 dark:border-background-700 dark:bg-background-900 dark:text-text-50"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by reference, status, type, or note"
            type="search"
            value={search}
          />
        </label>
        <DateRangePicker
          className="bg-background-50 dark:bg-background-900 md:min-w-[20rem]"
          control={control}
          label=""
          name="transactionDateRange"
        />
      </section>

      <Tabs
        className="w-full"
        variant="secondary"
        selectedKey={filter}
        onSelectionChange={(key) => setFilter(String(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Transaction categories">
            {filters.map((item) => (
              <Tabs.Tab key={item.key} id={item.key}>
                <Tabs.Separator />
                {item.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {filters.map((item) => (
          <Tabs.Panel
            key={item.key}
            id={item.key}
            className="pt-4 outline-none"
          >
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-[20px] bg-background-100 dark:bg-white/8"
                  />
                ))
              ) : filteredItems.length ? (
                filteredItems.map((txn) => (
                  <TransactionCard
                    key={`${txn.source}-${txn.id}`}
                    type={txn.type}
                    title={txn.description || undefined}
                    subtitle={
                      txn.reference || txn.source || "Member transaction"
                    }
                    amount={txn.amount}
                    status={txn.status}
                    timestamp={txn.createdAt}
                    onClick={() => setSelectedTransaction(txn)}
                  />
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-background-300 dark:border-white/10 px-5 py-10 text-center text-sm text-text-400">
                  No transactions match this category yet.
                </div>
              )}
            </div>
          </Tabs.Panel>
        ))}
      </Tabs>
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}
