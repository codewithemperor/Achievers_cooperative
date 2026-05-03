"use client";

import { useState } from "react";
import { Tabs } from "@heroui/react";
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
  const myInvestments = useMemberData<MyInvestmentsPayload>("/investments/my", {
    items: [],
  });
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

  const totalPrincipal = myInvestments.data.items.reduce(
    (sum, item) => sum + item.principal,
    0,
  );
  const totalMaturity = myInvestments.data.items.reduce(
    (sum, item) => sum + item.maturityAmount,
    0,
  );

  return (
    <div className="space-y-5">
      <SummaryCard
        eyebrow="Investments"
        title="Maturity value"
        value={formatMoney(totalMaturity)}
        caption={`Principal invested: ${formatMoney(totalPrincipal)}`}
        icon={<TrendingUp className="h-5 w-5" />}
        gradient="from-[#16112e] via-[#110d26] to-[#0c081e]"
      />

      <Tabs
        className="w-full"
        variant="secondary"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(String(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Investments and subscriptions">
            <Tabs.Tab id="products">
              Products
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="transactions">
              My Investments
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="products" className="pt-4 outline-none">
          <div className="space-y-2">
            {products.data.length ? (
              products.data.map((product) => (
                <TransactionCard
                  key={product.id}
                  type="INVESTMENT"
                  title={product.name}
                  subtitle={`${product.durationMonths} months · ${product.annualRate}% p.a.`}
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
              <div className="rounded-[20px] border border-dashed border-background-300 dark:border-white/10 px-5 py-10 text-center text-sm text-text-400">
                No investment products are available right now.
              </div>
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="transactions" className="pt-4 outline-none">
          <div className="space-y-2">
            {myInvestments.data.items.length ? (
              myInvestments.data.items.map((item) => (
                <TransactionCard
                  key={item.id}
                  type="INVESTMENT"
                  title={item.product?.name || "Investment"}
                  subtitle={`Matures at ${formatMoney(item.maturityAmount)}`}
                  amount={item.principal}
                  status={item.status}
                  timestamp={item.maturityDate}
                />
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-background-300 dark:border-white/10 px-5 py-10 text-center text-sm text-text-400">
                You do not have any active investments yet.
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      <MemberModal
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct ? `Invest in ${selectedProduct.name}` : "Invest"}
        description={
          selectedProduct
            ? `Minimum ${formatMoney(selectedProduct.minimumAmount)} · ${selectedProduct.durationMonths} months · ${selectedProduct.annualRate}% p.a.`
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
            formatOptions={{
              style: "currency",
              currency: "NGN",
              maximumFractionDigits: 0,
            }}
          />
          <button
            className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
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
