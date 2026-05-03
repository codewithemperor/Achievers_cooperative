"use client";

import { useState } from "react";
import { Tabs } from "@heroui/react";
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
  const subscriptions = useMemberData<PackageSubscriptionsResponse>(
    "/packages/my-subscriptions",
    { items: [] },
  );

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

  const totalSubscribed = subscriptions.data.items.reduce(
    (sum, item) => sum + item.amountPaid,
    0,
  );
  const totalOutstanding = subscriptions.data.items.reduce(
    (sum, item) => sum + item.amountRemaining + item.penaltyAccrued,
    0,
  );

  return (
    <div className="space-y-5">
      <SummaryCard
        eyebrow="Packages"
        title="Subscribed amount"
        value={formatMoney(totalSubscribed)}
        caption={`Outstanding: ${formatMoney(totalOutstanding)}`}
        icon={<BriefcaseBusiness className="h-5 w-5" />}
        gradient="from-[#16112e] via-[#110d26] to-[#0c081e]"
      />

      <Tabs
        className="w-full"
        variant="secondary"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(String(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Packages and subscriptions">
            <Tabs.Tab id="packages">
              Packages
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="transactions">
              Subscriptions
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="packages" className="pt-4 outline-none">
          <div className="space-y-2">
            {packages.data.items.length ? (
              packages.data.items.map((pkg) => (
                <TransactionCard
                  key={pkg.id}
                  type="PACKAGE"
                  title={pkg.name}
                  subtitle={`${pkg.durationMonths} months${pkg.penaltyValue > 0 ? ` · ${pkg.penaltyType} penalty` : ""}`}
                  amount={pkg.totalAmount}
                  status={pkg.isActive ? "ACTIVE" : "INACTIVE"}
                  timestamp={new Date().toISOString()}
                  onClick={() => void handleSubscribe(pkg)}
                  ctaLabel="Subscribe"
                />
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-background-300 dark:border-white/10 px-5 py-10 text-center text-sm text-text-400">
                No packages are available right now.
              </div>
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="transactions" className="pt-4 outline-none">
          <div className="space-y-2">
            {subscriptions.data.items.length ? (
              subscriptions.data.items.map((item) => (
                <TransactionCard
                  key={item.id}
                  type="PACKAGE"
                  title={item.package.name}
                  subtitle={`Paid ${formatMoney(item.amountPaid)} · Remaining ${formatMoney(item.amountRemaining)}`}
                  amount={item.totalAmount}
                  status={item.status}
                  timestamp={item.nextDueAt || item.createdAt}
                />
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-background-300 dark:border-white/10 px-5 py-10 text-center text-sm text-text-400">
                No package subscriptions yet.
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
