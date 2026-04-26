"use client";

import { useState } from "react";
import { MemberModal } from "../components/member-modal";
import { getApiBaseUrl, getMemberToken, uploadMemberImage } from "../lib/member-api";
import { useMemberData } from "../lib/use-member-data";

interface WalletPayload {
  availableBalance: number;
  pendingBalance: number;
  currency: string;
}

interface TransactionsPayload {
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    createdAt: string;
  }>;
}

const emptyWallet: WalletPayload = { availableBalance: 0, pendingBalance: 0, currency: "NGN" };
const emptyTransactions: TransactionsPayload = { items: [] };
const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function WalletPage() {
  const wallet = useMemberData<WalletPayload>("/wallet/me", emptyWallet);
  const transactions = useMemberData<TransactionsPayload>("/wallet/transactions?limit=12", emptyTransactions);
  const [funding, setFunding] = useState({ amount: "", receiptUrl: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [isFundingModalOpen, setIsFundingModalOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  async function onUploadReceipt(file: File | null) {
    if (!file) return;

    try {
      setUploadingReceipt(true);
      const upload = await uploadMemberImage(file, "payment-receipt");
      setFunding((current) => ({ ...current, receiptUrl: upload.url }));
    } catch {
      setMessage("Unable to upload receipt right now.");
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function submitFundingRequest() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getMemberToken() ? { Authorization: `Bearer ${getMemberToken()}` } : {}),
        },
        body: JSON.stringify({
          amount: Number(funding.amount),
          receiptUrl: funding.receiptUrl || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to submit funding request");
      }

      setMessage("Funding request submitted for admin review.");
      setFunding({ amount: "", receiptUrl: "" });
      setIsFundingModalOpen(false);
    } catch {
      setMessage("Unable to submit funding request right now.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[linear-gradient(145deg,#17321e,#2d5a27)] p-6 text-white">
        <p className="text-xs uppercase tracking-[0.18em] text-white/70">Wallet</p>
        <p className="mt-2 text-3xl font-semibold">{money.format(wallet.data.availableBalance)}</p>
        <p className="mt-2 text-sm text-white/70">Pending deductions: {money.format(wallet.data.pendingBalance)}</p>
      </section>

      {message ? (
        <div className="rounded-[1.5rem] border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)]">
          {message}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Fund wallet</h2>
            <p className="mt-2 text-sm text-[var(--brand-moss)]">
              Submit a funding receipt for admin approval. Pending deductions will auto-clear after credit where possible.
            </p>
          </div>
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => setIsFundingModalOpen(true)}
            type="button"
          >
            Add money
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Recent wallet activity</h2>
        <div className="mt-4 space-y-3">
          {transactions.data.items.length ? (
            transactions.data.items.map((item) => (
              <div key={item.id} className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[var(--brand-ink)]">{item.type.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-[var(--brand-moss)]">{item.reference || "No reference"}</p>
                    <p className="mt-1 text-xs text-[var(--brand-moss)]">{new Date(item.createdAt).toLocaleString("en-NG")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[var(--brand-ink)]">{money.format(item.amount)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">{item.status}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-[var(--brand-stroke)] bg-white p-6 text-sm text-[var(--brand-moss)]">
              Wallet activity will appear here once your member session is connected.
            </div>
          )}
        </div>
      </section>

      <MemberModal
        isOpen={isFundingModalOpen}
        onClose={() => setIsFundingModalOpen(false)}
        title="Add money to wallet"
        description="Create a wallet funding request for admin approval."
      >
        <div className="grid gap-4">
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setFunding((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Amount"
            type="number"
            value={funding.amount}
          />
          <input
            accept="image/*"
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm outline-none"
            onChange={(event) => void onUploadReceipt(event.target.files?.[0] ?? null)}
            type="file"
          />
          {funding.receiptUrl ? (
            <div className="rounded-2xl border border-[var(--brand-stroke)] bg-white p-3 text-sm text-[var(--brand-ink)]">
              Receipt uploaded successfully.
            </div>
          ) : null}
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={uploadingReceipt}
            onClick={() => void submitFundingRequest()}
            type="button"
          >
            {uploadingReceipt ? "Uploading receipt..." : "Submit funding request"}
          </button>
        </div>
      </MemberModal>
    </div>
  );
}
