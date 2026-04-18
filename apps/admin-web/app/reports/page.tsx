import { Card,  } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Financial overview and operational reports</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Revenue (Charges)", value: "₦245,000", detail: "Membership charges collected", color: "bg-green-500" },
          { label: "Total Savings Pool", value: "₦8.5M", detail: "Across all savings accounts", color: "bg-[var(--brand-ink)]" },
          { label: "Loan Portfolio", value: "₦4.2M", detail: "Outstanding loan balance", color: "bg-[var(--brand-navy)]" },
          { label: "Investment Pool", value: "₦5.1M", detail: "Active investment subscriptions", color: "bg-[var(--brand-gold)]" },
        ].map((stat) => (
          <Card key={stat.label} className="border border-slate-200 bg-white">
            <Card.Content  className="p-5">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${stat.color}`} />
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-[var(--brand-ink)]">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
            </Card.Content >
          </Card>
        ))}
      </div>

      {/* Monthly Breakdown */}
      <div className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--brand-ink)]">Monthly Breakdown</h2>
        <Card className="border border-slate-200 bg-white">
          <Card.Content  className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Month</th>
                    <th className="px-5 py-3 text-right font-medium text-slate-500">New Members</th>
                    <th className="px-5 py-3 text-right font-medium text-slate-500">Wallet Funding</th>
                    <th className="px-5 py-3 text-right font-medium text-slate-500">Loans Disbursed</th>
                    <th className="px-5 py-3 text-right font-medium text-slate-500">Savings</th>
                    <th className="px-5 py-3 text-right font-medium text-slate-500">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { month: "Apr 2026", members: 12, funding: 850000, loans: 400000, savings: 240000, revenue: 17000 },
                    { month: "Mar 2026", members: 18, funding: 1200000, loans: 600000, savings: 310000, revenue: 24000 },
                    { month: "Feb 2026", members: 15, funding: 980000, loans: 350000, savings: 280000, revenue: 19600 },
                    { month: "Jan 2026", members: 22, funding: 1500000, loans: 800000, savings: 420000, revenue: 30000 },
                  ].map((row) => (
                    <tr key={row.month} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3 font-medium text-[var(--brand-ink)]">{row.month}</td>
                      <td className="px-5 py-3 text-right">{row.members}</td>
                      <td className="px-5 py-3 text-right">{formatCurrency(row.funding)}</td>
                      <td className="px-5 py-3 text-right">{formatCurrency(row.loans)}</td>
                      <td className="px-5 py-3 text-right">{formatCurrency(row.savings)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-green-600">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Content >
        </Card>
      </div>

      {/* Member Growth */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-[var(--brand-ink)]">Member Growth</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Active Members", value: "142", detail: "Fully verified and operational" },
            { label: "Pending Activation", value: "8", detail: "Awaiting admin verification" },
            { label: "Suspended", value: "6", detail: "Accounts on hold" },
          ].map((item) => (
            <Card key={item.label} className="border border-slate-200 bg-white">
              <Card.Content  className="p-5 text-center">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-2 text-3xl font-bold text-[var(--brand-ink)]">{item.value}</p>
                <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
              </Card.Content >
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
