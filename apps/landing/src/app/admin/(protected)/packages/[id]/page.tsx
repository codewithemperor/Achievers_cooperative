"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Layers3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
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
    nextDueAt?: string | null;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const tabs = [
  { id: "ALL", label: "All" },
  { id: "DEFAULTING", label: "Defaulting" },
];

export default function PackageDetailPage() {
  const params = useParams<{ id: string }>();
  const packageDetail = useApi<PackageDetail>(`/packages/${params.id}`);
  const [tab, setTab] = useState("ALL");

  const subscriptions = packageDetail.data?.subscriptions ?? [];
  const filteredSubscriptions = useMemo(() => {
    if (tab === "DEFAULTING") {
      return subscriptions.filter(
        (item) =>
          item.penaltyAccrued > 0 ||
          (item.nextDueAt ? new Date(item.nextDueAt) < new Date() : false),
      );
    }
    return subscriptions;
  }, [subscriptions, tab]);

  const totalPaid = subscriptions.reduce(
    (sum, item) => sum + item.amountPaid,
    0,
  );
  const totalOutstanding = subscriptions.reduce(
    (sum, item) => sum + item.amountRemaining,
    0,
  );
  const totalPenalty = subscriptions.reduce(
    (sum, item) => sum + item.penaltyAccrued,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={packageDetail.data?.name || "Package detail"}
        subtitle="Review totals, status, and every subscriber with default visibility from one table."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Amount"
          value={currency.format(packageDetail.data?.totalAmount ?? 0)}
          icon={<Layers3 className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          title="Paid So Far"
          value={currency.format(totalPaid)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          title="Outstanding"
          value={currency.format(totalOutstanding)}
          icon={<Clock3 className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          title="Penalty Accrued"
          value={currency.format(totalPenalty)}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="red"
        />
      </section>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={
              tab === item.id
                ? "rounded-full bg-[var(--text-900)] px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-text-900"
            }
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-900">Subscribers</h2>
          <StatusBadge
            status={packageDetail.data?.isActive ? "ACTIVE" : "INACTIVE"}
            variant={packageDetail.data?.isActive ? "success" : "warning"}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--background-200)] text-text-400">
              <tr>
                <th className="px-3 py-3 font-semibold">Subscriber</th>
                <th className="px-3 py-3 font-semibold">Paid</th>
                <th className="px-3 py-3 font-semibold">Remaining</th>
                <th className="px-3 py-3 font-semibold">Penalty</th>
                <th className="px-3 py-3 font-semibold">Next Due</th>
                <th className="px-3 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.map((subscription) => (
                <tr
                  key={subscription.id}
                  className="border-b border-[var(--background-100)]"
                >
                  <td className="px-3 py-3">
                    <p className="font-semibold text-text-900">
                      {subscription.member.fullName}
                    </p>
                    <p className="text-xs text-text-400">
                      {subscription.member.membershipNumber}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {currency.format(subscription.amountPaid)}
                  </td>
                  <td className="px-3 py-3">
                    {currency.format(subscription.amountRemaining)}
                  </td>
                  <td className="px-3 py-3">
                    {currency.format(subscription.penaltyAccrued)}
                  </td>
                  <td className="px-3 py-3">
                    {subscription.nextDueAt
                      ? new Date(subscription.nextDueAt).toLocaleDateString(
                          "en-NG",
                        )
                      : "-"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={subscription.status}
                      variant={
                        subscription.status === "COMPLETED"
                          ? "success"
                          : "warning"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
