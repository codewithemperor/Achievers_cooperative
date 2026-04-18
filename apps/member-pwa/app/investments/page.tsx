import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";

const mockProducts = [
  {
    id: "1",
    name: "Achievers Fixed Deposit",
    annualRate: 12,
    minimumAmount: 50000,
    durationMonths: 6,
    status: "ACTIVE",
  },
  {
    id: "2",
    name: "Achievers Growth Fund",
    annualRate: 18,
    minimumAmount: 100000,
    durationMonths: 12,
    status: "ACTIVE",
  },
];

const mockSubscriptions = [
  {
    id: "1",
    product: "Achievers Fixed Deposit",
    principal: 50000,
    maturityDate: "Oct 8, 2026",
    status: "APPROVED",
    expectedReturn: 53000,
  },
];

export default function InvestmentsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[var(--brand-ink)]">
        Investments
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Browse investment products and track your subscriptions
      </p>

      {/* My Investments */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--brand-ink)]">
          My Investments
        </h2>
        {mockSubscriptions.length > 0 ? (
          <div className="space-y-2">
            {mockSubscriptions.map((sub) => (
              <Card key={sub.id} className="border border-slate-200 bg-white">
                <Card.Content className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--brand-ink)]">
                        {sub.product}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Matures {sub.maturityDate}
                      </p>
                    </div>
                    <Chip size="sm" color="success" variant="soft">
                      {sub.status}
                    </Chip>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Principal</p>
                      <p className="text-sm font-semibold text-[var(--brand-ink)]">
                        {formatCurrency(sub.principal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Expected Return</p>
                      <p className="text-sm font-semibold text-green-600">
                        {formatCurrency(sub.expectedReturn)}
                      </p>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border border-dashed border-slate-300 bg-white">
            <Card.Content className="p-6 text-center">
              <p className="text-sm text-slate-400">
                You don&apos;t have any active investments yet.
              </p>
            </Card.Content>
          </Card>
        )}
      </div>

      {/* Available Products */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-[var(--brand-ink)]">
          Available Products
        </h2>
        <div className="space-y-3">
          {mockProducts.map((product) => (
            <Card key={product.id} className="border border-slate-200 bg-white">
              <Card.Content className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-[var(--brand-ink)]">
                      {product.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {product.durationMonths} months · Min.{" "}
                      {formatCurrency(product.minimumAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--brand-gold)] px-3 py-1.5 text-center">
                    <p className="text-lg font-bold text-[var(--brand-ink)]">
                      {product.annualRate}%
                    </p>
                    <p className="text-[10px] text-slate-600">per annum</p>
                  </div>
                </div>
                <button className="mt-4 w-full rounded-lg border border-[var(--brand-ink)] bg-white py-2.5 text-sm font-medium text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-ink)] hover:text-white">
                  Invest Now
                </button>
              </Card.Content>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
