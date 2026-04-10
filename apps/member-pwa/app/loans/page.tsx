"use client";

import { Card, CardBody, Button, Input, Textarea, Chip, Select, SelectItem, Divider } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";
import { FormField } from "@achievers/ui";
import { useState } from "react";

const mockLoans = [
  { id: "1", amount: 200000, tenorMonths: 6, purpose: "Business expansion", status: "APPROVED", date: "Mar 15, 2026", remaining: 155000 },
  { id: "2", amount: 100000, tenorMonths: 12, purpose: "Education fees", status: "PENDING", date: "Apr 6, 2026", remaining: null },
];

const statusColor = {
  APPROVED: "success" as const,
  PENDING: "warning" as const,
  REJECTED: "danger" as const,
  UNDER_REVIEW: "default" as const,
  DRAFT: "default" as const,
};

export default function LoansPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--brand-ink)]">Loans</h1>
          <p className="mt-1 text-sm text-slate-500">Apply for loans and track your applications</p>
        </div>
        <Button
          className="bg-[var(--brand-ink)] text-white"
          radius="lg"
          size="sm"
          onPress={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "Apply"}
        </Button>
      </div>

      {/* Apply Form */}
      {showForm && (
        <Card className="mt-4 border border-slate-200 bg-white">
          <CardBody className="p-5">
            <h3 className="text-base font-semibold text-[var(--brand-ink)]">New Loan Application</h3>
            <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <FormField label="Loan Amount (₦)">
                <Input type="number" placeholder="Enter loan amount" variant="bordered" radius="lg" />
              </FormField>
              <FormField label="Repayment Period">
                <Select placeholder="Select duration" variant="bordered" radius="lg">
                  <SelectItem key="3">3 Months</SelectItem>
                  <SelectItem key="6">6 Months</SelectItem>
                  <SelectItem key="12">12 Months</SelectItem>
                  <SelectItem key="24">24 Months</SelectItem>
                </Select>
              </FormField>
              <FormField label="Purpose">
                <Textarea placeholder="Describe the purpose of this loan" variant="bordered" radius="lg" minRows={3} />
              </FormField>
              <Button type="submit" className="w-full bg-[var(--brand-ink)] text-white" radius="lg">
                Submit Application
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Loan List */}
      <div className="mt-6 space-y-3">
        {mockLoans.map((loan) => (
          <Card key={loan.id} className="border border-slate-200 bg-white">
            <CardBody className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--brand-ink)]">{loan.purpose}</p>
                  <p className="mt-1 text-xs text-slate-400">Applied on {loan.date}</p>
                </div>
                <Chip size="sm" color={statusColor[loan.status as keyof typeof statusColor]} variant="flat">
                  {loan.status}
                </Chip>
              </div>
              <Divider className="my-4" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-400">Amount</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--brand-ink)]">
                    {formatCurrency(loan.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tenor</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--brand-ink)]">
                    {loan.tenorMonths} months
                  </p>
                </div>
                {loan.remaining !== null && (
                  <div>
                    <p className="text-xs text-slate-400">Remaining</p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--brand-gold)]">
                      {formatCurrency(loan.remaining)}
                    </p>
                  </div>
                )}
              </div>
              {loan.status === "APPROVED" && (
                <Button className="mt-4 w-full bg-[var(--brand-gold)] text-[var(--brand-ink)]" radius="lg" size="sm">
                  Make Repayment
                </Button>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
