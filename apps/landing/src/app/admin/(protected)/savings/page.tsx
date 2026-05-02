"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { useApi } from "@/hooks/useApi";
import { PiggyBank, Search } from "lucide-react";

interface SavingsSummary {
  savings: {
    totalBalance: number;
  };
  members: {
    total: number;
    active: number;
  };
}

interface MemberSavingsReport {
  id: string;
  fullName: string;
  membershipNumber: string;
  status: string;
  email: string;
  joinedAt: string;
  walletBalance: number;
  savingsBalance: number;
  totalLoans: number;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function SavingsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const summary = useApi<SavingsSummary>("/reports/summary");
  const membersReport = useApi<MemberSavingsReport[]>("/reports/members");

  const filteredMembers = useMemo(() => {
    const items = membersReport.data ?? [];
    if (!searchQuery.trim()) return items;

    const q = searchQuery.toLowerCase();
    return items.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.membershipNumber.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [membersReport.data, searchQuery]);

  const totalSavings = summary.data?.savings?.totalBalance ?? 0;
  const totalMembers = summary.data?.members?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings"
        subtitle="Monitor all members' savings balances, contribution patterns, and overall cooperative savings."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Savings"
          value={currency.format(totalSavings)}
          accent="green"
          icon={<PiggyBank className="h-5 w-5" />}
        />
        <StatCard
          title="Total Members"
          value={String(totalMembers)}
          accent="blue"
        />
        <StatCard
          title="Avg. Savings / Member"
          value={totalMembers > 0 ? currency.format(totalSavings / totalMembers) : currency.format(0)}
          accent="dark"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-400)]" />
          <input
            className="w-full rounded-2xl border border-[var(--primary-900)/12] bg-white py-3 pl-10 pr-4 text-sm outline-none placeholder:text-[var(--text-400)] focus:border-[var(--primary-700)] transition"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, membership number, or email..."
            type="text"
            value={searchQuery}
          />
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--text-900)]">{item.fullName}</p>
                <p className="text-xs text-[var(--text-400)]">{item.membershipNumber}</p>
              </div>
            ),
          },
          {
            key: "savings",
            header: "Savings Balance",
            render: (item) => (
              <span className={item.savingsBalance > 0 ? "font-semibold text-[var(--text-900)]" : "text-[var(--text-400)]"}>
                {currency.format(item.savingsBalance)}
              </span>
            ),
          },
          {
            key: "wallet",
            header: "Wallet Balance",
            render: (item) => (
              <span className={item.walletBalance > 0 ? "font-medium text-[var(--text-900)]" : "text-[var(--text-400)]"}>
                {currency.format(item.walletBalance)}
              </span>
            ),
          },
          {
            key: "loans",
            header: "Total Loans",
            render: (item) => (
              <span className="text-[var(--text-900)]">{currency.format(item.totalLoans)}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => {
              const isActive = item.status === "ACTIVE";
              return (
                <span
                  className={
                    `inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ` +
                    (isActive
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-stone-100 text-stone-700 border-stone-200")
                  }
                >
                  {item.status}
                </span>
              );
            },
          },
          {
            key: "joined",
            header: "Joined",
            render: (item) => (
              <span className="text-sm text-[var(--text-400)]">
                {new Date(item.joinedAt).toLocaleDateString("en-NG", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            ),
          },
        ]}
        data={filteredMembers}
        emptyDescription={membersReport.error || "No savings data available yet."}
        loading={membersReport.loading}
      />
    </div>
  );
}
