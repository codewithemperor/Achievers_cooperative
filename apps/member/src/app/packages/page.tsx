"use client";

import { useState } from "react";
import { Tabs } from "@heroui/react";
import { BriefcaseBusiness } from "lucide-react";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { MySwal, apiCallWithAlert } from "@/lib/alert";
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
  startDate?: string | null;
  endDate?: string | null;
}

interface PackageSubscription {
  id: string;
  status: string;
  amountPaid: number;
  amountRemaining: number;
  penaltyAccrued: number;
  subscribedAmount: number;
  nextDueAt?: string | null;
  createdAt: string;
  disbursementBankAccount?: {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
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

  function isExpiredPackage(pkg: PackageItem) {
    if (!pkg.endDate) return false;
    const endDate = new Date(pkg.endDate);
    if (Number.isNaN(endDate.getTime())) return false;
    endDate.setHours(23, 59, 59, 999);
    return endDate.getTime() < Date.now();
  }

  function packageStatus(pkg: PackageItem) {
    if (isExpiredPackage(pkg)) return "EXPIRED";
    return pkg.isActive ? "ACTIVE" : "INACTIVE";
  }

  function packageCtaLabel(pkg: PackageItem) {
    return isExpiredPackage(pkg) ? "Expired" : "Subscribe";
  }

  function packageTimestamp(pkg: PackageItem) {
    return pkg.endDate || new Date().toISOString();
  }

  async function showExpiredPackageAlert(pkg: PackageItem) {
    await MySwal.fire({
      icon: "warning",
      title: "Package expired",
      text: `${pkg.name} has reached its end date and can no longer accept subscriptions.`,
      confirmButtonColor: "#2d5a27",
    });
  }

  async function handleSubscribe(pkg: PackageItem) {
    if (isExpiredPackage(pkg)) {
      await showExpiredPackageAlert(pkg);
      return;
    }

    const confirmation = await MySwal.fire({
      icon: "question",
      title: "Subscribe to package?",
      text: `Do you want to subscribe to ${pkg.name}?`,
      showCancelButton: true,
      confirmButtonText: "Yes, subscribe",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#2d5a27",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const result = await apiCallWithAlert({
      title: "Package Subscription",
      loadingText: "Processing subscription...",
      apiCall: () =>
        api.post("/packages/subscriptions", {
          packageId: pkg.id,
        }),
      successTitle: "Subscribed",
      successText: `You have been subscribed to ${pkg.name}.`,
    });

    if (result) {
      await subscriptions.refetch();
    }
  }

  const activeStatuses = ["APPROVED", "DISBURSED", "IN_PROGRESS"];
  const activePackageTotal = subscriptions.data.items.reduce(
    (sum, item) =>
      activeStatuses.includes(item.status)
        ? sum + item.subscribedAmount
        : sum,
    0,
  );
  const activePackageRemaining = subscriptions.data.items.reduce(
    (sum, item) =>
      activeStatuses.includes(item.status)
        ? sum + item.amountRemaining + item.penaltyAccrued
        : sum,
    0,
  );
  const pendingPackageTotal = subscriptions.data.items.reduce(
    (sum, item) =>
      item.status === "PENDING" ? sum + item.subscribedAmount : sum,
    0,
  );
  return (
    <PullToRefresh
      className="space-y-5"
      onRefresh={async () => {
        await Promise.all([
          packages.refetch(),
          subscriptions.refetch(),
        ]);
      }}
    >
      <SummaryCard
        eyebrow="Packages"
        title="Active package balance"
        value={formatMoney(activePackageRemaining)}
        caption={`Your active package total is ${formatMoney(activePackageTotal)}, while ${formatMoney(pendingPackageTotal)} is still waiting for approval.`}
        icon={<BriefcaseBusiness className="h-5 w-5" />}
        gradient="from-[#7c3a00] via-[#5e2b00] to-[#341700]"
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
                  status={packageStatus(pkg)}
                  timestamp={packageTimestamp(pkg)}
                  onClick={() => void handleSubscribe(pkg)}
                  ctaLabel={packageCtaLabel(pkg)}
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
                  amount={
                    activeStatuses.includes(item.status)
                      ? item.subscribedAmount
                      : 0
                  }
                  status={item.status}
                  timestamp={item.nextDueAt || item.createdAt}
                  href={`/packages/${item.id}`}
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
    </PullToRefresh>
  );
}
