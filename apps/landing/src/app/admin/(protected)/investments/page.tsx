"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";

interface ProductsResponse {
  items?: Array<{
    id: string;
    name: string;
    annualRate: number;
    minimumAmount: number;
    durationMonths: number;
    status: string;
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function InvestmentsPage() {
  const products = useApi<ProductsResponse | Array<any>>("/investments/products");
  const rows = Array.isArray(products.data) ? products.data : products.data?.items ?? [];
  const [form, setForm] = useState({
    name: "",
    annualRate: "",
    minimumAmount: "",
    durationMonths: "",
  });

  async function createProduct() {
    await api.post("/investments/products", {
      name: form.name,
      annualRate: Number(form.annualRate),
      minimumAmount: Number(form.minimumAmount),
      durationMonths: Number(form.durationMonths),
    });
    setForm({ name: "", annualRate: "", minimumAmount: "", durationMonths: "" });
    await products.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        subtitle="Active investment products available for members, including rate, threshold, and term."
      />
      <section className="grid gap-3 rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6 md:grid-cols-5">
        <input className="rounded-full border px-4 py-3" placeholder="Product name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Rate %" value={form.annualRate} onChange={(event) => setForm((current) => ({ ...current, annualRate: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Minimum amount" value={form.minimumAmount} onChange={(event) => setForm((current) => ({ ...current, minimumAmount: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Duration months" value={form.durationMonths} onChange={(event) => setForm((current) => ({ ...current, durationMonths: event.target.value }))} />
        <button className="rounded-full bg-[var(--color-green)] px-4 py-3 font-semibold text-white" onClick={createProduct} type="button">
          Add product
        </button>
      </section>
      <DataTable
        columns={[
          {
            key: "name",
            header: "Product",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.name}</span>,
          },
          {
            key: "rate",
            header: "Annual Rate",
            render: (item) => `${item.annualRate}%`,
          },
          {
            key: "minimum",
            header: "Minimum",
            render: (item) => currency.format(item.minimumAmount),
          },
          {
            key: "duration",
            header: "Duration",
            render: (item) => `${item.durationMonths} months`,
          },
          {
            key: "status",
            header: "Status",
            render: (item) => <StatusBadge status={item.status} variant={item.status === "ACTIVE" ? "success" : "warning"} />,
          },
        ]}
        data={rows}
        emptyDescription={products.error || "No investment products found."}
      />
    </div>
  );
}
