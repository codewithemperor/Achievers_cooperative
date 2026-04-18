"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";

interface PackagesResponse {
  items: Array<{
    id: string;
    name: string;
    totalAmount: number;
    durationMonths: number;
    penaltyType: string;
    isActive: boolean;
  }>;
}

interface PackageSubscriptionsResponse {
  items: Array<{
    id: string;
    status: string;
    amountPaid: number;
    amountRemaining: number;
    penaltyAccrued: number;
    member: { fullName: string; membershipNumber: string };
    package: { name: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function PackagesPage() {
  const packages = useApi<PackagesResponse>("/packages");
  const subscriptions = useApi<PackageSubscriptionsResponse>("/packages/subscriptions");
  const defaulters = useApi<PackageSubscriptionsResponse>("/packages/defaulters");
  const [form, setForm] = useState({
    name: "",
    totalAmount: "",
    durationMonths: "",
    penaltyType: "FIXED",
    penaltyValue: "",
    penaltyFrequency: "MONTHLY",
  });

  async function createPackage() {
    await api.post("/packages", {
      name: form.name,
      totalAmount: Number(form.totalAmount),
      durationMonths: Number(form.durationMonths),
      penaltyType: form.penaltyType,
      penaltyValue: Number(form.penaltyValue),
      penaltyFrequency: form.penaltyFrequency,
    });
    setForm({
      name: "",
      totalAmount: "",
      durationMonths: "",
      penaltyType: "FIXED",
      penaltyValue: "",
      penaltyFrequency: "MONTHLY",
    });
    await packages.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        subtitle="Structured savings or repayment packages with penalty configuration and subscription visibility."
      />
      <section className="grid gap-3 rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6 md:grid-cols-6">
        <input className="rounded-full border px-4 py-3" placeholder="Package name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Total amount" value={form.totalAmount} onChange={(event) => setForm((current) => ({ ...current, totalAmount: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Duration months" value={form.durationMonths} onChange={(event) => setForm((current) => ({ ...current, durationMonths: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Penalty type" value={form.penaltyType} onChange={(event) => setForm((current) => ({ ...current, penaltyType: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Penalty value" value={form.penaltyValue} onChange={(event) => setForm((current) => ({ ...current, penaltyValue: event.target.value }))} />
        <button className="rounded-full bg-[var(--color-green)] px-4 py-3 font-semibold text-white" onClick={createPackage} type="button">
          Add package
        </button>
      </section>
      <DataTable
        columns={[
          {
            key: "name",
            header: "Package",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.name}</span>,
          },
          {
            key: "amount",
            header: "Total Amount",
            render: (item) => currency.format(item.totalAmount),
          },
          {
            key: "duration",
            header: "Duration",
            render: (item) => `${item.durationMonths} months`,
          },
          {
            key: "penalty",
            header: "Penalty",
            render: (item) => item.penaltyType,
          },
          {
            key: "status",
            header: "Status",
            render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} variant={item.isActive ? "success" : "warning"} />,
          },
        ]}
        data={packages.data?.items ?? []}
        emptyDescription={packages.error || "No packages have been configured yet."}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <PageHeader
            title="Subscriptions"
            subtitle="Current package subscriptions by members."
          />
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-[var(--color-dark)]">{item.member.fullName}</p>
                    <p className="text-xs">{item.member.membershipNumber}</p>
                  </div>
                ),
              },
              {
                key: "package",
                header: "Package",
                render: (item) => item.package.name,
              },
              {
                key: "progress",
                header: "Progress",
                render: (item) => `${currency.format(item.amountPaid)} paid`,
              },
              {
                key: "status",
                header: "Status",
                render: (item) => <StatusBadge status={item.status} variant={item.status === "ACTIVE" ? "success" : "warning"} />,
              },
            ]}
            data={subscriptions.data?.items ?? []}
            emptyDescription={subscriptions.error || "No subscriptions found."}
          />
        </div>

        <div className="space-y-4">
          <PageHeader
            title="Defaulters"
            subtitle="Subscriptions with overdue amounts or accrued penalties."
          />
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => item.member.fullName,
              },
              {
                key: "package",
                header: "Package",
                render: (item) => item.package.name,
              },
              {
                key: "remaining",
                header: "Remaining",
                render: (item) => currency.format(item.amountRemaining),
              },
              {
                key: "penalty",
                header: "Penalty",
                render: (item) => currency.format(item.penaltyAccrued),
              },
            ]}
            data={defaulters.data?.items ?? []}
            emptyDescription={defaulters.error || "No current defaulters."}
          />
        </div>
      </section>
    </div>
  );
}
