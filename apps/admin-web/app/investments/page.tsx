"use client";

import { Card, Button, Chip } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";
import { useState } from "react";

const mockProducts = [
  {
    id: "1",
    name: "Achievers Fixed Deposit",
    annualRate: 12,
    minimumAmount: 50000,
    durationMonths: 6,
    status: "ACTIVE",
    subscribers: 23,
    totalInvested: 1150000,
  },
  {
    id: "2",
    name: "Achievers Growth Fund",
    annualRate: 18,
    minimumAmount: 100000,
    durationMonths: 12,
    status: "ACTIVE",
    subscribers: 15,
    totalInvested: 3200000,
  },
];

const mockSubscriptions = [
  {
    id: "1",
    member: "Adaeze Okonkwo",
    product: "Fixed Deposit",
    principal: 50000,
    maturityDate: "Oct 2026",
    status: "APPROVED",
  },
  {
    id: "2",
    member: "Chidi Eze",
    product: "Growth Fund",
    principal: 100000,
    maturityDate: "Apr 2027",
    status: "APPROVED",
  },
  {
    id: "3",
    member: "Yusuf Abdullahi",
    product: "Growth Fund",
    principal: 200000,
    maturityDate: "Apr 2027",
    status: "PENDING",
  },
];

const statusColor = {
  APPROVED: "success" as const,
  PENDING: "warning" as const,
  REJECTED: "danger" as const,
  ACTIVE: "success" as const,
  INACTIVE: "default" as const,
};

export default function InvestmentsPage() {
  const [tab, setTab] = useState<"products" | "subscriptions">("subscriptions");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">
          Investments
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage investment products and subscriptions
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("subscriptions")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "subscriptions" ? "bg-[var(--brand-ink)] text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
        >
          Subscriptions ({mockSubscriptions.length})
        </button>
        <button
          onClick={() => setTab("products")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "products" ? "bg-[var(--brand-ink)] text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
        >
          Products ({mockProducts.length})
        </button>
      </div>

      {tab === "subscriptions" && (
        <Card className="border border-slate-200 bg-white">
          <Card.Content className="p-0">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-left font-medium text-slate-500">
                      Member
                    </th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">
                      Product
                    </th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">
                      Principal
                    </th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">
                      Maturity
                    </th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right font-medium text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockSubscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--brand-ink)]">
                        {sub.member}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {sub.product}
                      </td>
                      <td className="px-5 py-3 font-semibold">
                        {formatCurrency(sub.principal)}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {sub.maturityDate}
                      </td>
                      <td className="px-5 py-3">
                        <Chip
                          size="sm"
                          color={
                            statusColor[sub.status as keyof typeof statusColor]
                          }
                          variant="flat"
                        >
                          {sub.status}
                        </Chip>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {sub.status === "PENDING" && (
                          <button className="rounded-lg bg-green-50 px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-100">
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 p-4 md:hidden">
              {mockSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-[var(--brand-ink)]">
                      {sub.member}
                    </p>
                    <Chip
                      size="sm"
                      color={
                        statusColor[sub.status as keyof typeof statusColor]
                      }
                      variant="flat"
                    >
                      {sub.status}
                    </Chip>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Product: </span>
                      {sub.product}
                    </div>
                    <div>
                      <span className="text-slate-400">Amount: </span>
                      <span className="font-medium">
                        {formatCurrency(sub.principal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Maturity: </span>
                      {sub.maturityDate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {tab === "products" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {mockProducts.map((product) => (
            <Card key={product.id} className="border border-slate-200 bg-white">
              <Card.Content className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--brand-ink)]">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {product.durationMonths} months
                    </p>
                  </div>
                  <Chip
                    size="sm"
                    color={
                      statusColor[product.status as keyof typeof statusColor]
                    }
                    variant="flat"
                  >
                    {product.status}
                  </Chip>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-[var(--brand-gold)] p-3">
                    <p className="text-lg font-bold text-[var(--brand-ink)]">
                      {product.annualRate}%
                    </p>
                    <p className="text-[10px] text-slate-600">Per Annum</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Min. Amount</p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(product.minimumAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Subscribers</p>
                    <p className="text-sm font-semibold">
                      {product.subscribers}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Total invested:{" "}
                  <span className="font-medium">
                    {formatCurrency(product.totalInvested)}
                  </span>
                </p>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
