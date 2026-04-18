"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";

interface LoanDetail {
  id: string;
  amount: number;
  tenorMonths: number;
  purpose: string;
  status: string;
  member: { fullName: string; membershipNumber: string };
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const loan = useApi<LoanDetail>(`/loans/${params.id}`);
  const [working, setWorking] = useState(false);

  async function runAction(action: "approve" | "reject" | "disburse") {
    try {
      setWorking(true);
      await api.patch(`/loans/${params.id}/${action}`);
      await loan.refetch();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan detail"
        subtitle="Review the selected loan application and its member context."
        actions={
          <>
            <button className="rounded-full border px-4 py-2 text-sm" disabled={working} onClick={() => runAction("approve")} type="button">
              Approve
            </button>
            <button className="rounded-full border px-4 py-2 text-sm" disabled={working} onClick={() => runAction("reject")} type="button">
              Reject
            </button>
            <button className="rounded-full bg-[var(--color-green)] px-4 py-2 text-sm font-semibold text-white" disabled={working} onClick={() => runAction("disburse")} type="button">
              Disburse
            </button>
          </>
        }
      />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
          <p className="text-sm text-[var(--color-coop-muted)]">Member</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{loan.data?.member.fullName || "-"}</p>
          <p className="mt-1 text-sm">{loan.data?.member.membershipNumber || ""}</p>
        </div>
        <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
          <p className="text-sm text-[var(--color-coop-muted)]">Loan amount</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{currency.format(loan.data?.amount ?? 0)}</p>
          <p className="mt-1 text-sm">{loan.data?.tenorMonths ?? 0} month tenor</p>
          <div className="mt-4">
            <StatusBadge status={loan.data?.status || "UNKNOWN"} variant="info" />
          </div>
        </div>
      </div>
      <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
        <h2 className="text-xl font-semibold text-[var(--color-dark)]">Purpose</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-coop-muted)]">{loan.data?.purpose || "No purpose provided."}</p>
      </div>
    </div>
  );
}
