"use client";

import Link from "next/link";
import { Card, CardBody, Input, Button, Chip, Divider } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";
import { FormField } from "@achievers/ui";
import { useState } from "react";

const mockWallet = {
  availableBalance: 245000,
  pendingBalance: 30000,
  currency: "NGN",
};

const mockTransactions = [
  { id: "1", type: "FUNDING", amount: 50000, status: "APPROVED", date: "Apr 8, 2026", ref: "TXN-001" },
  { id: "2", type: "LOAN_REPAYMENT", amount: -15000, status: "APPROVED", date: "Apr 7, 2026", ref: "TXN-002" },
  { id: "3", type: "SAVINGS", amount: -20000, status: "APPROVED", date: "Apr 5, 2026", ref: "TXN-003" },
  { id: "4", type: "FUNDING", amount: 30000, status: "PENDING", date: "Apr 4, 2026", ref: "TXN-004" },
  { id: "5", type: "INVESTMENT", amount: -50000, status: "APPROVED", date: "Apr 1, 2026", ref: "TXN-005" },
  { id: "6", type: "FUNDING", amount: 100000, status: "APPROVED", date: "Mar 28, 2026", ref: "TXN-006" },
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

export default function WalletPage() {
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const chargeRate = 0.02;
  const amount = parseFloat(fundAmount) || 0;
  const charge = amount * chargeRate;
  const netAmount = amount - charge;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[var(--brand-ink)]">Wallet</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your wallet balance and transactions</p>

      {/* Balance */}
      <Card className="mt-4 border-0 bg-[var(--brand-ink)]">
        <CardBody className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Available Balance</p>
          <p className="mt-1 text-3xl font-bold text-white">{formatCurrency(mockWallet.availableBalance)}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
            <span className="text-xs text-slate-300">
              Pending: {formatCurrency(mockWallet.pendingBalance)}
            </span>
          </div>
          <Button
            className="mt-4 w-full bg-[var(--brand-gold)] text-[var(--brand-ink)]"
            radius="lg"
            size="lg"
            onPress={() => setShowFundForm(!showFundForm)}
          >
            {showFundForm ? "Cancel" : "Add Money"}
          </Button>
        </CardBody>
      </Card>

      {/* Fund Form */}
      {showFundForm && (
        <Card className="mt-4 border border-slate-200 bg-white">
          <CardBody className="p-5">
            <h3 className="text-base font-semibold text-[var(--brand-ink)]">Fund Your Wallet</h3>
            <p className="mt-1 text-xs text-slate-400">
              Transfer to the account below and upload your receipt
            </p>

            <div className="mt-4 rounded-lg bg-[var(--brand-mist)] p-4">
              <p className="text-xs font-medium text-slate-600">Bank Transfer Details</p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bank</span>
                  <span className="font-medium text-[var(--brand-ink)]">Guaranty Trust Bank</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Account Number</span>
                  <span className="font-medium text-[var(--brand-ink)]">0123456789</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Account Name</span>
                  <span className="font-medium text-[var(--brand-ink)]">Achievers Cooperative</span>
                </div>
              </div>
            </div>

            <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <FormField label="Amount (₦)">
                <Input
                  type="number"
                  placeholder="Enter amount"
                  variant="bordered"
                  radius="lg"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                />
              </FormField>

              {amount > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Amount</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-slate-500">
                    <span>Membership charge ({(chargeRate * 100).toFixed(0)}%)</span>
                    <span className="text-red-500">-{formatCurrency(charge)}</span>
                  </div>
                  <Divider className="my-2" />
                  <div className="flex justify-between font-semibold text-[var(--brand-ink)]">
                    <span>You receive</span>
                    <span>{formatCurrency(netAmount)}</span>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full bg-[var(--brand-ink)] text-white" radius="lg">
                Submit Funding Request
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Transaction History */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--brand-ink)]">Transaction History</h2>
        <div className="space-y-2">
          {mockTransactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
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
                  <p className="text-sm font-medium text-[var(--brand-ink)]">{typeLabel[tx.type]}</p>
                  <p className="text-xs text-slate-400">{tx.date} · {tx.ref}</p>
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
