"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";

interface LoansResponse {
  items: Array<{
    id: string;
    amount: number;
    tenorMonths: number;
    purpose: string;
    status: string;
    member: { fullName: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function LoansPage() {
  const loans = useApi<LoansResponse>("/loans");
  const [form, setForm] = useState({ amount: "", tenorMonths: "", purpose: "" });

  async function createLoan() {
    await api.post("/loans", {
      amount: Number(form.amount),
      tenorMonths: Number(form.tenorMonths),
      purpose: form.purpose,
    });
    setForm({ amount: "", tenorMonths: "", purpose: "" });
    await loans.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        subtitle="Monitor applications, approvals, and disbursements with direct access to each loan record."
      />
      <section className="grid gap-3 rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6 md:grid-cols-4">
        <input className="rounded-full border px-4 py-3" placeholder="Amount" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Tenor months" value={form.tenorMonths} onChange={(event) => setForm((current) => ({ ...current, tenorMonths: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Purpose" value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} />
        <button className="rounded-full bg-[var(--color-green)] px-4 py-3 font-semibold text-white" onClick={createLoan} type="button">
          Create loan
        </button>
      </section>
      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.member.fullName}</span>,
          },
          {
            key: "amount",
            header: "Amount",
            render: (item) => currency.format(item.amount),
          },
          {
            key: "tenor",
            header: "Tenor",
            render: (item) => `${item.tenorMonths} months`,
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={item.status === "APPROVED" || item.status === "DISBURSED" ? "success" : item.status === "REJECTED" ? "danger" : "warning"}
              />
            ),
          },
          {
            key: "view",
            header: "View",
            render: (item) => (
              <Link className="font-semibold text-[var(--color-green)]" href={`/admin/loans/${item.id}`}>
                Loan detail
              </Link>
            ),
          },
        ]}
        data={loans.data?.items ?? []}
        emptyDescription={loans.error || "No loans are available yet."}
      />
    </div>
  );
}
