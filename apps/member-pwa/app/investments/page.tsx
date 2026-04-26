"use client";

import { useState } from "react";
import { MemberModal } from "../components/member-modal";
import { getApiBaseUrl, getMemberToken } from "../lib/member-api";
import { useMemberData } from "../lib/use-member-data";

interface Product {
  id: string;
  name: string;
  annualRate: number;
  minimumAmount: number;
  durationMonths: number;
  status: string;
}

interface Subscription {
  id: string;
  principal: number;
  maturityDate: string;
  status: string;
  product: Product | null;
}

interface MyInvestmentsPayload {
  items: Subscription[];
}

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function InvestmentsPage() {
  const products = useMemberData<Product[]>("/investments/products", []);
  const myInvestments = useMemberData<MyInvestmentsPayload>("/investments/my", { items: [] });
  const [subscription, setSubscription] = useState({ productId: "", principal: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  async function subscribe() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/investments/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getMemberToken() ? { Authorization: `Bearer ${getMemberToken()}` } : {}),
        },
        body: JSON.stringify({
          productId: subscription.productId,
          principal: Number(subscription.principal),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to subscribe");
      }
      setMessage("Investment subscription created successfully.");
      setSubscription({ productId: "", principal: "" });
      setSelectedProduct(null);
    } catch (error: any) {
      setMessage(error?.message || "Unable to subscribe right now.");
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-[var(--brand-ink)]">Investments</h1>
        <p className="mt-1 text-sm text-[var(--brand-moss)]">Browse active products and subscribe using your wallet balance.</p>
      </section>

      {message ? (
        <div className="rounded-[1.5rem] border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)]">
          {message}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Available products</h2>
        <div className="mt-4 space-y-3">
          {products.data.map((product) => (
            <div key={product.id} className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[var(--brand-ink)]">{product.name}</p>
                  <p className="mt-1 text-xs text-[var(--brand-moss)]">
                    {product.durationMonths} months / Min {money.format(product.minimumAmount)}
                  </p>
                </div>
                <p className="rounded-full bg-[var(--brand-green-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand-green)]">
                  {product.annualRate}% p.a.
                </p>
              </div>
              <div className="mt-4">
                <button
                  className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white"
                  onClick={() => {
                    setSelectedProduct(product);
                    setSubscription({ productId: product.id, principal: "" });
                  }}
                  type="button"
                >
                  Invest now
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--brand-ink)]">My subscriptions</h2>
        <div className="mt-4 space-y-3">
          {myInvestments.data.items.length ? (
            myInvestments.data.items.map((item) => (
              <div key={item.id} className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
                <p className="font-semibold text-[var(--brand-ink)]">{item.product?.name || "Investment"}</p>
                <p className="mt-1 text-sm text-[var(--brand-ink)]">{money.format(item.principal)}</p>
                <p className="mt-1 text-xs text-[var(--brand-moss)]">Matures {new Date(item.maturityDate).toLocaleDateString("en-NG")}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-[var(--brand-stroke)] bg-white p-6 text-sm text-[var(--brand-moss)]">
              You do not have any active investments yet.
            </div>
          )}
        </div>
      </section>

      <MemberModal
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct ? `Invest in ${selectedProduct.name}` : "Invest"}
        description={
          selectedProduct
            ? `Minimum ${money.format(selectedProduct.minimumAmount)} for ${selectedProduct.durationMonths} months at ${selectedProduct.annualRate}% p.a.`
            : undefined
        }
      >
        <div className="grid gap-4">
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            min={selectedProduct?.minimumAmount ?? 0}
            onChange={(event) =>
              setSubscription((current) => ({
                ...current,
                principal: event.target.value,
                productId: selectedProduct?.id || current.productId,
              }))
            }
            placeholder="Enter amount to invest"
            type="number"
            value={subscription.principal}
          />
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => void subscribe()}
            type="button"
          >
            Confirm investment
          </button>
        </div>
      </MemberModal>
    </div>
  );
}
