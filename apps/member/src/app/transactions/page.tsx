"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@heroui/react";
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
  const { data, loading } = useMemberData<TransactionsPayload>(
    "/wallet/transactions?limit=50",
    fallback,
  );

  const filteredItems = useMemo(() => {
    if (filter === "ALL") return data.items;

    return data.items.filter((item) => {
      const type = item.type.toUpperCase();
      if (filter === "WALLET") return type.includes("WALLET");
      if (filter === "SAVINGS") return type.includes("SAVING");
      if (filter === "LOAN") return type.includes("LOAN");
      if (filter === "PAYMENT")
        return type.includes("PAYMENT") || type.includes("FUNDING");
      return true;
    });
  }, [data.items, filter]);

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
                    key={txn.id}
                    type={txn.type}
                    title={txn.description || undefined}
                    subtitle={
                      txn.reference || txn.source || "Member transaction"
                    }
                    amount={txn.amount}
                    status={txn.status}
                    timestamp={txn.createdAt}
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
    </div>
  );
}
