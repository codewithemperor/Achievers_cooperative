"use client";

import { Card, CardBody, Button, Input, Chip } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";
import { FormField } from "@achievers/ui";
import { useState } from "react";

const mockSavings = {
  balance: 150000,
  contributionFrequency: "MONTHLY",
  totalContributions: 12,
  totalContributed: 360000,
};

const mockHistory = [
  { id: "1", amount: 20000, date: "Apr 1, 2026", ref: "SAV-001" },
  { id: "2", amount: 20000, date: "Mar 1, 2026", ref: "SAV-002" },
  { id: "3", amount: 30000, date: "Feb 1, 2026", ref: "SAV-003" },
  { id: "4", amount: 20000, date: "Jan 1, 2026", ref: "SAV-004" },
];

export default function SavingsPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[var(--brand-ink)]">Savings</h1>
      <p className="mt-1 text-sm text-slate-500">Track your savings and make contributions</p>

      {/* Savings Overview */}
      <Card className="mt-4 border-0 bg-[var(--brand-ink)]">
        <CardBody className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Savings Balance</p>
          <p className="mt-1 text-3xl font-bold text-white">{formatCurrency(mockSavings.balance)}</p>
          <div className="mt-3 flex gap-4 text-xs">
            <div>
              <p className="text-slate-400">Frequency</p>
              <p className="font-medium text-white">{mockSavings.contributionFrequency}</p>
            </div>
            <div>
              <p className="text-slate-400">Contributions</p>
              <p className="font-medium text-white">{mockSavings.totalContributions}</p>
            </div>
            <div>
              <p className="text-slate-400">Total Saved</p>
              <p className="font-medium text-white">{formatCurrency(mockSavings.totalContributed)}</p>
            </div>
          </div>
          <Button
            className="mt-4 w-full bg-[var(--brand-gold)] text-[var(--brand-ink)]"
            radius="lg"
            onPress={() => setShowForm(!showForm)}
          >
            {showForm ? "Cancel" : "Contribute Now"}
          </Button>
        </CardBody>
      </Card>

      {/* Contribute Form */}
      {showForm && (
        <Card className="mt-4 border border-slate-200 bg-white">
          <CardBody className="p-5">
            <h3 className="text-base font-semibold text-[var(--brand-ink)]">Make a Contribution</h3>
            <p className="mt-1 text-xs text-slate-400">Amount will be debited from your wallet</p>
            <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <FormField label="Amount (₦)">
                <Input type="number" placeholder="Enter contribution amount" variant="bordered" radius="lg" />
              </FormField>
              <Button type="submit" className="w-full bg-[var(--brand-ink)] text-white" radius="lg">
                Save Now
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {/* History */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--brand-ink)]">Contribution History</h2>
        <div className="space-y-2">
          {mockHistory.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--brand-ink)]">Savings Contribution</p>
                  <p className="text-xs text-slate-400">{item.date} · {item.ref}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">+{formatCurrency(item.amount)}</p>
                <Chip size="sm" color="success" variant="flat">Confirmed</Chip>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
