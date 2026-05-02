"use client";

import { useState } from "react";
import { Tab, TabList, TabPanel, Tabs } from "@heroui/react";
import { BriefcaseBusiness } from "lucide-react";
import { apiCallWithAlert } from "@/lib/alert";
import api from "@/lib/member-api";
import { useMemberData } from "@/hooks/use-member-data";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { formatMoney } from "@/lib/member-format";

interface PackageItem {
  id: string;
  name: string;
  totalAmount: number;
  durationMonths: number;
  penaltyType: string;
  penaltyValue: number;
  penaltyFrequency: string;
  isActive: boolean;
}

interface PackageSubscription {
  id: string;
  status: string;
  amountPaid: number;
  amountRemaining: number;
  penaltyAccrued: number;
  nextDueAt?: string | null;
  createdAt: string;
  totalAmount: number;
  package: PackageItem;
}

interface PackagesResponse {
  items: PackageItem[];
}

interface PackageSubscriptionsResponse {
  items: PackageSubscription[];
}

export default function PackagesPage() {
  const [activeTab, setActiveTab] = useState("packages");
  const packages = useMemberData<PackagesResponse>("/packages", { items: [] });
  const subscriptions = useMemberData<PackageSubscriptionsResponse>("/packages/my-subscriptions", { items: [] });

  async function handleSubscribe(pkg: PackageItem) {
    const result = await apiCallWithAlert({
      title: "Package Subscription",
      loadingText: "Processing subscription...",
      apiCall: () => api.post("/packages/subscriptions", { packageId: pkg.id }),
      successTitle: "Subscribed",
      successText: `You have been subscribed to ${pkg.name}.`,
    });

    if (result) {
      await subscriptions.refetch();
    }
  }

  const totalSubscribed = subscriptions.data.items.reduce((sum, item) => sum + item.amountPaid, 0);
  const totalOutstanding = subscriptions.data.items.reduce((sum, item) => sum + item.amountRemaining + item.penaltyAccrued, 0);

  return (
    <div className="space-y-5">
      <SummaryCard
        eyebrow="Packages"
        title="Subscribed amount"
        value={formatMoney(totalSubscribed)}
        caption={`Outstanding: ${formatMoney(totalOutstanding)}`}
        icon={<BriefcaseBusiness className="h-5 w-5" />}
        gradient="from-[#1f8f5c] via-[#169368] to-[#0f6f61]"
      />

      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <Tabs aria-label="Packages and subscriptions" className="w-full" selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(String(key))}>
          <TabList className="grid w-full grid-cols-2 rounded-2xl bg-[var(--background-100)] p-1 dark:bg-white/8">
            <Tab
              id="packages"
              className={`rounded-2xl border px-4 py-2 text-sm font-medium outline-none transition ${
                activeTab === "packages"
                  ? "border-[var(--primary-600)] bg-[var(--primary-600)] text-white shadow-sm"
                  : "border-transparent text-[var(--text-600)] dark:text-[var(--text-300)]"
              }`}
            >
              Packages
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

          <TabPanel id="packages" className="px-0 pt-4 outline-none">
            <div className="space-y-3">
              {packages.data.items.length ? (
                packages.data.items.map((pkg) => (
                  <TransactionCard
                    key={pkg.id}
                    type="PACKAGE"
                    title={pkg.name}
                    subtitle={`${pkg.durationMonths} months${pkg.penaltyValue > 0 ? ` • ${pkg.penaltyType} penalty` : ""}`}
                    amount={pkg.totalAmount}
                    status={pkg.isActive ? "ACTIVE" : "INACTIVE"}
                    timestamp={new Date().toISOString()}
                    onClick={() => void handleSubscribe(pkg)}
                    ctaLabel="Subscribe"
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
                  No packages are available right now.
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel id="transactions" className="px-0 pt-4 outline-none">
            <div className="space-y-3">
              {subscriptions.data.items.length ? (
                subscriptions.data.items.map((item) => (
                  <TransactionCard
                    key={item.id}
                    type="PACKAGE"
                    title={item.package.name}
                    subtitle={`Paid ${formatMoney(item.amountPaid)} • Remaining ${formatMoney(item.amountRemaining)}`}
                    amount={item.totalAmount}
                    status={item.status}
                    timestamp={item.nextDueAt || item.createdAt}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
                  No package subscriptions yet.
                </div>
              )}
            </div>
          </TabPanel>
        </Tabs>
      </section>
    </div>
  );
}
