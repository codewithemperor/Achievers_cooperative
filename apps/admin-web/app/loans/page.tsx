"use client";

import { Card, CardBody, Button, Chip, Textarea } from "@heroui/react";
import { FormField } from "@achievers/ui";
import { formatCurrency } from "@achievers/utils";
import { useState } from "react";

const mockLoans = [
  { id: "1", member: "Chidi Eze", memberNo: "ACH-000002", amount: 200000, tenorMonths: 12, purpose: "Equipment purchase", status: "PENDING", date: "Apr 6, 2026" },
  { id: "2", member: "Funke Adeyemi", memberNo: "ACH-000003", amount: 50000, tenorMonths: 3, purpose: "School fees", status: "PENDING", date: "Apr 4, 2026" },
  { id: "3", member: "Adaeze Okonkwo", memberNo: "ACH-000001", amount: 100000, tenorMonths: 6, purpose: "Business expansion", status: "APPROVED", date: "Mar 15, 2026", remaining: 75000 },
  { id: "4", member: "Emeka Nwosu", memberNo: "ACH-000004", amount: 300000, tenorMonths: 24, purpose: "Property development", status: "REJECTED", date: "Mar 10, 2026" },
];

const statusColor = {
  APPROVED: "success" as const,
  PENDING: "warning" as const,
  REJECTED: "danger" as const,
};

export default function LoansPage() {
  const [rejectId, setRejectId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">Loans</h1>
        <p className="mt-1 text-sm text-slate-500">Review loan applications and manage disbursements</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Applications", value: "48", color: "bg-[var(--brand-ink)]" },
          { label: "Pending Review", value: "5", color: "bg-yellow-500" },
          { label: "Active Loans", value: "34", color: "bg-green-500" },
          { label: "Outstanding", value: "₦4.2M", color: "bg-[var(--brand-gold)]" },
        ].map((stat) => (
          <Card key={stat.label} className="border border-slate-200 bg-white">
            <CardBody className="p-4">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${stat.color}`} />
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
              <p className="mt-1 text-xl font-bold text-[var(--brand-ink)]">{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Loans */}
      <Card className="border border-slate-200 bg-white">
        <CardBody className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Member</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Amount</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Tenor</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Purpose</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Date</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockLoans.map((loan) => (
                  <tr key={loan.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[var(--brand-ink)]">{loan.member}</p>
                      <p className="text-xs text-slate-400">{loan.memberNo}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold">{formatCurrency(loan.amount)}</td>
                    <td className="px-5 py-3 text-slate-600">{loan.tenorMonths} months</td>
                    <td className="px-5 py-3 text-slate-600">{loan.purpose}</td>
                    <td className="px-5 py-3">
                      <Chip size="sm" color={statusColor[loan.status as keyof typeof statusColor]} variant="flat">
                        {loan.status}
                      </Chip>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{loan.date}</td>
                    <td className="px-5 py-3 text-right">
                      {loan.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <button className="rounded-lg bg-green-50 px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-100">
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectId(rejectId === loan.id ? null : loan.id)}
                            className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {loan.status === "APPROVED" && (
                        <button className="rounded-lg bg-[var(--brand-gold)] px-3 py-1 text-xs font-medium text-[var(--brand-ink)] hover:opacity-90">
                          Disburse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-4 md:hidden">
            {mockLoans.map((loan) => (
              <div key={loan.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-[var(--brand-ink)]">{loan.member}</p>
                  <Chip size="sm" color={statusColor[loan.status as keyof typeof statusColor]} variant="flat">{loan.status}</Chip>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-400">Amount: </span><span className="font-medium">{formatCurrency(loan.amount)}</span></div>
                  <div><span className="text-slate-400">Tenor: </span><span>{loan.tenorMonths} months</span></div>
                  <div className="col-span-2"><span className="text-slate-400">Purpose: </span>{loan.purpose}</div>
                </div>
                {loan.status === "PENDING" && (
                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 rounded-lg bg-green-50 py-2 text-xs font-medium text-green-600">Approve</button>
                    <button className="flex-1 rounded-lg bg-red-50 py-2 text-xs font-medium text-red-500">Reject</button>
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
