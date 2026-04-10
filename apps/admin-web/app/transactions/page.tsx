"use client";

import { Card, CardBody, Input, Button, Chip, Textarea, Select, SelectItem } from "@heroui/react";
import { FormField } from "@achievers/ui";
import { formatCurrency } from "@achievers/utils";
import { useState } from "react";

const mockTransactions = [
  { id: "1", type: "FUNDING", member: "Adaeze Okonkwo", amount: 50000, status: "PENDING", date: "Apr 8, 2026", ref: "TXN-001", memberNo: "ACH-000001" },
  { id: "2", type: "FUNDING", member: "Funke Adeyemi", amount: 30000, status: "PENDING", date: "Apr 6, 2026", ref: "TXN-004", memberNo: "ACH-000003" },
  { id: "3", type: "FUNDING", member: "Adaeze Okonkwo", amount: 100000, status: "APPROVED", date: "Mar 28, 2026", ref: "TXN-007", memberNo: "ACH-000001" },
  { id: "4", type: "LOAN_REPAYMENT", member: "Chidi Eze", amount: 15000, status: "APPROVED", date: "Mar 25, 2026", ref: "TXN-008", memberNo: "ACH-000002" },
  { id: "5", type: "SAVINGS", member: "Emeka Nwosu", amount: 20000, status: "APPROVED", date: "Mar 20, 2026", ref: "TXN-009", memberNo: "ACH-000004" },
  { id: "6", type: "INVESTMENT", member: "Yusuf Abdullahi", amount: 100000, status: "APPROVED", date: "Mar 15, 2026", ref: "TXN-010", memberNo: "ACH-000006" },
];

const statusColor = {
  APPROVED: "success" as const,
  PENDING: "warning" as const,
  REJECTED: "danger" as const,
};

const typeLabel: Record<string, string> = {
  FUNDING: "Wallet Funding",
  LOAN_REPAYMENT: "Loan Repayment",
  SAVINGS: "Savings",
  LOAN_DISBURSEMENT: "Loan Disbursement",
  INVESTMENT: "Investment",
};

export default function TransactionsPage() {
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [rejectTx, setRejectTx] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">Transactions</h1>
        <p className="mt-1 text-sm text-slate-500">Review and manage all financial transactions</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {["All", "Funding", "Loans", "Savings", "Investments"].map((filter) => (
          <button
            key={filter}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium ${
              filter === "All" ? "bg-[var(--brand-ink)] text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <Card className="border border-slate-200 bg-white">
        <CardBody className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Reference</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Type</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Member</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Amount</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Date</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{tx.ref}</td>
                    <td className="px-5 py-3 text-slate-600">{typeLabel[tx.type]}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-[var(--brand-ink)]">{tx.member}</p>
                      <p className="text-xs text-slate-400">{tx.memberNo}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold">{formatCurrency(tx.amount)}</td>
                    <td className="px-5 py-3">
                      <Chip size="sm" color={statusColor[tx.status as keyof typeof statusColor]} variant="flat">
                        {tx.status}
                      </Chip>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{tx.date}</td>
                    <td className="px-5 py-3 text-right">
                      {tx.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedTx(tx.id)}
                            className="rounded-lg bg-green-50 px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectTx(tx.id)}
                            className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="space-y-2 p-4 md:hidden">
            {mockTransactions.map((tx) => (
              <div key={tx.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--brand-ink)]">{tx.member}</p>
                    <p className="text-xs text-slate-400">{typeLabel[tx.type]} · {tx.ref}</p>
                  </div>
                  <Chip size="sm" color={statusColor[tx.status as keyof typeof statusColor]} variant="flat">
                    {tx.status}
                  </Chip>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-base font-semibold">{formatCurrency(tx.amount)}</p>
                  <p className="text-xs text-slate-400">{tx.date}</p>
                </div>
                {tx.status === "PENDING" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setSelectedTx(tx.id)} className="flex-1 rounded-lg bg-green-50 py-2 text-xs font-medium text-green-600">Approve</button>
                    <button onClick={() => setRejectTx(tx.id)} className="flex-1 rounded-lg bg-red-50 py-2 text-xs font-medium text-red-500">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
