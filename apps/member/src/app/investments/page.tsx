"use client";

import { useState } from "react";
import { Tab, TabList, TabPanel, Tabs } from "@heroui/react";
import { TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MemberModal } from "@/components/member-modal";
import { NumberInput } from "@/components/form-input";
import api from "@/lib/member-api";
import { useMemberData } from "@/hooks/use-member-data";
import { apiCallWithAlert } from "@/lib/alert";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { formatMoney } from "@/lib/member-format";

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
  maturityAmount: number;
  status: string;
  product: Product | null;
}

interface MyInvestmentsPayload {
  items: Subscription[];
}

export default function InvestmentsPage() {
  const [activeTab, setActiveTab] = useState("products");
  const products = useMemberData<Product[]>("/investments/products", []);
  const myInvestments = useMemberData<MyInvestmentsPayload>("/investments/my", { items: [] });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, reset } = useForm<{ principal: number }>({
    resolver: zodResolver(
      z.object({
        principal: z.coerce.number().positive("Enter a valid amount"),
      }),
    ),
    defaultValues: { principal: 0 },
  });

  async function onSubmit(values: { principal: number }) {
    if (!selectedProduct) return;

    try {
      setSubmitting(true);
      const result = await apiCallWithAlert({
        title: "Investment Subscription",
        loadingText: "Submitting investment...",
        apiCall: () =>
          api.post("/investments/subscribe", {
            productId: selectedProduct.id,
            principal: values.principal,
          }),
        successTitle: "Investment Confirmed",
        successText: `You invested in ${selectedProduct.name}.`,
      });

      if (result) {
        setSelectedProduct(null);
        reset();
        await myInvestments.refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const totalPrincipal = myInvestments.data.items.reduce((sum, item) => sum + item.principal, 0);
  const totalMaturity = myInvestments.data.items.reduce((sum, item) => sum + item.maturityAmount, 0);

  return (
    <div className="space-y-5">
      <SummaryCard
        eyebrow="Investments"
        title="Maturity value"
        value={formatMoney(totalMaturity)}
        caption={`Principal invested: ${formatMoney(totalPrincipal)}`}
        icon={<TrendingUp className="h-5 w-5" />}
        gradient="from-[#2a8b67] via-[#1c7865] to-[#0f6f61]"
      />

      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <Tabs aria-label="Investments and transactions" className="w-full" selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(String(key))}>
          <TabList className="grid w-full grid-cols-2 rounded-2xl bg-[var(--background-100)] p-1 dark:bg-white/8">
            <Tab
              id="products"
              className={`rounded-2xl border px-4 py-2 text-sm font-medium outline-none transition ${
                activeTab === "products"
                  ? "border-[var(--primary-600)] bg-[var(--primary-600)] text-white shadow-sm"
                  : "border-transparent text-[var(--text-600)] dark:text-[var(--text-300)]"
              }`}
            >
              Investments
            </Tab>
            <Tab
              id="transactions"
              className={`rounded-2xl border px-4 py-2 text-sm font-medium outline-none transition ${
                activeTab === "transactions"
                  ? "border-[var(--primary-600)] bg-[var(--primary-600)] text-white shadow-sm"
                  : "border-transparent text-[var(--text-600)] dark:text-[var(--text-300)]"
              }`}
            >
              Transactions
            </Tab>
          </TabList>

          <TabPanel id="products" className="px-0 pt-4 outline-none">
            <div className="space-y-3">
              {products.data.length ? (
                products.data.map((product) => (
                  <TransactionCard
                    key={product.id}
                    type="INVESTMENT"
                    title={product.name}
                    subtitle={`${product.durationMonths} months • ${product.annualRate}% p.a.`}
                    amount={product.minimumAmount}
                    status={product.status}
                    timestamp={new Date().toISOString()}
                    onClick={() => {
                      setSelectedProduct(product);
                      reset({ principal: product.minimumAmount });
                    }}
                    ctaLabel="Invest now"
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
                  No investment products are available right now.
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel id="transactions" className="px-0 pt-4 outline-none">
            <div className="space-y-3">
              {myInvestments.data.items.length ? (
                myInvestments.data.items.map((item) => (
                  <TransactionCard
                    key={item.id}
                    type="INVESTMENT"
                    title={item.product?.name || "Investment"}
                    subtitle={`Maturity amount ${formatMoney(item.maturityAmount)}`}
                    amount={item.principal}
                    status={item.status}
                    timestamp={item.maturityDate}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
                  You do not have any active investments yet.
                </div>
              )}
            </div>
          </TabPanel>
        </Tabs>
      </section>

      <MemberModal
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct ? `Invest in ${selectedProduct.name}` : "Invest"}
        description={
          selectedProduct
            ? `Minimum ${formatMoney(selectedProduct.minimumAmount)} for ${selectedProduct.durationMonths} months at ${selectedProduct.annualRate}% p.a.`
            : undefined
        }
      >
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <NumberInput
            control={control}
            name="principal"
            label="Investment amount"
            placeholder="Enter amount to invest"
            isRequired
            min={selectedProduct?.minimumAmount ?? 1}
            formatOptions={{ style: "currency", currency: "NGN", maximumFractionDigits: 0 }}
          />
          <button
            className="min-h-[44px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Submitting..." : "Confirm investment"}
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
