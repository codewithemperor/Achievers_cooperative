"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";

interface WalletResponse {
  balance: number;
  totalIncome: number;
  totalExpense: number;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function CooperativeWalletPage() {
  const wallet = useApi<WalletResponse>("/wallet/cooperative");
  const [form, setForm] = useState({
    type: "EXPENSE",
    amount: "",
    category: "",
    description: "",
  });

  async function createEntry() {
    await api.post("/wallet/cooperative/entries", {
      type: form.type,
      amount: Number(form.amount),
      category: form.category,
      description: form.description,
    });
    setForm({ type: "EXPENSE", amount: "", category: "", description: "" });
    await wallet.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cooperative Wallet"
        subtitle="Track the organization-wide wallet position, income, and expenses."
      />
      <section className="grid gap-3 rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6 md:grid-cols-4">
        <input className="rounded-full border px-4 py-3" placeholder="INCOME or EXPENSE" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Amount" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        <button className="rounded-full bg-[var(--color-green)] px-4 py-3 font-semibold text-white md:col-span-4" onClick={createEntry} type="button">
          Add cooperative entry
        </button>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] bg-white p-6">
          <p className="text-sm text-[var(--color-coop-muted)]">Current Balance</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-dark)]">{currency.format(wallet.data?.balance ?? 0)}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-6">
          <p className="text-sm text-[var(--color-coop-muted)]">Total Income</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-dark)]">{currency.format(wallet.data?.totalIncome ?? 0)}</p>
        </div>
        <div className="rounded-[2rem] bg-white p-6">
          <p className="text-sm text-[var(--color-coop-muted)]">Total Expense</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-dark)]">{currency.format(wallet.data?.totalExpense ?? 0)}</p>
        </div>
      </div>
      {wallet.error ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {wallet.error}
        </div>
      ) : null}
    </div>
  );
}
