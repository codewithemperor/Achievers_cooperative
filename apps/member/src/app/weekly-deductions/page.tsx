"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
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

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusClass(status: string) {
  if (["PAID", "PREPAID", "APPROVED"].includes(status)) {
    return "bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300";
  }
  if (["PARTIAL", "UPCOMING"].includes(status)) {
    return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  }
  return "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300";
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-background-200 py-3 last:border-b-0 dark:border-background-200">
      <span className="text-sm text-text-400">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-text-900 dark:text-text-50">
        {value}
      </span>
    </div>
  );
}

function currentMonthBounds() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    to: new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ).getTime(),
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
  };
}

export default function WeeklyDeductionsPage() {
  const router = useRouter();
  const weekly = useMemberData<WeeklyPayload>(
    "/weekly-deductions/me",
    emptyWeekly,
  );
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const monthBounds = currentMonthBounds();
  const visibleCycles = weekly.data.cycles
    .filter((cycle) => {
      const dueTime = new Date(cycle.dueDate).getTime();
      const isCurrentMonth =
        dueTime >= monthBounds.from && dueTime <= monthBounds.to;
      const isOutstanding =
        cycle.outstandingAmount > 0 && dueTime <= monthBounds.today;
      return isCurrentMonth || isOutstanding;
    })
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

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
        successText:
          "Your weekly association deduction payment has been recorded.",
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
      <SummaryCard
        eyebrow="Association"
        title="Outstanding Weekly dues"
        value={formatMoney(weekly.data.outstandingAmount)}
        caption={`Weekly amount is ${formatMoney(weekly.data.weeklyAmount)}. You have prepaid ${formatMoney(weekly.data.prepaidAmount)} and paid ${formatMoney(weekly.data.paidThisMonth)} this month.`}
        ctaLabel="Pay weekly dues"
        onCtaClick={() => {
          setAmount(
            String(
              weekly.data.outstandingAmount || weekly.data.weeklyAmount || "",
            ),
          );
          setIsPayOpen(true);
        }}
        icon={<CalendarDays className="h-5 w-5" />}
        gradient="from-[#0f4f46] via-[#0d3d37] to-[#082622]"
      />

      <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-400">
              Weekly summary
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-text-900 dark:text-text-50">
              Association dues
            </h2>
          </div>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
            {formatMoney(weekly.data.weeklyAmount)} weekly
          </span>
        </div>
        <div className="mt-3">
          <DetailRow
            label="Expected"
            value={formatMoney(weekly.data.expectedAmount)}
          />
          <DetailRow
            label="Total paid"
            value={formatMoney(weekly.data.totalPaid)}
          />
          <DetailRow
            label="Outstanding"
            value={formatMoney(weekly.data.outstandingAmount)}
          />
          <DetailRow
            label="Prepaid"
            value={formatMoney(weekly.data.prepaidAmount)}
          />
          <DetailRow
            label="Paid this month"
            value={formatMoney(weekly.data.paidThisMonth)}
          />
          <DetailRow
            label="Next due"
            value={
              weekly.data.nextDueAt ? formatDate(weekly.data.nextDueAt) : "--"
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
            Deduction cycles
          </h2>
          <span className="text-xs text-text-400">Oldest first</span>
        </div>
        {visibleCycles.length ? (
          <div className="max-w-full overflow-x-auto">
            <div className="max-h-[360px] min-w-[680px] overflow-y-auto rounded-2xl border border-background-200 dark:border-background-200">
              <div className="grid grid-cols-[64px_1.2fr_1fr_1fr_1fr_1fr] bg-background-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-400 dark:bg-background-50">
                <span>S/N</span>
                <span>Due date</span>
                <span>Expected</span>
                <span>Paid</span>
                <span>Outstanding</span>
                <span>Status</span>
              </div>
              {visibleCycles.map((cycle, index) => (
                <div
                  className="grid grid-cols-[64px_1.2fr_1fr_1fr_1fr_1fr] items-center border-t border-background-200 px-4 py-3 text-sm dark:border-background-200"
                  key={cycle.id}
                >
                  <span className="text-text-400">{index + 1}</span>
                  <span className="font-medium text-text-900 dark:text-text-50">
                    {formatDate(cycle.dueDate)}
                  </span>
                  <span className="text-text-600 dark:text-text-300">
                    {formatMoney(cycle.amount)}
                  </span>
                  <span className="text-text-600 dark:text-text-300">
                    {formatMoney(cycle.amountPaid)}
                  </span>
                  <span className="font-semibold text-text-900 dark:text-text-50">
                    {formatMoney(cycle.outstandingAmount)}
                  </span>
                  <span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusClass(cycle.status)}`}
                    >
                      {label(cycle.status)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
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
          <div className="max-w-full overflow-x-auto">
            <div className="max-h-[340px] min-w-[640px] overflow-y-auto rounded-2xl border border-background-200 dark:border-background-200">
              <div className="grid grid-cols-[64px_1.2fr_1fr_1fr_1.2fr] bg-background-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-400 dark:bg-background-50">
                <span>S/N</span>
                <span>Date</span>
                <span>Mode</span>
                <span>Amount</span>
                <span>Reference</span>
              </div>
              {weekly.data.payments.map((payment, index) => (
                <div
                  className="grid grid-cols-[64px_1.2fr_1fr_1fr_1.2fr] items-center border-t border-background-200 px-4 py-3 text-sm dark:border-background-200"
                  key={payment.id}
                >
                  <span className="text-text-400">{index + 1}</span>
                  <span className="text-text-600 dark:text-text-300">
                    {formatDateTime(payment.paidAt)}
                  </span>
                  <span className="font-medium capitalize text-text-900 dark:text-text-50">
                    {payment.mode.toLowerCase()}
                  </span>
                  <span className="font-semibold text-text-900 dark:text-text-50">
                    {formatMoney(payment.amount)}
                  </span>
                  <span className="truncate text-text-500 dark:text-text-300">
                    {payment.transaction?.reference ||
                      payment.transaction?.description ||
                      "--"}
                  </span>
                </div>
              ))}
            </div>
          </div>
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
