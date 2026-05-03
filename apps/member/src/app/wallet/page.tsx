"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Wallet } from "lucide-react";
import api, { uploadMemberImage } from "@/lib/member-api";
import { apiCallWithAlert } from "@/lib/alert";
import { useMemberData } from "@/hooks/use-member-data";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { MemberModal } from "@/components/member-modal";
import { NumberInput } from "@/components/form-input";
import { formatMoney } from "@/lib/member-format";

interface WalletPayload {
  availableBalance: number;
  pendingBalance: number;
  currency: string;
}

interface TransactionsPayload {
  items: Array<{
    id: string;
    source: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    description?: string | null;
    createdAt: string;
  }>;
}

const fundingSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
});

type FundingFormValues = z.infer<typeof fundingSchema>;

const emptyWallet: WalletPayload = {
  availableBalance: 0,
  pendingBalance: 0,
  currency: "NGN",
};
const emptyTransactions: TransactionsPayload = { items: [] };

export default function WalletPage() {
  const wallet = useMemberData<WalletPayload>("/wallet/me", emptyWallet);
  const transactions = useMemberData<TransactionsPayload>(
    "/wallet/transactions?limit=12",
    emptyTransactions,
  );
  const [receiptUrl, setReceiptUrl] = useState("");
  const [isFundingModalOpen, setIsFundingModalOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, reset } = useForm<FundingFormValues>({
    resolver: zodResolver(fundingSchema),
    defaultValues: { amount: 0 },
  });

  async function onUploadReceipt(file: File | null) {
    if (!file) return;

    try {
      setUploadingReceipt(true);
      const upload = await uploadMemberImage(file, "payment-receipt");
      setReceiptUrl(upload.url);
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function onSubmit(values: FundingFormValues) {
    try {
      setSubmitting(true);
      const result = await apiCallWithAlert({
        title: "Funding Request",
        loadingText: "Submitting funding request...",
        apiCall: () =>
          api.post("/payments", {
            amount: values.amount,
            receiptUrl: receiptUrl || undefined,
          }),
        successTitle: "Funding Submitted",
        successText: "Your funding request has been sent for approval.",
      });

      if (result) {
        setReceiptUrl("");
        setIsFundingModalOpen(false);
        reset();
        await transactions.refetch();
        await wallet.refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SummaryCard
        eyebrow="Wallet"
        title="Available balance"
        value={formatMoney(wallet.data.availableBalance)}
        caption={`Pending balance: ${formatMoney(wallet.data.pendingBalance)}`}
        ctaLabel="Add money"
        onCtaClick={() => {
          reset();
          setReceiptUrl("");
          setIsFundingModalOpen(true);
        }}
        icon={<Wallet className="h-5 w-5" />}
        gradient="from-[#2a2420] via-[#1f1a17] to-[#151210]"
      />

      <section className="space-y-5 mt-5">
        <div>
          <h2 className="text-xl font-semibold font-display tracking-tight text-text-900">
            Wallet transactions
          </h2>
          <p className="text-xs text-text-500">
            Recent wallet activity is shown with the new shared transaction
            card.
          </p>
        </div>

        {transactions.data.items.length ? (
          transactions.data.items.map((item) => (
            <TransactionCard
              key={item.id}
              type={item.type}
              title={item.description || undefined}
              subtitle={item.reference || item.source || "Wallet transaction"}
              amount={item.amount}
              status={item.status}
              timestamp={item.createdAt}
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-background-300 px-5 py-10 text-center text-sm text-text-400">
            Wallet activity will appear here once your requests start
            processing.
          </div>
        )}
      </section>

      <MemberModal
        isOpen={isFundingModalOpen}
        onClose={() => setIsFundingModalOpen(false)}
        title="Add money to wallet"
        description="Create a wallet funding request for admin approval."
      >
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <NumberInput
            control={control}
            name="amount"
            label="Amount"
            placeholder="Enter amount"
            isRequired
            min={1}
            formatOptions={{
              style: "currency",
              currency: "NGN",
              maximumFractionDigits: 0,
            }}
          />
          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-text-700"
              htmlFor="receipt-upload"
            >
              Payment receipt
            </label>
            <input
              id="receipt-upload"
              accept="image/*"
              className="min-h-12 rounded-2xl border border-background-200 bg-white px-4 py-3 text-sm text-text-700 outline-none transition-colors focus:border-primary-400 dark:border-background-700 dark:bg-background-900 dark:text-text-300"
              onChange={(event) =>
                void onUploadReceipt(event.target.files?.[0] ?? null)
              }
              type="file"
            />
          </div>
          {receiptUrl ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              Receipt uploaded successfully.
            </div>
          ) : null}
          <button
            className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={uploadingReceipt || submitting}
            type="submit"
          >
            {uploadingReceipt
              ? "Uploading receipt..."
              : submitting
                ? "Submitting..."
                : "Submit funding request"}
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
