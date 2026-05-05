"use client";

import { useState } from "react";
import { Tabs } from "@heroui/react";
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
import { PullToRefresh } from "@/components/pull-to-refresh";
import { NumberInput, SelectInput } from "@/components/form-input";
import {
  TransactionDetailModal,
  type TransactionDetailItem,
} from "@/components/transaction-detail-modal";
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

interface WalletWithdrawal {
  id: string;
  amount: number;
  status: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  rejectionReason?: string | null;
  createdAt: string;
  disbursedAt?: string | null;
}

interface WithdrawalsPayload {
  items: WalletWithdrawal[];
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

const fundingSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
});

const withdrawalSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
  bankAccountId: z.string().min(1, "Select a bank account"),
});

type FundingFormValues = z.infer<typeof fundingSchema>;
type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

const emptyWallet: WalletPayload = {
  availableBalance: 0,
  pendingBalance: 0,
  currency: "NGN",
};
const emptyTransactions: TransactionsPayload = { items: [] };
const emptyWithdrawals: WithdrawalsPayload = { items: [] };

export default function WalletPage() {
  const wallet = useMemberData<WalletPayload>("/wallet/me", emptyWallet);
  const transactions = useMemberData<TransactionsPayload>(
    "/wallet/transactions?type=WALLET_FUNDING&limit=12",
    emptyTransactions,
  );
  const withdrawals = useMemberData<WithdrawalsPayload>(
    "/wallet/withdrawals/me",
    emptyWithdrawals,
  );
  const bankAccounts = useMemberData<BankAccount[]>("/bank-accounts", []);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [isFundingModalOpen, setIsFundingModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("funding");
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionDetailItem | null>(null);

  const { control, handleSubmit, reset } = useForm<FundingFormValues>({
    resolver: zodResolver(fundingSchema),
    defaultValues: { amount: 0 },
  });
  const {
    control: withdrawalControl,
    handleSubmit: handleWithdrawalSubmit,
    reset: resetWithdrawal,
  } = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: 0, bankAccountId: "" },
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

  async function onWithdrawalSubmit(values: WithdrawalFormValues) {
    try {
      setSubmitting(true);
      const result = await apiCallWithAlert({
        title: "Wallet Withdrawal",
        loadingText: "Submitting withdrawal request...",
        apiCall: () => api.post("/wallet/withdrawals/request", values),
        successTitle: "Request Submitted",
        successText: "Your wallet withdrawal request has been sent for review.",
      });

      if (result) {
        setIsWithdrawalModalOpen(false);
        resetWithdrawal();
        await withdrawals.refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openWithdrawalModal() {
    const defaultBank =
      bankAccounts.data.find((account) => account.isDefault)?.id ??
      bankAccounts.data[0]?.id ??
      "";
    resetWithdrawal({ amount: 0, bankAccountId: defaultBank });
    setIsWithdrawalModalOpen(true);
  }

  return (
    <PullToRefresh
      className="space-y-5"
      onRefresh={async () => {
        await Promise.all([
          wallet.refetch(),
          transactions.refetch(),
          withdrawals.refetch(),
          bankAccounts.refetch(),
        ]);
      }}
    >
      <SummaryCard
        eyebrow="Wallet"
        title="Available balance"
        value={formatMoney(wallet.data.availableBalance)}
        caption={`Pending balance: ${formatMoney(wallet.data.pendingBalance)}`}
        ctaLabel={activeTab === "withdrawals" ? "Request withdrawal" : "Add money"}
        onCtaClick={() => {
          if (activeTab === "withdrawals") {
            openWithdrawalModal();
          } else {
            reset();
            setReceiptUrl("");
            setIsFundingModalOpen(true);
          }
        }}
        icon={<Wallet className="h-5 w-5" />}
        gradient="from-[#2a2420] via-[#1f1a17] to-[#151210]"
      />

      <Tabs
        className="w-full"
        variant="secondary"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(String(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Wallet tabs">
            <Tabs.Tab id="funding">
              Funding
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="withdrawals">
              Withdrawals
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="funding" className="pt-4 outline-none">
          <section className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold font-display tracking-tight text-text-900">
                  Wallet funding
                </h2>
                <p className="text-xs text-text-500">
                  Only wallet funding requests and credits are listed here.
                </p>
              </div>
              <button
                className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white"
                onClick={() => {
                  reset();
                  setReceiptUrl("");
                  setIsFundingModalOpen(true);
                }}
                type="button"
              >
                Add money
              </button>
            </div>

            {transactions.data.items.length ? (
              transactions.data.items.map((item) => (
                <TransactionCard
                  key={item.id}
                  type={item.type}
                  title={item.description || undefined}
                  subtitle={
                    item.reference || item.source || "Wallet funding"
                  }
                  amount={item.amount}
                  status={item.status}
                  timestamp={item.createdAt}
                  onClick={() => setSelectedTransaction(item)}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-background-300 px-5 py-10 text-center text-sm text-text-400">
                Wallet funding activity will appear here once your requests
                start processing.
              </div>
            )}
          </section>
        </Tabs.Panel>

        <Tabs.Panel id="withdrawals" className="pt-4 outline-none">
          <section className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold font-display tracking-tight text-text-900">
                  Withdrawal requests
                </h2>
                <p className="text-xs text-text-500">
                  Track wallet withdrawals submitted for admin approval.
                </p>
              </div>
              <button
                className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!bankAccounts.data.length}
                onClick={openWithdrawalModal}
                type="button"
              >
                Request
              </button>
            </div>

            {bankAccounts.data.length === 0 ? (
              <div className="rounded-[20px] border border-background-200 bg-background-50 px-4 py-3 text-sm text-text-500">
                Add a bank account before requesting wallet withdrawal.
              </div>
            ) : null}

            {withdrawals.data.items.length ? (
              withdrawals.data.items.map((item) => (
                <TransactionCard
                  key={item.id}
                  type="WALLET_WITHDRAWAL"
                  title={`${item.bankName} - ${item.accountNumber}`}
                  subtitle={item.accountName}
                  amount={item.amount}
                  status={item.status}
                  timestamp={item.createdAt}
                  onClick={() =>
                    setSelectedTransaction({
                      ...item,
                      type: "WALLET_WITHDRAWAL",
                      source: "WITHDRAWAL_REQUEST",
                      reference: item.id,
                      description:
                        item.rejectionReason ||
                        `Wallet withdrawal to ${item.bankName}`,
                    })
                  }
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-background-300 px-5 py-10 text-center text-sm text-text-400">
                No wallet withdrawal requests yet.
              </div>
            )}
          </section>
        </Tabs.Panel>
      </Tabs>

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

      <MemberModal
        isOpen={isWithdrawalModalOpen}
        onClose={() => setIsWithdrawalModalOpen(false)}
        title="Request wallet withdrawal"
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
            className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Submitting..." : "Submit withdrawal request"}
          </button>
        </form>
      </MemberModal>

      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </PullToRefresh>
  );
}
