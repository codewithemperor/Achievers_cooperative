"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Tabs } from "@heroui/react";
import { BriefcaseBusiness } from "lucide-react";
import { MemberModal } from "@/components/member-modal";
import { SelectInput } from "@/components/form-input";
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

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

interface SubscriptionFormValues {
  disbursementBankAccountId: string;
}

export default function PackagesPage() {
  const [activeTab, setActiveTab] = useState("packages");
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(
    null,
  );
  const packages = useMemberData<PackagesResponse>("/packages", { items: [] });
  const subscriptions = useMemberData<PackageSubscriptionsResponse>(
    "/packages/my-subscriptions",
    { items: [] },
  );
  const bankAccounts = useMemberData<BankAccount[]>("/bank-accounts", []);
  const { control, handleSubmit, reset } = useForm<SubscriptionFormValues>({
    defaultValues: { disbursementBankAccountId: "" },
  });

  async function handleSubscribe(values: SubscriptionFormValues) {
    if (!selectedPackage) return;

    const result = await apiCallWithAlert({
      title: "Package Subscription",
      loadingText: "Processing subscription...",
      apiCall: () =>
        api.post("/packages/subscriptions", {
          packageId: selectedPackage.id,
          disbursementBankAccountId:
            values.disbursementBankAccountId || undefined,
        }),
      successTitle: "Subscribed",
      successText: `You have been subscribed to ${selectedPackage.name}.`,
    });

    if (result) {
      setSelectedPackage(null);
      reset({ disbursementBankAccountId: "" });
      await subscriptions.refetch();
    }
  }

  const totalSubscribed = subscriptions.data.items.reduce(
    (sum, item) => sum + item.subscribedAmount,
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
        gradient="from-[#7c3a00] via-[#5e2b00] to-[#341700]"
      />

      {bankAccounts.data.length === 0 ? (
        <section className="rounded-[20px] border border-background-200 dark:border-white/8 bg-background-50 dark:bg-background-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-text-900 dark:text-text-50">
            Bank account required
          </h2>
          <p className="mt-0.5 text-xs text-text-400">
            Add a bank account before creating a package subscription so your
            disbursement account can be linked correctly.
          </p>
        </section>
      ) : null}

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
                  onClick={() => {
                    if (!bankAccounts.data.length) return;
                    const defaultBank =
                      bankAccounts.data.find((account) => account.isDefault)
                        ?.id ??
                      bankAccounts.data[0]?.id ??
                      "";
                    reset({ disbursementBankAccountId: defaultBank });
                    setSelectedPackage(pkg);
                  }}
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
                  amount={item.subscribedAmount}
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

      <MemberModal
        isOpen={Boolean(selectedPackage)}
        onClose={() => setSelectedPackage(null)}
        title="Package subscription"
        description="Choose the bank account linked to this package subscription before you continue."
      >
        <form className="grid gap-4" onSubmit={handleSubmit(handleSubscribe)}>
          <SelectInput
            control={control}
            name="disbursementBankAccountId"
            label="Disbursement bank account"
            placeholder="Select a bank account"
            options={bankAccounts.data.map((account) => ({
              id: account.id,
              label: `${account.bankName} - ${account.accountNumber.slice(-4)}`,
            }))}
            isRequired
          />
          <button
            className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            type="submit"
          >
            Confirm subscription
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
