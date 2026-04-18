import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";

const stats = [
  {
    label: "Total Members",
    value: "156",
    detail: "+12 this month",
    color: "bg-[var(--brand-ink)]",
  },
  {
    label: "Total Wallet Balance",
    value: "₦12.4M",
    detail: "Across all wallets",
    color: "bg-[var(--brand-navy)]",
  },
  {
    label: "Active Loans",
    value: "34",
    detail: "₦4.2M outstanding",
    color: "bg-[var(--brand-gold)]",
  },
  {
    label: "Pending Approvals",
    value: "7",
    detail: "Requires action",
    color: "bg-red-500",
  },
];

const pendingActions = [
  {
    id: "1",
    type: "Payment Verification",
    member: "Adaeze Okonkwo",
    amount: "₦50,000",
    date: "Apr 8, 2026",
    href: "/transactions",
  },
  {
    id: "2",
    type: "Loan Application",
    member: "Chidi Eze",
    amount: "₦200,000",
    date: "Apr 7, 2026",
    href: "/loans",
  },
  {
    id: "3",
    type: "Payment Verification",
    member: "Funke Adeyemi",
    amount: "₦30,000",
    date: "Apr 6, 2026",
    href: "/transactions",
  },
  {
    id: "4",
    type: "Investment Request",
    member: "Adaeze Okonkwo",
    amount: "₦100,000",
    date: "Apr 5, 2026",
    href: "/investments",
  },
  {
    id: "5",
    type: "New Member",
    member: "Bola Tinubu",
    amount: "",
    date: "Apr 4, 2026",
    href: "/members",
  },
];

const recentActivity = [
  {
    action: "Approved funding",
    target: "Adaeze Okonkwo - ₦50,000",
    time: "2 hours ago",
    by: "Admin",
  },
  {
    action: "Rejected loan",
    target: "Chidi Eze - ₦500,000",
    time: "5 hours ago",
    by: "Super Admin",
  },
  {
    action: "Activated member",
    target: "Funke Adeyemi",
    time: "1 day ago",
    by: "Admin",
  },
  {
    action: "Disbursed loan",
    target: "Adaeze Okonkwo - ₦100,000",
    time: "2 days ago",
    by: "Super Admin",
  },
  {
    action: "Created investment",
    target: "Growth Fund - 18% p.a.",
    time: "3 days ago",
    by: "Super Admin",
  },
];

export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of cooperative operations and pending actions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border border-slate-200 bg-white">
            <Card.Content className="p-5">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${stat.color}`} />
                <p className="text-sm font-medium text-slate-500">
                  {stat.label}
                </p>
              </div>
              <p className="mt-2 text-2xl font-bold text-[var(--brand-ink)]">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
            </Card.Content>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Pending Actions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--brand-ink)]">
              Pending Actions
            </h2>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
              {pendingActions.length} pending
            </span>
          </div>
          <div className="space-y-2">
            {pendingActions.map((action) => (
              <Link key={action.id} href={action.href}>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50">
                      <svg
                        className="h-5 w-5 text-yellow-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--brand-ink)]">
                        {action.type}
                      </p>
                      <p className="text-xs text-slate-400">
                        {action.member} · {action.date}
                      </p>
                    </div>
                  </div>
                  {action.amount && <Chip size="sm">{action.amount}</Chip>}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[var(--brand-ink)]">
              Recent Activity
            </h2>
          </div>
          <Card className="border border-slate-200 bg-white">
            <Card.Content className="p-4">
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <svg
                        className="h-3.5 w-3.5 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[var(--brand-ink)]">
                        <span className="font-medium">{activity.action}</span> —{" "}
                        {activity.target}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {activity.by} · {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
