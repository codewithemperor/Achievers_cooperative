"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";

interface PaymentsResponse {
  items: Array<{
    id: string;
    amount: number;
    status: string;
    receiptUrl: string;
    member: { fullName: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function PaymentsPage() {
  const payments = useApi<PaymentsResponse>("/payments");
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function approve(id: string) {
    try {
      setWorkingId(id);
      await api.patch(`/payments/${id}/approve`);
      await payments.refetch();
    } finally {
      setWorkingId(null);
    }
  }

  async function reject(id: string) {
    try {
      setWorkingId(id);
      await api.patch(`/payments/${id}/reject`, { reason: "Verification failed" });
      await payments.refetch();
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Review uploaded transfer receipts and verification status before wallet credit is applied."
      />
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
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={item.status === "APPROVED" ? "success" : item.status === "REJECTED" ? "danger" : "warning"}
              />
            ),
          },
          {
            key: "receipt",
            header: "Receipt",
            render: (item) =>
              item.receiptUrl ? (
                <a className="font-semibold text-[var(--color-green)]" href={item.receiptUrl} rel="noreferrer" target="_blank">
                  View receipt
                </a>
              ) : (
                "Not uploaded"
              ),
          },
          {
            key: "actions",
            header: "Actions",
            render: (item) => (
              <div className="flex gap-2">
                <button
                  className="rounded-full border px-3 py-1 text-xs"
                  disabled={workingId === item.id}
                  onClick={() => approve(item.id)}
                  type="button"
                >
                  Approve
                </button>
                <button
                  className="rounded-full border px-3 py-1 text-xs"
                  disabled={workingId === item.id}
                  onClick={() => reject(item.id)}
                  type="button"
                >
                  Reject
                </button>
              </div>
            ),
          },
        ]}
        data={payments.data?.items ?? []}
        emptyDescription={payments.error || "No payment verifications are waiting."}
      />
    </div>
  );
}
