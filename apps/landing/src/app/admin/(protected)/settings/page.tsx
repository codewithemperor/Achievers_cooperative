"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";

interface ConfigResponse {
  items: Array<{
    id: string;
    key: string;
    value: string;
    updatedAt: string;
  }>;
}

export default function SettingsPage() {
  const config = useApi<ConfigResponse | Array<any>>("/config");
  const rows = Array.isArray(config.data) ? config.data : config.data?.items ?? [];
  const [form, setForm] = useState({ key: "", value: "" });

  async function saveConfig() {
    await api.patch(`/config/${form.key}`, { value: form.value });
    setForm({ key: "", value: "" });
    await config.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="System-wide cooperative parameters that affect charges, notifications, and operational defaults."
      />
      <section className="grid gap-3 rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6 md:grid-cols-3">
        <input className="rounded-full border px-4 py-3" placeholder="Config key" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} />
        <input className="rounded-full border px-4 py-3" placeholder="Config value" value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} />
        <button className="rounded-full bg-[var(--color-green)] px-4 py-3 font-semibold text-white" onClick={saveConfig} type="button">
          Save setting
        </button>
      </section>
      <DataTable
        columns={[
          {
            key: "key",
            header: "Key",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.key}</span>,
          },
          {
            key: "value",
            header: "Value",
            render: (item) => item.value,
          },
          {
            key: "updated",
            header: "Updated",
            render: (item) => new Date(item.updatedAt).toLocaleString(),
          },
        ]}
        data={rows}
        emptyDescription={config.error || "No settings are configured yet."}
      />
    </div>
  );
}
