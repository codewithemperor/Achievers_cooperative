import { Card, Chip } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";

const mockTransactions = [
  {
    id: "1",
    type: "FUNDING",
    amount: 50000,
    status: "APPROVED",
    date: "Apr 8, 2026",
    ref: "TXN-001",
  },
  {
    id: "2",
    type: "LOAN_REPAYMENT",
    amount: -15000,
    status: "APPROVED",
    date: "Apr 7, 2026",
    ref: "TXN-002",
  },
  {
    id: "3",
    type: "SAVINGS",
    amount: -20000,
    status: "APPROVED",
    date: "Apr 5, 2026",
    ref: "TXN-003",
  },
  {
    id: "4",
    type: "FUNDING",
    amount: 30000,
    status: "PENDING",
    date: "Apr 4, 2026",
    ref: "TXN-004",
  },
  {
    id: "5",
    type: "INVESTMENT",
    amount: -50000,
    status: "APPROVED",
    date: "Apr 1, 2026",
    ref: "TXN-005",
  },
  {
    id: "6",
    type: "LOAN_DISBURSEMENT",
    amount: 100000,
    status: "APPROVED",
    date: "Mar 28, 2026",
    ref: "TXN-006",
  },
  {
    id: "7",
    type: "FUNDING",
    amount: 200000,
    status: "APPROVED",
    date: "Mar 15, 2026",
    ref: "TXN-007",
  },
  {
    id: "8",
    type: "SAVINGS",
    amount: -30000,
    status: "APPROVED",
    date: "Mar 1, 2026",
    ref: "TXN-008",
  },
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

export default function TransactionsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[var(--brand-ink)]">
        Transactions
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Complete history of all your transactions
      </p>

      {/* Filters */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {["All", "Funding", "Loans", "Savings", "Investments"].map((filter) => (
          <button
            key={filter}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === "All"
                ? "bg-[var(--brand-ink)] text-white"
                : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div className="mt-4 space-y-2">
        {mockTransactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${tx.amount > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}
              >
                {tx.amount > 0 ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 12h-15"
                    />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--brand-ink)]">
                  {typeLabel[tx.type] || tx.type}
                </p>
                <p className="text-xs text-slate-400">
                  {tx.date} · {tx.ref}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-semibold ${tx.amount > 0 ? "text-green-600" : "text-slate-700"}`}
              >
                {tx.amount > 0 ? "+" : ""}
                {formatCurrency(Math.abs(tx.amount))}
              </p>
              <Chip
                size="sm"
                color={statusColor[tx.status as keyof typeof statusColor]}
                variant="soft"
              >
                {tx.status}
              </Chip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
