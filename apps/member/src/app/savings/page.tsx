"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { PiggyBank } from "lucide-react";
import { MemberModal } from "@/components/member-modal";
import { NumberInput } from "@/components/form-input";
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

const contributionSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
});

type ContributionFormValues = z.infer<typeof contributionSchema>;

export default function SavingsPage() {
  const savings = useMemberData<SavingsAccount[]>("/savings/me", []);
  const transactions = useMemberData<TransactionsPayload>("/wallet/transactions?type=SAVINGS", { items: [] });
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);

  const { control, handleSubmit, reset } = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { amount: 0 },
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

  const primaryAccount = savings.data[0];

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
        gradient="from-[#22a163] via-[#1b8f64] to-[#0f6f61]"
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">Savings transactions</h2>
          <p className="mt-1 text-sm text-[var(--text-400)]">Every contribution appears as a shared transaction card.</p>
        </div>

        {transactions.data.items.length ? (
          transactions.data.items.map((tx) => (
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
          <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
            No savings transactions yet. Make your first contribution above.
          </div>
        )}
      </section>

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
            formatOptions={{ style: "currency", currency: "NGN", maximumFractionDigits: 0 }}
          />
          <button
            className="min-h-[44px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            type="submit"
          >
            Submit contribution
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
