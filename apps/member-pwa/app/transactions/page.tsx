"use client";

import { useMemo, useState } from "react";
import { useMemberData } from "../lib/use-member-data";

interface TransactionsPayload {
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    createdAt: string;
  }>;
}

const fallback: TransactionsPayload = { items: [] };
const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function TransactionsPage() {
  const [filter, setFilter] = useState("ALL");
  const { data } = useMemberData<TransactionsPayload>("/wallet/transactions?limit=50", fallback);

  const filteredItems = useMemo(() => {
    if (filter === "ALL") return data.items;
    return data.items.filter((item) => item.type === filter);
  }, [data.items, filter]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-[var(--brand-ink)]">Transactions</h1>
        <p className="mt-1 text-sm text-[var(--brand-moss)]">Filter and review wallet activity from the NestJS transaction history.</p>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["ALL", "WALLET_FUNDING", "LOAN_REPAYMENT", "WEEKLY_COOPERATIVE", "MEMBERSHIP_FEE"].map((item) => (
          <button
            key={item}
            className={
              filter === item
                ? "rounded-full bg-[var(--brand-green)] px-4 py-2 text-xs font-semibold text-white"
                : "rounded-full border border-[var(--brand-stroke)] bg-white px-4 py-2 text-xs font-semibold text-[var(--brand-ink)]"
            }
            onClick={() => setFilter(item)}
            type="button"
          >
            {item === "ALL" ? "All" : item.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredItems.length ? (
          filteredItems.map((transaction) => (
            <div key={transaction.id} className="rounded-[1.5rem] border border-[var(--brand-stroke)] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[var(--brand-ink)]">{transaction.type.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-[var(--brand-moss)]">
                    {new Date(transaction.createdAt).toLocaleString("en-NG")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--brand-moss)]">{transaction.reference || "No reference"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--brand-ink)]">{money.format(transaction.amount)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">{transaction.status}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--brand-stroke)] bg-white p-6 text-sm text-[var(--brand-moss)]">
            No transactions match the selected filter yet.
          </div>
        )}
      </div>
    </div>
  );
}
