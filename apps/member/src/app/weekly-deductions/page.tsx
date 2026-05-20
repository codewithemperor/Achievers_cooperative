"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, WalletCards } from "lucide-react";
import api from "@/lib/member-api";
import { apiCallWithAlert } from "@/lib/alert";
import { formatMoney } from "@/lib/member-format";
import { goBackOrDashboard } from "@/lib/navigation";
import { useMemberData } from "@/hooks/use-member-data";
import { SummaryCard } from "@/components/summary-card";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { MemberModal } from "@/components/member-modal";

interface WeeklyCycle {
  id: string;
  dueDate: string;
  amount: number;
  amountPaid: number;
  outstandingAmount: number;
  status: string;
}

interface WeeklyPayment {
  id: string;
  amount: number;
  mode: string;
  paidAt: string;
  transaction?: {
    status: string;
    reference?: string | null;
    description?: string | null;
  } | null;
}

interface WeeklyPayload {
  weeklyAmount: number;
  outstandingAmount: number;
  prepaidAmount: number;
  totalPaid: number;
  paidThisMonth: number;
  expectedAmount: number;
  nextDueAt?: string | null;
  cycles: WeeklyCycle[];
  payments: WeeklyPayment[];
}

const emptyWeekly: WeeklyPayload = {
  weeklyAmount: 0,
  outstandingAmount: 0,
  prepaidAmount: 0,
  totalPaid: 0,
  paidThisMonth: 0,
  expectedAmount: 0,
  nextDueAt: null,
  cycles: [],
  payments: [],
};

function formatDate(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status: string) {
  if (["PAID", "PREPAID", "APPROVED"].includes(status)) {
    return "bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300";
  }
  if (status === "PARTIAL") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  }
  return "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300";
}

export default function WeeklyDeductionsPage() {
  const router = useRouter();
  const weekly = useMemberData<WeeklyPayload>("/weekly-deductions/me", emptyWeekly);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitPayment() {
    const value = Number(amount);
    if (!value || value <= 0) return;

    try {
      setSubmitting(true);
      const result = await apiCallWithAlert({
        title: "Weekly Deduction",
        loadingText: "Processing weekly deduction payment...",
        apiCall: () => api.post("/weekly-deductions/me/pay", { amount: value }),
        successTitle: "Payment Successful",
        successText: "Your weekly association deduction payment has been recorded.",
      });

      if (result) {
        setAmount("");
        setIsPayOpen(false);
        await weekly.refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PullToRefresh className="space-y-5" onRefresh={weekly.refetch}>
      <button
        className="inline-flex items-center gap-2 rounded-full border border-background-200 bg-white px-3 py-2 text-xs font-semibold text-text-700 dark:border-white/10 dark:bg-background-100 dark:text-text-100"
        onClick={() => goBackOrDashboard(router)}
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <SummaryCard
        eyebrow="Association"
        title="Weekly dues"
        value={formatMoney(weekly.data.outstandingAmount)}
        caption={`Weekly amount is ${formatMoney(weekly.data.weeklyAmount)}. You have prepaid ${formatMoney(weekly.data.prepaidAmount)} and paid ${formatMoney(weekly.data.paidThisMonth)} this month.`}
        ctaLabel="Pay weekly dues"
        onCtaClick={() => {
          setAmount(String(weekly.data.outstandingAmount || weekly.data.weeklyAmount || ""));
          setIsPayOpen(true);
        }}
        icon={<CalendarDays className="h-5 w-5" />}
        gradient="from-[#0f4f46] via-[#0d3d37] to-[#082622]"
      />

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Expected", weekly.data.expectedAmount],
          ["Total paid", weekly.data.totalPaid],
          ["Prepaid", weekly.data.prepaidAmount],
          ["Next due", weekly.data.nextDueAt ? formatDate(weekly.data.nextDueAt) : "--"],
        ].map(([label, value]) => (
          <div
            className="rounded-2xl border border-background-200 bg-white p-4 dark:border-white/10 dark:bg-background-100"
            key={label}
          >
            <p className="text-xs font-medium text-text-400">{label}</p>
            <p className="mt-2 text-lg font-semibold text-text-900 dark:text-text-50">
              {typeof value === "number" ? formatMoney(value) : value}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
            Deduction cycles
          </h2>
          <span className="text-xs text-text-400">Oldest first</span>
        </div>
        {weekly.data.cycles.length ? (
          weekly.data.cycles
            .slice()
            .reverse()
            .map((cycle) => (
              <div
                className="rounded-2xl border border-background-200 bg-white p-4 dark:border-white/10 dark:bg-background-100"
                key={cycle.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-900 dark:text-text-50">
                      {formatDate(cycle.dueDate)}
                    </p>
                    <p className="mt-1 text-xs text-text-400">
                      Paid {formatMoney(cycle.amountPaid)} of {formatMoney(cycle.amount)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(cycle.status)}`}>
                    {cycle.status.replaceAll("_", " ").toLowerCase()}
                  </span>
                </div>
              </div>
            ))
        ) : (
          <div className="rounded-2xl border border-dashed border-background-300 p-8 text-center text-sm text-text-400 dark:border-white/10">
            Weekly deduction cycles will appear here.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
          Payment history
        </h2>
        {weekly.data.payments.length ? (
          weekly.data.payments.map((payment) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border border-background-200 bg-white p-4 dark:border-white/10 dark:bg-background-100"
              key={payment.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                  <WalletCards className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-900 dark:text-text-50">
                    {payment.mode.toLowerCase()} payment
                  </p>
                  <p className="text-xs text-text-400">{formatDate(payment.paidAt)}</p>
                </div>
              </div>
              <p className="font-semibold text-text-900 dark:text-text-50">
                {formatMoney(payment.amount)}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-background-300 p-8 text-center text-sm text-text-400 dark:border-white/10">
            No weekly deduction payment yet.
          </div>
        )}
      </section>

      <MemberModal
        description="Pay any amount from your wallet. Outstanding dues are cleared first, then future weeks are prepaid."
        isOpen={isPayOpen}
        onClose={() => setIsPayOpen(false)}
        title="Pay weekly dues"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-text-700 dark:text-text-200">
              Amount
            </span>
            <input
              className="mt-2 min-h-12 w-full rounded-2xl border border-background-300 bg-white px-4 text-sm text-text-900 outline-none transition focus:border-primary-500 dark:border-white/10 dark:bg-background-100 dark:text-text-50"
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter amount"
              type="number"
              value={amount}
            />
          </label>
          <button
            className="min-h-12 w-full rounded-full bg-primary-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={submitting || !Number(amount)}
            onClick={() => void submitPayment()}
            type="button"
          >
            {submitting ? "Processing..." : "Pay now"}
          </button>
        </div>
      </MemberModal>
    </PullToRefresh>
  );
}
