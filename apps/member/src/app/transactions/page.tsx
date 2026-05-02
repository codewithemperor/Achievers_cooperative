"use client";

import { useMemo, useState } from "react";
import { Tab, TabList, TabPanel, Tabs } from "@heroui/react";
import { TransactionCard } from "@/components/transaction-card";
import { useMemberData } from "@/hooks/use-member-data";

interface TransactionsPayload {
  items: Array<{
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

const filters = [
  { key: "ALL", label: "All" },
  { key: "WALLET", label: "Wallet" },
  { key: "SAVINGS", label: "Savings" },
  { key: "LOAN", label: "Loans" },
  { key: "PAYMENT", label: "Payments" },
];

export default function TransactionsPage() {
  const [filter, setFilter] = useState("ALL");
  const { data, loading } = useMemberData<TransactionsPayload>("/wallet/transactions?limit=50", fallback);

  const filteredItems = useMemo(() => {
    if (filter === "ALL") return data.items;

    return data.items.filter((item) => {
      const type = item.type.toUpperCase();
      if (filter === "WALLET") return type.includes("WALLET");
      if (filter === "SAVINGS") return type.includes("SAVING");
      if (filter === "LOAN") return type.includes("LOAN");
      if (filter === "PAYMENT") return type.includes("PAYMENT") || type.includes("FUNDING");
      return true;
    });
  }, [data.items, filter]);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-[1.8rem] font-semibold tracking-tight text-[var(--text-900)] dark:text-[var(--text-50)]">Transactions</h1>
        <p className="mt-1 text-sm text-[var(--text-400)]">Review every wallet posting, repayment, and contribution in one flow.</p>
      </section>

      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <Tabs
          aria-label="Transaction categories"
          selectedKey={filter}
          onSelectionChange={(key) => setFilter(String(key))}
          className="w-full"
        >
          <TabList className="hide-scrollbar flex overflow-x-auto gap-2 rounded-2xl bg-[var(--background-100)] p-1 dark:bg-white/8">
            {filters.map((item) => (
              <Tab
                key={item.key}
                id={item.key}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium outline-none transition ${
                  filter === item.key
                    ? "border-[var(--primary-600)] bg-[var(--primary-600)] text-white shadow-sm"
                    : "border-transparent text-[var(--text-600)] dark:text-[var(--text-300)]"
                }`}
              >
                {item.label}
              </Tab>
            ))}
          </TabList>

          {filters.map((item) => (
            <TabPanel key={item.key} id={item.key} className="px-0 pt-4 outline-none">
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-[24px] bg-[var(--background-100)] dark:bg-white/8" />
                  ))
                ) : filteredItems.length ? (
                  filteredItems.map((item) => (
                    <TransactionCard
                      key={item.id}
                      type={item.type}
                      title={item.description || undefined}
                      subtitle={item.reference || item.source || "Member transaction"}
                      amount={item.amount}
                      status={item.status}
                      timestamp={item.createdAt}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
                    No transactions match this category yet.
                  </div>
                )}
              </div>
            </TabPanel>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
