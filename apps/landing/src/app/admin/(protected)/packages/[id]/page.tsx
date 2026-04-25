"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";

interface PackageDetail {
  id: string;
  name: string;
  totalAmount: number;
  durationMonths: number;
  penaltyType: string;
  penaltyValue: number;
  penaltyFrequency: string;
  isActive: boolean;
  subscriptions: Array<{
    id: string;
    status: string;
    amountPaid: number;
    amountRemaining: number;
    penaltyAccrued: number;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
  defaulters: Array<{
    id: string;
    status: string;
    amountPaid: number;
    amountRemaining: number;
    penaltyAccrued: number;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function SubscriptionCard({
  amountPaid,
  amountRemaining,
  member,
  penaltyAccrued,
  status,
}: {
  amountPaid: number;
  amountRemaining: number;
  penaltyAccrued: number;
  status: string;
  member: { fullName: string; membershipNumber: string };
}) {
  return (
    <div className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-[var(--color-dark)]">{member.fullName}</p>
        <StatusBadge status={status} variant={status === "ACTIVE" ? "success" : "warning"} />
      </div>
      <p className="mt-1 text-xs text-[var(--color-coop-muted)]">{member.membershipNumber}</p>
      <p className="mt-3 text-sm text-[var(--color-dark)]">Paid: {currency.format(amountPaid)}</p>
      <p className="mt-1 text-sm text-[var(--color-dark)]">Remaining: {currency.format(amountRemaining)}</p>
      <p className="mt-1 text-sm text-[var(--color-coop-muted)]">Penalty: {currency.format(penaltyAccrued)}</p>
    </div>
  );
}

export default function PackageDetailPage() {
  const params = useParams<{ id: string }>();
  const packageDetail = useApi<PackageDetail>(`/packages/${params.id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title={packageDetail.data?.name || "Package detail"}
        subtitle="Review package settings, all subscribers, and active defaulters from one page."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <p className="text-sm text-[var(--color-coop-muted)]">Total amount</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{currency.format(packageDetail.data?.totalAmount ?? 0)}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <p className="text-sm text-[var(--color-coop-muted)]">Duration</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{packageDetail.data?.durationMonths ?? 0} months</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <p className="text-sm text-[var(--color-coop-muted)]">Penalty</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{packageDetail.data?.penaltyType || "-"}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_45px_rgba(26,46,26,0.06)]">
          <p className="text-sm text-[var(--color-coop-muted)]">Status</p>
          <div className="mt-2">
            <StatusBadge status={packageDetail.data?.isActive ? "ACTIVE" : "INACTIVE"} variant={packageDetail.data?.isActive ? "success" : "warning"} />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
        <h2 className="text-xl font-semibold text-[var(--color-dark)]">Subscribers</h2>
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(packageDetail.data?.subscriptions ?? []).map((subscription) => (
            <SubscriptionCard
              amountPaid={subscription.amountPaid}
              amountRemaining={subscription.amountRemaining}
              key={subscription.id}
              member={subscription.member}
              penaltyAccrued={subscription.penaltyAccrued}
              status={subscription.status}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
        <h2 className="text-xl font-semibold text-[var(--color-dark)]">Defaulters</h2>
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(packageDetail.data?.defaulters ?? []).map((subscription) => (
            <SubscriptionCard
              amountPaid={subscription.amountPaid}
              amountRemaining={subscription.amountRemaining}
              key={subscription.id}
              member={subscription.member}
              penaltyAccrued={subscription.penaltyAccrued}
              status={subscription.status}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
