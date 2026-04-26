"use client";

import { useState } from "react";
import { MemberModal } from "../components/member-modal";
import { getApiBaseUrl, getMemberToken } from "../lib/member-api";
import { useMemberData } from "../lib/use-member-data";

interface LoanItem {
  id: string;
  amount: number;
  remainingBalance: number;
  amountPaidSoFar?: number;
  tenorMonths: number;
  purpose: string;
  status: string;
  repaymentProgress?: number;
}

interface LoansPayload {
  items: LoanItem[];
}

interface GuarantorPayload {
  items: Array<{
    id: string;
    fullName: string;
    membershipNumber: string;
    phoneNumber: string;
  }>;
}

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function LoansPage() {
  const loans = useMemberData<LoansPayload>("/loans", { items: [] });
  const guarantors = useMemberData<GuarantorPayload>("/members/guarantors", { items: [] });
  const [form, setForm] = useState({ amount: "", tenorMonths: "", purpose: "", guarantorOneId: "", guarantorTwoId: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  async function applyForLoan() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/loans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getMemberToken() ? { Authorization: `Bearer ${getMemberToken()}` } : {}),
        },
        body: JSON.stringify({
          amount: Number(form.amount),
          tenorMonths: Number(form.tenorMonths),
          purpose: form.purpose,
          guarantorOneId: form.guarantorOneId || undefined,
          guarantorTwoId: form.guarantorTwoId || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to apply for loan");
      }
      setMessage("Loan application submitted successfully.");
      setForm({ amount: "", tenorMonths: "", purpose: "", guarantorOneId: "", guarantorTwoId: "" });
      setIsLoanModalOpen(false);
    } catch (error: any) {
      setMessage(error?.message || "Unable to apply for loan right now.");
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-[var(--brand-ink)]">Loans</h1>
        <p className="mt-1 text-sm text-[var(--brand-moss)]">Apply for a new facility and track active balances from the same member workspace.</p>
      </section>

      {message ? (
        <div className="rounded-[1.5rem] border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)]">
          {message}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Apply for a loan</h2>
            <p className="mt-2 text-sm text-[var(--brand-moss)]">Open the application modal when you are ready to submit a new facility request.</p>
          </div>
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => setIsLoanModalOpen(true)}
            type="button"
          >
            New application
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--brand-ink)]">My loans</h2>
        <div className="mt-4 space-y-3">
          {loans.data.items.length ? (
            loans.data.items.map((loan) => (
              <div key={loan.id} className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[var(--brand-ink)]">{loan.purpose}</p>
                    <p className="mt-1 text-xs text-[var(--brand-moss)]">{loan.tenorMonths} months</p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">{loan.status}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-[var(--brand-moss)]">Amount</p>
                    <p className="mt-1 font-semibold text-[var(--brand-ink)]">{money.format(loan.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--brand-moss)]">Paid</p>
                    <p className="mt-1 font-semibold text-[var(--brand-ink)]">{money.format(loan.amountPaidSoFar ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--brand-moss)]">Remaining</p>
                    <p className="mt-1 font-semibold text-[var(--brand-ink)]">{money.format(loan.remainingBalance ?? loan.amount)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-[var(--brand-stroke)] bg-white p-6 text-sm text-[var(--brand-moss)]">
              You have not created any loan applications yet.
            </div>
          )}
        </div>
      </section>

      <MemberModal
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        title="Loan application"
        description="Provide the amount, tenor, purpose, and up to two guarantors for your request."
      >
        <div className="grid gap-4">
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Amount"
            type="number"
            value={form.amount}
          />
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setForm((current) => ({ ...current, tenorMonths: event.target.value }))}
            placeholder="Tenor in months"
            type="number"
            value={form.tenorMonths}
          />
          <textarea
            className="min-h-28 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm outline-none"
            onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
            placeholder="Purpose of the loan"
            value={form.purpose}
          />
          <select
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setForm((current) => ({ ...current, guarantorOneId: event.target.value }))}
            value={form.guarantorOneId}
          >
            <option value="">Select guarantor 1</option>
            {guarantors.data.items.map((guarantor) => (
              <option key={guarantor.id} value={guarantor.id}>
                {guarantor.fullName} / {guarantor.membershipNumber}
              </option>
            ))}
          </select>
          <select
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setForm((current) => ({ ...current, guarantorTwoId: event.target.value }))}
            value={form.guarantorTwoId}
          >
            <option value="">Select guarantor 2</option>
            {guarantors.data.items
              .filter((guarantor) => guarantor.id !== form.guarantorOneId)
              .map((guarantor) => (
                <option key={guarantor.id} value={guarantor.id}>
                  {guarantor.fullName} / {guarantor.membershipNumber}
                </option>
              ))}
          </select>
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => void applyForLoan()}
            type="button"
          >
            Submit application
          </button>
        </div>
      </MemberModal>
    </div>
  );
}
