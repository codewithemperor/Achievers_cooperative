"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiCallWithAlert } from "@/lib/alert";
import api, { fetchMemberApi } from "@/lib/member-api";

interface PackageDetail {
  id: string;
  status: string;
  amountPaid: number;
  amountRemaining: number;
  penaltyAccrued: number;
  subscribedAmount: number;
  createdAt: string;
  nextDueAt?: string | null;
  progress: number;
  package: {
    name: string;
    durationMonths: number;
    penaltyType: string;
    penaltyValue: number;
  };
  disbursementBankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
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
  relatedTransactions?: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    reference?: string | null;
    description?: string | null;
  }>;
  activityLog?: Array<{
    id: string;
    action: string;
    createdAt: string;
  }>;
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
  const value = status.toUpperCase();
  if (["APPROVED", "COMPLETED", "SUCCESSFUL", "PAID"].includes(value)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  }
  if (["REJECTED", "OVERDUE", "CANCELLED"].includes(value)) {
    return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  }
  if (["DISBURSED", "IN_PROGRESS"].includes(value)) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  }
  if (["PENDING", "UPCOMING", "CURRENT"].includes(value)) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300";
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

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
        : "border-background-200 bg-white dark:border-background-200 dark:bg-background-100";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-text-900 dark:text-text-50">
        {value}
      </p>
    </div>
  );
}

export default function PackageDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<PackageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadPackage() {
    setLoading(true);
    fetchMemberApi<PackageDetail>(`/packages/subscriptions/${id}`)
      .then((data) => {
        setItem(data);
        setError(null);
      })
      .catch((err) =>
        setError(err?.message || "Failed to load package subscription"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPackage();
  }, [id]);

  async function handlePay() {
    if (!item) return;

    const outstanding = item.amountRemaining + item.penaltyAccrued;
    const { value: amount } = await import("sweetalert2").then(
      ({ default: Swal }) =>
        Swal.fire({
          title: "Make Package Payment",
          input: "number",
          inputLabel: `Outstanding balance: ${money.format(outstanding)}`,
          inputPlaceholder: "Enter payment amount",
          inputAttributes: {
            min: "1",
            max: String(outstanding),
            step: "1",
          },
          inputValidator: (value) => {
            const numeric = Number(value);
            if (!value || Number.isNaN(numeric) || numeric <= 0) {
              return "Please enter a valid amount.";
            }
            if (numeric > outstanding) {
              return `Amount cannot exceed ${money.format(outstanding)}.`;
            }
          },
          showCancelButton: true,
          confirmButtonText: "Pay now",
          confirmButtonColor: "#2d5a27",
        }),
    );

    if (!amount) return;

    await apiCallWithAlert({
      title: "Package Payment",
      loadingText: "Processing payment...",
      apiCall: () =>
        api.post(`/packages/subscriptions/${id}/pay`, {
          amount: Number(amount),
        }),
      successTitle: "Payment Successful",
      successText: `Your payment of ${money.format(Number(amount))} has been processed.`,
    });

    loadPackage();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-2xl bg-background-100 dark:bg-background-100" />
        <div className="h-72 animate-pulse rounded-2xl bg-background-100 dark:bg-background-100" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="rounded-2xl border border-dashed border-background-300 bg-background-50 p-8 text-center dark:border-background-200 dark:bg-background-100">
        <p className="text-sm text-text-400">{error || "Package subscription not found"}</p>
      </div>
    );
  }

  const outstanding = item.amountRemaining + item.penaltyAccrued;
  const canPay =
    ["APPROVED", "DISBURSED", "IN_PROGRESS"].includes(item.status.toUpperCase()) &&
    outstanding > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-400/30 dark:bg-amber-400/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-400">
              Package subscription
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-text-900 dark:text-text-50">
              {item.package.name}
            </h1>
            <p className="mt-1 text-sm text-text-400">
              Started {formatDate(item.createdAt)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${statusBadge(item.status)}`}
          >
            {label(item.status)}
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-text-400">
            <span>Repayment progress</span>
            <span className="font-semibold text-text-700 dark:text-text-100">
              {item.progress.toFixed(0)}%
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-background-200 dark:bg-background-200">
            <div
              className="h-full rounded-full bg-[#a85a16] transition-all duration-500"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Subscribed amount" value={money.format(item.subscribedAmount)} />
        <MetricCard
          label="Paid so far"
          tone="success"
          value={money.format(item.amountPaid)}
        />
        <MetricCard
          label="Outstanding"
          tone={outstanding > 0 ? "warning" : "success"}
          value={money.format(outstanding)}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(260px,340px)_1fr] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
            <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
              Subscription summary
            </h2>
            <div className="mt-3">
              <DetailRow label="Tenor" value={`${item.package.durationMonths} months`} />
              <DetailRow label="Next due date" value={formatDate(item.nextDueAt)} />
              <DetailRow label="Penalty accrued" value={money.format(item.penaltyAccrued)} />
              <DetailRow
                label="Penalty rule"
                value={`${label(item.package.penaltyType)} ${item.package.penaltyValue}`}
              />
            </div>
          </section>

          {item.disbursementBankAccount ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Disbursement account
              </h2>
              <div className="mt-3">
                <DetailRow label="Bank" value={item.disbursementBankAccount.bankName} />
                <DetailRow label="Account name" value={item.disbursementBankAccount.accountName} />
                <DetailRow label="Account number" value={item.disbursementBankAccount.accountNumber} />
              </div>
            </section>
          ) : null}

          {canPay ? (
            <button
              className="w-full min-h-[52px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
              onClick={() => void handlePay()}
              type="button"
            >
              Make Payment
            </button>
          ) : null}
        </aside>

        <div className="space-y-5">
          {item.timeline?.length ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Package timeline
              </h2>
              <ol className="relative mt-5 space-y-0 before:absolute before:bottom-5 before:left-[11px] before:top-2 before:w-px before:bg-background-200 dark:before:bg-background-200">
                {item.timeline.map((event, index) => (
                  <li className="relative flex gap-3 pb-5 last:pb-0" key={`${event.label}-${index}`}>
                    <span className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white bg-[#a85a16] dark:border-background-100" />
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
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {item.paymentSchedule?.length ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Installment Schedule
              </h2>
              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[560px] overflow-hidden rounded-2xl border border-background-200 dark:border-background-200">
                  <div className="grid grid-cols-[64px_1fr_1fr_1fr_1fr] bg-background-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-400 dark:bg-background-50">
                    <span>S/N</span>
                    <span>Installment</span>
                    <span>Due Date</span>
                    <span>Amount</span>
                    <span>Status</span>
                  </div>
                  {item.paymentSchedule.map((sched, index) => (
                    <div
                      className="grid grid-cols-[64px_1fr_1fr_1fr_1fr] items-center border-t border-background-200 px-4 py-3 text-sm dark:border-background-200"
                      key={`${sched.dueDate}-${index}`}
                    >
                      <span className="text-text-400">{index + 1}</span>
                      <span className="font-medium text-text-900 dark:text-text-50">
                        Installment {sched.installment ?? index + 1}
                      </span>
                      <span className="text-text-600 dark:text-text-300">{formatDate(sched.dueDate)}</span>
                      <span className="font-semibold text-text-900 dark:text-text-50">
                        {money.format(sched.amount)}
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

          {item.relatedTransactions?.length ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Payment history
              </h2>
              <div className="mt-4 space-y-3">
                {item.relatedTransactions.map((txn) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background-50 px-4 py-3 dark:bg-background-50"
                    key={txn.id}
                  >
                    <div>
                      <p className="font-semibold text-text-900 dark:text-text-50">
                        {txn.description || label(txn.type)}
                      </p>
                      <p className="mt-1 text-xs text-text-400">
                        {txn.reference || formatDateTime(txn.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-text-900 dark:text-text-50">
                        {money.format(txn.amount)}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadge(txn.status)}`}
                      >
                        {label(txn.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {item.activityLog?.length ? (
            <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
              <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
                Activity log
              </h2>
              <div className="mt-4 space-y-3">
                {item.activityLog.map((entry) => (
                  <div
                    className="rounded-2xl bg-background-50 px-4 py-3 text-sm dark:bg-background-50"
                    key={entry.id}
                  >
                    <p className="font-semibold text-text-900 dark:text-text-50">
                      {label(entry.action)}
                    </p>
                    <p className="mt-1 text-xs text-text-400">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
