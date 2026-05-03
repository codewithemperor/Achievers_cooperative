"use client";

import { useParams } from "next/navigation";
import { Landmark, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
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
    maturityDate: string;
    maturityAmount: number;
    status: string;
    isDefaulter: boolean;
    member: { id: string; fullName: string; membershipNumber: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function InvestmentDetailPage() {
  const params = useParams<{ id: string }>();
  const investment = useApi<InvestmentDetail>(
    `/investments/products/${params.id}`,
  );
  const subscriptions = investment.data?.subscriptions ?? [];
  const totalInvested = subscriptions.reduce(
    (sum, item) => sum + item.principal,
    0,
  );
  const totalMaturity = subscriptions.reduce(
    (sum, item) => sum + item.maturityAmount,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={investment.data?.name || "Investment detail"}
        subtitle="Track product totals, expected payout, and every subscriber in a single table."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Annual Rate"
          value={`${investment.data?.annualRate ?? 0}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          title="Minimum Amount"
          value={currency.format(investment.data?.minimumAmount ?? 0)}
          icon={<Landmark className="h-5 w-5" />}
          accent="blue"
        />
        <StatCard
          title="Amount Invested"
          value={currency.format(totalInvested)}
          icon={<Users className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          title="Maturity Payout"
          value={currency.format(totalMaturity)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="dark"
        />
      </section>

      <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-900">Subscribers</h2>
          <StatusBadge
            status={investment.data?.status || "UNKNOWN"}
            variant={
              investment.data?.status === "ACTIVE" ? "success" : "warning"
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--background-200)] text-text-400">
              <tr>
                <th className="px-3 py-3 font-semibold">Subscriber</th>
                <th className="px-3 py-3 font-semibold">Principal</th>
                <th className="px-3 py-3 font-semibold">Maturity Date</th>
                <th className="px-3 py-3 font-semibold">Maturity Amount</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Defaulting</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscriber) => (
                <tr
                  key={subscriber.id}
                  className="border-b border-[var(--background-100)]"
                >
                  <td className="px-3 py-3">
                    <p className="font-semibold text-text-900">
                      {subscriber.member.fullName}
                    </p>
                    <p className="text-xs text-text-400">
                      {subscriber.member.membershipNumber}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {currency.format(subscriber.principal)}
                  </td>
                  <td className="px-3 py-3">
                    {new Date(subscriber.maturityDate).toLocaleDateString(
                      "en-NG",
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {currency.format(subscriber.maturityAmount)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={subscriber.status}
                      variant={
                        subscriber.status === "APPROVED" ? "success" : "warning"
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    {subscriber.isDefaulter ? "Yes" : "No"}
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
