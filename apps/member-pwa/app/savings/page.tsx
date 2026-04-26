"use client";

import { useState } from "react";
import { MemberModal } from "../components/member-modal";
import { getApiBaseUrl, getMemberToken } from "../lib/member-api";
import { useMemberData } from "../lib/use-member-data";

interface SavingsAccount {
  id: string;
  balance: number;
  contributionFrequency: string;
}

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function SavingsPage() {
  const savings = useMemberData<SavingsAccount[]>("/savings/me", []);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);

  async function contribute() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/savings/contribute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getMemberToken() ? { Authorization: `Bearer ${getMemberToken()}` } : {}),
        },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      if (!response.ok) {
        throw new Error("Unable to contribute");
      }
      setMessage("Savings contribution submitted successfully.");
      setAmount("");
      setIsContributionModalOpen(false);
    } catch {
      setMessage("Unable to complete savings contribution right now.");
    }
  }

  const primaryAccount = savings.data[0];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[linear-gradient(145deg,#17321e,#5f7c54)] p-6 text-white">
        <p className="text-xs uppercase tracking-[0.18em] text-white/70">Savings</p>
        <p className="mt-2 text-3xl font-semibold">{money.format(primaryAccount?.balance ?? 0)}</p>
        <p className="mt-2 text-sm text-white/70">Contribution frequency: {primaryAccount?.contributionFrequency || "MONTHLY"}</p>
      </section>

      {message ? (
        <div className="rounded-[1.5rem] border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)]">
          {message}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Make a contribution</h2>
            <p className="mt-2 text-sm text-[var(--brand-moss)]">Contribute into your savings account from a focused modal flow.</p>
          </div>
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => setIsContributionModalOpen(true)}
            type="button"
          >
            Save now
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Accounts</h2>
        <div className="mt-4 space-y-3">
          {savings.data.length ? (
            savings.data.map((item) => (
              <div key={item.id} className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
                <p className="font-semibold text-[var(--brand-ink)]">{money.format(item.balance)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">{item.contributionFrequency}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-[var(--brand-stroke)] bg-white p-6 text-sm text-[var(--brand-moss)]">
              Your savings account details will appear here after your first contribution.
            </div>
          )}
        </div>
      </section>

      <MemberModal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
        title="Savings contribution"
        description="Enter the amount you want to move into savings."
      >
        <div className="grid gap-4">
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Contribution amount"
            type="number"
            value={amount}
          />
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => void contribute()}
            type="button"
          >
            Submit contribution
          </button>
        </div>
      </MemberModal>
    </div>
  );
}
