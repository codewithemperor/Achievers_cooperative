"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";

interface MembersResponse {
  items: Array<{
    id: string;
    fullName: string;
    membershipNumber: string;
    phoneNumber: string;
    status: string;
    user: { email: string; role: string };
    wallet: { availableBalance: number; currency: string } | null;
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function MembersPage() {
  const members = useApi<MembersResponse>("/members");
  const [form, setForm] = useState({ email: "", fullName: "", phoneNumber: "" });
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createMember() {
    try {
      setSubmitting(true);
      const response = await api.post("/members", form);
      setActivationCode(response.data.activationCode ?? null);
      setForm({ email: "", fullName: "", phoneNumber: "" });
      await members.refetch();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="Searchable member directory with wallet visibility and direct links into each member record."
      />

      <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded-full border border-[rgba(26,46,26,0.12)] px-4 py-3"
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            placeholder="Full name"
            value={form.fullName}
          />
          <input
            className="rounded-full border border-[rgba(26,46,26,0.12)] px-4 py-3"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email"
            value={form.email}
          />
          <input
            className="rounded-full border border-[rgba(26,46,26,0.12)] px-4 py-3"
            onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
            placeholder="Phone number"
            value={form.phoneNumber}
          />
          <button
            className="rounded-full bg-[var(--color-green)] px-4 py-3 font-semibold text-white"
            disabled={submitting}
            onClick={createMember}
            type="button"
          >
            {submitting ? "Creating..." : "Add member"}
          </button>
        </div>
        {activationCode ? (
          <p className="mt-4 text-sm text-[var(--color-coop-muted)]">
            Activation code for the newly created member: <span className="font-semibold text-[var(--color-dark)]">{activationCode}</span>
          </p>
        ) : null}
      </section>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Member",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-dark)]">{item.fullName}</p>
                <p className="text-xs">{item.membershipNumber}</p>
              </div>
            ),
          },
          {
            key: "contact",
            header: "Contact",
            render: (item) => (
              <div>
                <p>{item.user.email}</p>
                <p className="text-xs">{item.phoneNumber}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={item.status === "ACTIVE" ? "success" : item.status === "PENDING" ? "warning" : "danger"}
              />
            ),
          },
          {
            key: "wallet",
            header: "Wallet",
            render: (item) => currency.format(item.wallet?.availableBalance ?? 0),
          },
          {
            key: "view",
            header: "View",
            render: (item) => (
              <Link className="font-semibold text-[var(--color-green)]" href={`/admin/members/${item.id}`}>
                Open profile
              </Link>
            ),
          },
        ]}
        data={members.data?.items ?? []}
        emptyDescription={members.error || "No members found yet."}
      />
    </div>
  );
}
