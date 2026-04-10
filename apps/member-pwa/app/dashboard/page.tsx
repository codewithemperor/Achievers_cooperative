import Link from "next/link";
import { Card, CardBody, Chip } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";

const mockBalance = 245000;
const mockSavings = 150000;
const mockInvestments = 75000;

const recentTransactions = [
  { id: "1", type: "FUNDING", amount: 50000, status: "APPROVED", date: "Apr 8, 2026" },
  { id: "2", type: "LOAN_REPAYMENT", amount: -15000, status: "APPROVED", date: "Apr 7, 2026" },
  { id: "3", type: "SAVINGS", amount: -20000, status: "APPROVED", date: "Apr 5, 2026" },
  { id: "4", type: "FUNDING", amount: 30000, status: "PENDING", date: "Apr 4, 2026" },
  { id: "5", type: "INVESTMENT", amount: -50000, status: "APPROVED", date: "Apr 1, 2026" },
];

const quickActions = [
  { label: "Add Money", href: "/wallet", icon: "➕" },
  { label: "Apply Loan", href: "/loans", icon: "📋" },
  { label: "Save", href: "/savings", icon: "💰" },
  { label: "Invest", href: "/investments", icon: "📈" },
];

const statusColor = {
  APPROVED: "success" as const,
  PENDING: "warning" as const,
  REJECTED: "danger" as const,
};

const typeLabel: Record<string, string> = {
  FUNDING: "Wallet Funding",
  LOAN_REPAYMENT: "Loan Repayment",
  SAVINGS: "Savings Contribution",
  LOAN_DISBURSEMENT: "Loan Disbursement",
  INVESTMENT: "Investment",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-sm text-slate-500">Good morning,</p>
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">John Doe</h1>
        <p className="text-xs text-slate-400">Member #ACH-001</p>
      </div>

      {/* Balance Card */}
      <Card className="mb-6 border-0 bg-[var(--brand-ink)]">
        <CardBody className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Available Balance
          </p>
          <p className="mt-1 text-3xl font-bold text-white">{formatCurrency(mockBalance)}</p>
          <div className="mt-4 flex gap-3 text-xs">
            <div>
              <p className="text-slate-400">Savings</p>
              <p className="font-semibold text-white">{formatCurrency(mockSavings)}</p>
            </div>
            <div className="border-l border-slate-600 pl-3">
              <p className="text-slate-400">Investments</p>
              <p className="font-semibold text-white">{formatCurrency(mockInvestments)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Quick Actions */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <Link key={action.label} href={action.href}>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-center transition-colors hover:border-slate-300">
              <span className="text-lg">{action.icon}</span>
              <span className="text-[11px] font-medium text-slate-600">{action.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="border border-slate-200 bg-white">
          <CardBody className="p-4 text-center">
            <p className="text-xs text-slate-400">Active Loans</p>
            <p className="mt-1 text-xl font-bold text-[var(--brand-ink)]">1</p>
          </CardBody>
        </Card>
        <Card className="border border-slate-200 bg-white">
          <CardBody className="p-4 text-center">
            <p className="text-xs text-slate-400">Transactions</p>
            <p className="mt-1 text-xl font-bold text-[var(--brand-ink)]">24</p>
          </CardBody>
        </Card>
        <Card className="border border-slate-200 bg-white">
          <CardBody className="p-4 text-center">
            <p className="text-xs text-slate-400">Status</p>
            <Chip size="sm" color="success" variant="flat">Active</Chip>
          </CardBody>
        </Card>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--brand-ink)]">Recent Transactions</h2>
          <Link href="/transactions" className="text-xs font-medium text-[var(--brand-gold)] hover:underline">
            View All
          </Link>
        </div>
        <div className="space-y-2">
          {recentTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tx.amount > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                  {tx.amount > 0 ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--brand-ink)]">
                    {typeLabel[tx.type] || tx.type}
                  </p>
                  <p className="text-xs text-slate-400">{tx.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${tx.amount > 0 ? "text-green-600" : "text-slate-700"}`}>
                  {tx.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                </p>
                <Chip size="sm" color={statusColor[tx.status as keyof typeof statusColor]} variant="flat">
                  {tx.status}
                </Chip>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
