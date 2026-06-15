"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiCallWithAlert } from "@/lib/alert";
import api, { fetchMemberApi } from "@/lib/member-api";

interface LoanDetail {
  id: string;
  amount: number;
  approvedAmount?: number;
  disbursedAmount?: number;
  remainingToDisburse?: number;
  remainingBalance: number;
  amountPaidSoFar: number;
  loanBondAmount?: number;
  loanBondPaidAt?: string | null;
  loanBondTransactionId?: string | null;
  loanBondPaid?: boolean;
  canPayLoanBond?: boolean;
  tenorMonths: number;
  tenorUnit?: "MONTHS" | "WEEKS";
  purpose: string;
  status: string;
  repaymentProgress: number;
  submittedAt: string;
  dueDate?: string;
  nextRepaymentAt?: string | null;
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
  activities?: Array<{
    id: string;
    type: "AMOUNT_INCREASE" | "DISBURSEMENT";
    previousAmount?: number | null;
    newAmount?: number | null;
    deltaAmount: number;
    note?: string | null;
    createdAt: string;
    actor?: { email: string; role: string } | null;
  }>;
  paymentSchedule?: Array<{
    installment?: number;
    dueDate: string;
    amount: number;
    expectedAmount?: number;
    paidAmount?: number;
    remainingAmount?: number;
    status: string;
  }>;
  repaymentAttempts?: Array<{
    id: string;
    phase: string;
    expectedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    mode: string;
    dueAt?: string | null;
    attemptedAt: string;
    reference?: string | null;
  }>;
  canDelete?: boolean;
}

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function formatDate(date?: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date?: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function label(status: string) {
  return status.replaceAll("_", " ");
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (["APPROVED", "COMPLETED", "SUCCESSFUL", "PAID"].includes(s)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  }
  if (["PENDING", "CURRENT", "UPCOMING", "PARTIAL"].includes(s)) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300";
  }
  if (["REJECTED", "CANCELLED", "OVERDUE", "UNPAID"].includes(s)) {
    return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  }
  if (["DISBURSED", "IN_PROGRESS"].includes(s)) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  }
  return "bg-background-100 text-text-600 dark:bg-background-200 dark:text-text-300";
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
  const canPayLoanBond =
    loan &&
    Boolean(loan.canPayLoanBond ?? (loan.status.toUpperCase() === "APPROVED" && !(loan.loanBondPaidAt || loan.loanBondPaid)));

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
          if (!val || Number.isNaN(n) || n <= 0) return "Please enter a valid amount.";
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

  async function handlePayLoanBond() {
    if (!loan) return;

    const bondAmount = loan.loanBondAmount ?? 0;
    const { isConfirmed } = await import("sweetalert2").then(({ default: Swal }) =>
      Swal.fire({
        title: "Pay Loan Bond?",
        text: `This will deduct ${money.format(bondAmount)} from your wallet before your approved loan can be disbursed.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Pay bond",
        confirmButtonColor: "#2d5a27",
      }),
    );

    if (!isConfirmed) return;

    await apiCallWithAlert({
      title: "Loan Bond",
      loadingText: "Paying loan bond...",
      apiCall: () => api.post(`/loans/${id}/pay-bond`),
      successTitle: "Loan Bond Paid",
      successText: "Your loan bond has been paid. Your approved loan can now be disbursed.",
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
        <div className="h-40 animate-pulse rounded-2xl bg-background-100 dark:bg-background-100" />
        <div className="h-72 animate-pulse rounded-2xl bg-background-100 dark:bg-background-100" />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="rounded-2xl border border-dashed border-background-300 bg-background-50 p-8 text-center dark:border-background-200 dark:bg-background-100">
        <p className="text-sm text-text-400">{error || "Loan not found"}</p>
      </div>
    );
  }

  const progress =
    (loan.disbursedAmount ?? 0) > 0
      ? loan.repaymentProgress ?? Math.min(100, ((loan.amountPaidSoFar ?? 0) / (loan.disbursedAmount ?? loan.amount)) * 100)
      : 0;
  const isActiveLoan = ["DISBURSED", "IN_PROGRESS", "OVERDUE"].includes(
    loan.status.toUpperCase(),
  );

  return (
    <div className="space-y-6">
      {loan.canDelete ? (
        <div className="flex justify-end">
          <button
            className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/30 dark:text-red-300"
            onClick={() => void handleDelete()}
            type="button"
          >
            Delete pending application
          </button>
        </div>
      ) : null}

      <section
        className={`rounded-3xl border p-5 ${
          isActiveLoan
            ? "border-[#5b0b12]/20 bg-gradient-to-br from-[#7a0d16] via-[#5d0910] to-[#340407] text-white shadow-[0_20px_48px_rgba(91,11,18,0.22)] dark:border-red-500/30"
            : "border-background-200 bg-white dark:border-background-200 dark:bg-background-100"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isActiveLoan ? "text-white/65" : "text-text-400"}`}>
              Loan details
            </p>
            <h1 className={`mt-1 font-display text-2xl font-semibold ${isActiveLoan ? "text-white" : "text-text-900 dark:text-text-50"}`}>
              {loan.purpose}
            </h1>
            <p className={`mt-1 text-sm ${isActiveLoan ? "text-white/70" : "text-text-400"}`}>
              Submitted {formatDate(loan.submittedAt)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${statusBadge(loan.status)}`}
          >
            {label(loan.status)}
          </span>
        </div>

        <div className="mt-5">
          <div className={`flex items-center justify-between text-xs ${isActiveLoan ? "text-white/70" : "text-text-400"}`}>
            <span>Repayment progress</span>
            <span className={`font-semibold ${isActiveLoan ? "text-white" : "text-text-700 dark:text-text-100"}`}>
              {progress >= 100 ? "100" : progress.toFixed(1)}%
            </span>
          </div>
          <div className={`mt-2 h-2.5 overflow-hidden rounded-full ${isActiveLoan ? "bg-white/25" : "bg-background-200 dark:bg-background-200"}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${isActiveLoan ? "bg-white" : "bg-primary-600"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <div className="grid max-w-full gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
            <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
              Loan summary
            </h2>
            <div className="mt-3">
              <DetailRow label="Approved amount" value={money.format(loan.approvedAmount ?? loan.amount)} />
              <DetailRow label="Disbursed amount" value={money.format(loan.disbursedAmount ?? 0)} />
              <DetailRow label="Remaining to disburse" value={money.format(loan.remainingToDisburse ?? 0)} />
              <DetailRow
                label="Loan bond"
                value={loan.loanBondPaidAt || loan.loanBondPaid ? "Paid" : money.format(loan.loanBondAmount ?? 0)}
              />
              <DetailRow label="Paid so far" value={money.format(loan.amountPaidSoFar ?? 0)} />
              <DetailRow label="Repayment outstanding" value={money.format(loan.remainingBalance ?? 0)} />
              <DetailRow
                label="Loan tenor"
                value={`${loan.tenorMonths} month${loan.tenorMonths === 1 ? "" : "s"}`}
              />
              <DetailRow
                label="Repayment frequency"
                value={loan.tenorUnit === "WEEKS" ? "Weekly" : "Monthly"}
              />
              <DetailRow label="Next repayment" value={formatDate(loan.nextRepaymentAt ?? loan.dueDate)} />
              <DetailRow label="Applied on" value={formatDate(loan.submittedAt)} />
              <DetailRow label="Progress" value={`${progress >= 100 ? "100" : progress.toFixed(1)}%`} />
            </div>
          </section>

          {loan.bankAccount ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Bank account
              </h2>
              <div className="mt-3">
                <DetailRow label="Bank" value={loan.bankAccount.bankName} />
                <DetailRow label="Account name" value={loan.bankAccount.accountName} />
                <DetailRow label="Account number" value={loan.bankAccount.accountNumber} />
              </div>
            </section>
          ) : null}

          {canPayLoanBond ? (
            <button
              className="w-full min-h-[52px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
              onClick={() => void handlePayLoanBond()}
              type="button"
            >
              Pay Loan Bond
            </button>
          ) : null}

          {canPay ? (
            <button
              className="w-full min-h-[52px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
              onClick={() => void handleRepay()}
              type="button"
            >
              Make Payment
            </button>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-5">
          {loan.timeline && loan.timeline.length > 0 ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Loan timeline
              </h2>
              <ol className="relative mt-5 space-y-0 before:absolute before:bottom-5 before:left-[11px] before:top-2 before:w-px before:bg-background-200 dark:before:bg-background-200">
                {loan.timeline.map((event, index) => (
                  <li className="relative flex gap-3 pb-5 last:pb-0" key={`${event.label}-${index}`}>
                    <span className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white bg-primary-600 dark:border-background-100" />
                    <div className="min-w-0 flex-1 rounded-2xl bg-background-50 px-4 py-3 dark:bg-background-50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-text-900 dark:text-text-50">
                          {event.label}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadge(event.status)}`}
                        >
                          {label(event.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-400">{formatDateTime(event.date)}</p>
                      {typeof event.amount === "number" ? (
                        <p className="mt-1 text-xs text-text-500">{money.format(event.amount)}</p>
                      ) : null}
                      {event.reference ? (
                        <p className="mt-1 break-words text-xs text-text-500">{event.reference}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {loan.activities && loan.activities.length > 0 ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Loan activity
              </h2>
              <div className="mt-4 space-y-3">
                {loan.activities.map((activity) => (
                  <div
                    className="rounded-2xl bg-background-50 px-4 py-3 dark:bg-background-50"
                    key={activity.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text-900 dark:text-text-50">
                          {activity.type === "AMOUNT_INCREASE"
                            ? "Approved amount increased"
                            : "Partial disbursement"}
                        </p>
                        <p className="mt-1 text-xs text-text-400">
                          {formatDateTime(activity.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                        {money.format(activity.deltaAmount)}
                      </p>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-text-500 dark:text-text-300">
                      {activity.previousAmount != null ? (
                        <span>Previous: {money.format(activity.previousAmount)}</span>
                      ) : null}
                      {activity.newAmount != null ? (
                        <span>New: {money.format(activity.newAmount)}</span>
                      ) : null}
                      {activity.note ? <span>{activity.note}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {loan.repaymentAttempts && loan.repaymentAttempts.length > 0 ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Repayment attempts
              </h2>
              <div className="mt-4 space-y-3">
                {loan.repaymentAttempts.map((attempt) => (
                  <div
                    className="rounded-2xl bg-background-50 px-4 py-3 dark:bg-background-50"
                    key={attempt.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text-900 dark:text-text-50">
                          {label(attempt.phase)}
                        </p>
                        <p className="mt-1 text-xs text-text-400">
                          {formatDateTime(attempt.attemptedAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadge(attempt.status)}`}
                      >
                        {label(attempt.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-text-500 dark:text-text-300 sm:grid-cols-3">
                      <span>Expected: {money.format(attempt.expectedAmount)}</span>
                      <span>Paid: {money.format(attempt.paidAmount)}</span>
                      <span>Remaining: {money.format(attempt.remainingAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {loan.paymentSchedule && loan.paymentSchedule.length > 0 ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Installment Schedule
              </h2>
              <div className="mt-4 max-w-full overflow-x-auto">
                <div className="max-h-[420px] min-w-[760px] overflow-y-auto rounded-2xl border border-background-200 dark:border-background-200">
                  <div className="grid grid-cols-[64px_1.2fr_1fr_1fr_1fr_1fr_1fr] bg-background-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-400 dark:bg-background-50">
                    <span>S/N</span>
                    <span>Installment</span>
                    <span>Due Date</span>
                    <span>Expected</span>
                    <span>Paid</span>
                    <span>Remaining</span>
                    <span>Status</span>
                  </div>
                  {loan.paymentSchedule.map((sched, index) => (
                    <div
                      className="grid grid-cols-[64px_1.2fr_1fr_1fr_1fr_1fr_1fr] items-center border-t border-background-200 px-4 py-3 text-sm dark:border-background-200"
                      key={`${sched.dueDate}-${index}`}
                    >
                      <span className="text-text-400">{index + 1}</span>
                      <span className="font-medium text-text-900 dark:text-text-50">
                        Installment {sched.installment ?? index + 1}
                      </span>
                      <span className="text-text-600 dark:text-text-300">{formatDate(sched.dueDate)}</span>
                      <span className="font-semibold text-text-900 dark:text-text-50">
                        {money.format(sched.expectedAmount ?? sched.amount)}
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {money.format(sched.paidAmount ?? 0)}
                      </span>
                      <span className="font-semibold text-red-700 dark:text-red-300">
                        {money.format(sched.remainingAmount ?? Math.max((sched.expectedAmount ?? sched.amount) - (sched.paidAmount ?? 0), 0))}
                      </span>
                      <span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadge(sched.status)}`}
                        >
                          {label(sched.status)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
