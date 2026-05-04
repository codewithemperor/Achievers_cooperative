"use client";

import { useState } from "react";
import { Tabs } from "@heroui/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { PiggyBank } from "lucide-react";
import { MemberModal } from "@/components/member-modal";
import { NumberInput, SelectInput } from "@/components/form-input";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { apiCallWithAlert } from "@/lib/alert";
import api from "@/lib/member-api";
import { useMemberData } from "@/hooks/use-member-data";
import { formatMoney } from "@/lib/member-format";

interface SavingsAccount {
  id: string;
  balance: number;
  contributionFrequency: string;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  description?: string;
  status: string;
  createdAt: string;
}

interface TransactionsPayload {
  items: WalletTransaction[];
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
}

interface WithdrawalRequestsPayload {
  items: WithdrawalRequest[];
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

const contributionSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
});

const withdrawalSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
  bankAccountId: z.string().min(1, "Select a bank account"),
});

type ContributionFormValues = z.infer<typeof contributionSchema>;
type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

export default function SavingsPage() {
  const savings = useMemberData<SavingsAccount[]>("/savings/me", []);
  const transactions = useMemberData<TransactionsPayload>(
    "/wallet/transactions?type=SAVINGS",
    { items: [] },
  );
  const withdrawals = useMemberData<WithdrawalRequestsPayload>(
    "/savings/withdrawals/me",
    { items: [] },
  );
  const bankAccounts = useMemberData<BankAccount[]>("/bank-accounts", []);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("transactions");

  const { control, handleSubmit, reset } = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { amount: 0 },
  });
  const {
    control: withdrawalControl,
    handleSubmit: handleWithdrawalSubmit,
    reset: resetWithdrawal,
  } = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: 0,
      bankAccountId: "",
    },
  });

  async function onSubmit(values: ContributionFormValues) {
    await apiCallWithAlert({
      title: "Savings Contribution",
      loadingText: "Processing contribution...",
      apiCall: () => api.post("/savings/contribute", { amount: values.amount }),
      successTitle: "Contribution Saved",
      successText: `${formatMoney(values.amount)} has been added to your savings.`,
    });
    setIsContributionModalOpen(false);
    reset();
    await savings.refetch();
    await transactions.refetch();
  }

  async function onWithdrawalSubmit(values: WithdrawalFormValues) {
    await apiCallWithAlert({
      title: "Savings Withdrawal",
      loadingText: "Submitting withdrawal request...",
      apiCall: () => api.post("/savings/withdrawals/request", values),
      successTitle: "Request Submitted",
      successText:
        "Your savings withdrawal request has been submitted for review.",
    });
    setIsWithdrawalModalOpen(false);
    resetWithdrawal();
    await withdrawals.refetch();
  }

  const primaryAccount = savings.data[0];
  const savingsTransactions = transactions.data.items.filter((item) =>
    item.type.toUpperCase().includes("SAVING"),
  );

  return (
    <div className="space-y-5">
      <SummaryCard
        eyebrow="Savings"
        title="Current savings balance"
        value={formatMoney(primaryAccount?.balance ?? 0)}
        caption={`Contribution frequency: ${primaryAccount?.contributionFrequency || "MONTHLY"}`}
        ctaLabel="Save now"
        onCtaClick={() => {
          reset();
          setIsContributionModalOpen(true);
        }}
        icon={<PiggyBank className="h-5 w-5" />}
        gradient="from-[#2a0a0a] via-[#200808] to-[#160505]"
      />

      <div className="flex gap-3">
        <button
          className="min-h-11 rounded-2xl border border-background-200 px-4 py-3 text-sm font-semibold text-text-900 dark:border-white/10 dark:text-text-50"
          onClick={() => {
            const defaultBank =
              bankAccounts.data.find((account) => account.isDefault)?.id ??
              bankAccounts.data[0]?.id ??
              "";
            resetWithdrawal({ amount: 0, bankAccountId: defaultBank });
            setIsWithdrawalModalOpen(true);
          }}
          type="button"
          disabled={!bankAccounts.data.length}
        >
          Request Withdrawal
        </button>
      </div>

      {bankAccounts.data.length === 0 ? (
        <section className="rounded-[20px] border border-background-200 bg-background-50 px-4 py-3 dark:border-white/8 dark:bg-background-100">
          <h2 className="text-sm font-semibold text-text-900 dark:text-text-50">
            Bank account required
          </h2>
          <p className="mt-0.5 text-xs text-text-400">
            Add a saved bank account before requesting a savings withdrawal.
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
          <Tabs.List aria-label="Savings activity tabs">
            <Tabs.Tab id="transactions">
              <Tabs.Separator />
              Savings Transactions
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="withdrawals">
              <Tabs.Separator />
              Withdrawal Requests
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="transactions" className="pt-4 outline-none">
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold font-display tracking-tight text-text-900">
                Savings transactions
              </h2>
              <p className="text-xs text-text-500">
                Every contribution appears here without wallet funding noise.
              </p>
            </div>

            {savingsTransactions.length ? (
              savingsTransactions.map((tx) => (
                <TransactionCard
                  key={tx.id}
                  type={tx.type}
                  title={tx.description || undefined}
                  subtitle="Savings contribution"
                  amount={tx.amount}
                  status={tx.status}
                  timestamp={tx.createdAt}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-background-300 px-5 py-10 text-center text-sm text-text-400">
                No savings transactions yet. Make your first contribution above.
              </div>
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="withdrawals" className="pt-4 outline-none">
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold font-display tracking-tight text-text-900">
                Withdrawal requests
              </h2>
              <p className="text-xs text-text-500">
                Track all pending and processed savings withdrawals.
              </p>
            </div>

            {withdrawals.data.items.length ? (
              withdrawals.data.items.map((request) => (
                <TransactionCard
                  key={request.id}
                  type="SAVINGS"
                  title={`${request.bankName} · ${request.accountNumber}`}
                  subtitle={request.accountName}
                  amount={request.amount}
                  status={request.status}
                  timestamp={request.createdAt}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-background-300 px-5 py-10 text-center text-sm text-text-400">
                No withdrawal requests yet.
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      <MemberModal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
        title="Savings contribution"
        description="Enter the amount you want to move into savings."
      >
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <NumberInput
            control={control}
            name="amount"
            label="Contribution amount"
            placeholder="Enter amount"
            isRequired
            min={1}
            formatOptions={{
              style: "currency",
              currency: "NGN",
              maximumFractionDigits: 0,
            }}
          />
          <button
            className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            type="submit"
          >
            Submit contribution
          </button>
        </form>
      </MemberModal>

      <MemberModal
        isOpen={isWithdrawalModalOpen}
        onClose={() => setIsWithdrawalModalOpen(false)}
        title="Request savings withdrawal"
        description="Choose the saved bank account that should receive this withdrawal."
      >
        <form
          className="grid gap-4"
          onSubmit={handleWithdrawalSubmit(onWithdrawalSubmit)}
        >
          <NumberInput
            control={withdrawalControl}
            name="amount"
            label="Withdrawal amount"
            placeholder="Enter amount"
            isRequired
            min={1}
            formatOptions={{
              style: "currency",
              currency: "NGN",
              maximumFractionDigits: 0,
            }}
          />
          <SelectInput
            control={withdrawalControl}
            name="bankAccountId"
            label="Bank account"
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
            Submit withdrawal request
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
