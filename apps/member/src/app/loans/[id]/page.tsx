"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiCallWithAlert } from "@/lib/alert";
import api, { fetchMemberApi } from "@/lib/member-api";
import { TransactionCard } from "@/components/transaction-card";

interface LoanDetail {
  id: string;
  amount: number;
  remainingBalance: number;
  amountPaidSoFar: number;
  tenorMonths: number;
  tenorUnit?: "MONTHS" | "WEEKS";
  purpose: string;
  status: string;
  repaymentProgress: number;
  submittedAt: string;
  dueDate?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  timeline?: Array<{
    label: string;
    status: string;
    date: string;
    amount?: number;
    reference?: string | null;
  }>;
  paymentSchedule?: Array<{
    installment?: number;
    dueDate: string;
    amount: number;
    status: string;
  }>;
  canDelete?: boolean;
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  const map: Record<string, string> = {
    APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    CURRENT: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    DISBURSED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    OVERDUE: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    UPCOMING: "bg-background-200 text-text-600 dark:bg-background-700 dark:text-text-400",
    PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return map[s] || "bg-background-200 text-text-600 dark:bg-background-700 dark:text-text-400";
}

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function formatDate(date?: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default function LoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canPay =
    loan &&
    ["DISBURSED", "IN_PROGRESS", "OVERDUE"].includes(loan.status.toUpperCase()) &&
    (loan.remainingBalance ?? 0) > 0;

  function loadLoan() {
    setLoading(true);
    setError(null);
    fetchMemberApi<LoanDetail>(`/loans/${id}`)
      .then((data) => setLoan(data))
      .catch((err) => setError(err?.message || "Failed to load loan details"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLoan();
  }, [id]);

  async function handleRepay() {
    if (!loan) return;

    const { value: amount } = await import("sweetalert2").then(({ default: Swal }) =>
      Swal.fire({
        title: "Make Payment",
        input: "number",
        inputLabel: `Remaining balance: ${money.format(loan.remainingBalance)}`,
        inputPlaceholder: "Enter payment amount",
        inputAttributes: {
          min: "1",
          max: String(loan.remainingBalance),
          step: "1",
        },
        inputValidator: (val) => {
          const n = Number(val);
          if (!val || isNaN(n) || n <= 0) return "Please enter a valid amount.";
          if (n > loan.remainingBalance) return `Amount cannot exceed ${money.format(loan.remainingBalance)}.`;
        },
        showCancelButton: true,
        confirmButtonText: "Pay now",
        confirmButtonColor: "#2d5a27",
      }),
    );

    if (!amount) return;

    await apiCallWithAlert({
      title: "Loan Repayment",
      loadingText: "Processing repayment...",
      apiCall: () => api.post(`/loans/${id}/repay`, { amount: Number(amount) }),
      successTitle: "Payment Successful",
      successText: `Your repayment of ${money.format(Number(amount))} has been processed.`,
    });

    loadLoan();
  }

  async function handleDelete() {
    if (!loan?.canDelete) return;

    await apiCallWithAlert({
      title: "Delete Loan Application",
      loadingText: "Removing application...",
      apiCall: () => api.delete(`/loans/${id}`),
      successTitle: "Application Deleted",
      successText: "The pending loan application has been removed.",
    });

    router.push("/loans");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-6 w-32 rounded bg-background-200 dark:bg-background-700" />
        <div className="animate-pulse h-48 rounded-2xl bg-background-100 dark:bg-background-800" />
        <div className="animate-pulse h-72 rounded-2xl bg-background-100 dark:bg-background-800" />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="space-y-6">
        <Link href="/loans" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400">
          Back to Loans
        </Link>
        <div className="rounded-2xl border border-dashed border-background-300 bg-background-50 p-8 text-center dark:border-background-700 dark:bg-background-900">
          <p className="text-sm text-text-400">{error || "Loan not found"}</p>
        </div>
      </div>
    );
  }

  const progress = loan.amount > 0 ? Math.min(100, ((loan.amountPaidSoFar ?? 0) / loan.amount) * 100) : 0;
  const isActiveLoan = ["DISBURSED", "IN_PROGRESS", "OVERDUE"].includes(
    loan.status.toUpperCase(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/loans" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400">
          Back to Loans
        </Link>
        {loan.canDelete ? (
          <button
            className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-800 dark:text-red-400"
            onClick={() => void handleDelete()}
            type="button"
          >
            Delete pending application
          </button>
        ) : null}
      </div>

      <section
        className={`rounded-2xl border p-5 ${
          isActiveLoan
            ? "border-[#5d0910] bg-[#fff1f2] dark:border-[#7a0d16] dark:bg-[#2d070b]"
            : "border-[var(--background-200)] bg-[var(--background-50)] dark:border-[var(--background-800)] dark:bg-[var(--background-900)]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-text-900">{loan.purpose}</p>
            <p className="mt-1 text-xs text-text-400">Submitted {formatDate(loan.submittedAt)}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadge(loan.status)}`}>
            {loan.status}
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-text-400">
            <span>Repayment progress</span>
            <span className="font-semibold text-text-700">{progress.toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background-200 dark:bg-background-700">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Loan amount", value: money.format(loan.amount) },
            { label: "Paid so far", value: money.format(loan.amountPaidSoFar ?? 0) },
            { label: "Remaining balance", value: money.format(loan.remainingBalance ?? 0) },
            {
              label: "Tenor",
              value: `${loan.tenorMonths} ${loan.tenorUnit === "WEEKS" ? "weeks" : "months"}`,
            },
            { label: "Due date", value: formatDate(loan.dueDate) },
            { label: "Applied on", value: formatDate(loan.submittedAt) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white p-4 dark:bg-background-800">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-text-400">{item.label}</p>
              <p className="mt-2 text-sm font-semibold text-text-900 dark:text-text-50">{item.value}</p>
            </div>
          ))}
        </div>

        {loan.bankAccount ? (
          <div className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4 dark:border-background-700 dark:bg-background-900">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-text-400">Disbursement account</p>
            <p className="mt-2 text-sm font-semibold text-text-900 dark:text-text-50">{loan.bankAccount.bankName}</p>
            <p className="mt-0.5 text-sm text-text-700 dark:text-text-300">{loan.bankAccount.accountName}</p>
            <p className="text-sm text-text-500">{loan.bankAccount.accountNumber}</p>
          </div>
        ) : null}
      </section>

      {canPay ? (
        <button
          className="w-full min-h-[52px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          onClick={() => void handleRepay()}
          type="button"
        >
          Make Payment
        </button>
      ) : null}

      {loan.timeline && loan.timeline.length > 0 ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-background-800">
          <h2 className="font-display text-lg font-semibold text-text-900">Timeline</h2>
          <div className="mt-4 space-y-0">
            {loan.timeline.map((event, idx) => (
              <div key={`${event.label}-${idx}`} className="flex gap-4 pb-6 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 shrink-0 rounded-full ${event.status === "CURRENT" ? "bg-primary-600 ring-4 ring-primary-100 dark:ring-primary-950" : event.status === "COMPLETED" ? "bg-emerald-500" : event.status === "OVERDUE" ? "bg-red-500" : "bg-background-300 dark:bg-background-600"}`} />
                  {idx < (loan.timeline?.length ?? 0) - 1 ? <div className="mt-1 w-0.5 flex-1 bg-background-200 dark:bg-background-700" /> : null}
                </div>
                <div className="-mt-1 min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-900">{event.label}</p>
                  <p className="text-xs text-text-400">{formatDate(event.date)}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-text-500">{event.status}</p>
                  {typeof event.amount === "number" ? <p className="mt-1 text-xs text-text-500">{money.format(event.amount)}</p> : null}
                  {event.reference ? <p className="mt-1 text-xs text-text-500">{event.reference}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {loan.paymentSchedule && loan.paymentSchedule.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-text-900">Payment Schedule</h2>
          <div className="space-y-3">
            {loan.paymentSchedule.map((sched, index) => (
              <TransactionCard
                key={`${sched.dueDate}-${index}`}
                type="LOAN"
                title={`Installment ${sched.installment ?? index + 1}`}
                subtitle={`Due ${formatDate(sched.dueDate)}`}
                amount={sched.amount}
                status={sched.status}
                timestamp={sched.dueDate}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
