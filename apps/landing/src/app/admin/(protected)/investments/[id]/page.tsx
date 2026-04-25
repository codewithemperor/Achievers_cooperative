"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";

interface InvestmentDetail {
  id: string;
  name: string;
  annualRate: number;
  minimumAmount: number;
  maximumAmount?: number | null;
  durationMonths: number;
  status: string;
  subscriptions: Array<{
    id: string;
    principal: number;
    status: string;
    isDefaulter: boolean;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
  subscribers: Array<{
    id: string;
    principal: number;
    status: string;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
  defaulters: Array<{
    id: string;
    principal: number;
    status: string;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function PersonCard({ principal, status, title, membershipNumber }: { title: string; membershipNumber: string; principal: number; status: string }) {
  return (
    <div className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
      <p className="font-semibold text-[var(--color-dark)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--color-coop-muted)]">{membershipNumber}</p>
      <p className="mt-3 text-sm text-[var(--color-dark)]">{currency.format(principal)}</p>
      <div className="mt-2">
        <StatusBadge status={status} variant={status === "APPROVED" ? "success" : "warning"} />
      </div>
    </div>
  );
}

export default function InvestmentDetailPage() {
  const params = useParams<{ id: string }>();
  const investment = useApi<InvestmentDetail>(`/investments/products/${params.id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title={investment.data?.name || "Investment detail"}
        subtitle="Review full investment data, subscriber activity, and defaulter visibility from one page."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <p className="text-sm text-[var(--color-coop-muted)]">Annual rate</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{investment.data?.annualRate ?? 0}%</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <p className="text-sm text-[var(--color-coop-muted)]">Minimum amount</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{currency.format(investment.data?.minimumAmount ?? 0)}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <p className="text-sm text-[var(--color-coop-muted)]">Duration</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{investment.data?.durationMonths ?? 0} months</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <p className="text-sm text-[var(--color-coop-muted)]">Status</p>
          <div className="mt-2">
            <StatusBadge status={investment.data?.status || "UNKNOWN"} variant={investment.data?.status === "ACTIVE" ? "success" : "warning"} />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
        <h2 className="text-xl font-semibold text-[var(--color-dark)]">Subscribers</h2>
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(investment.data?.subscribers ?? []).map((subscriber) => (
            <PersonCard
              key={subscriber.id}
              membershipNumber={subscriber.member.membershipNumber}
              principal={subscriber.principal}
              status={subscriber.status}
              title={subscriber.member.fullName}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
        <h2 className="text-xl font-semibold text-[var(--color-dark)]">Defaulters</h2>
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(investment.data?.defaulters ?? []).map((subscriber) => (
            <PersonCard
              key={subscriber.id}
              membershipNumber={subscriber.member.membershipNumber}
              principal={subscriber.principal}
              status={subscriber.status}
              title={subscriber.member.fullName}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
