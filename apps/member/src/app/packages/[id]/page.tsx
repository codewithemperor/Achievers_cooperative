"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiCallWithAlert } from "@/lib/alert";
import api, { fetchMemberApi } from "@/lib/member-api";
import { TransactionCard } from "@/components/transaction-card";

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

function statusBadge(status: string) {
  const value = status.toUpperCase();
  if (["APPROVED", "COMPLETED"].includes(value)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (["REJECTED", "OVERDUE"].includes(value)) {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }
  if (["DISBURSED", "IN_PROGRESS"].includes(value)) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  }
  if (value === "PENDING") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  }
  return "bg-background-200 text-text-600 dark:bg-background-700 dark:text-text-400";
}

export default function PackageDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<PackageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    const refreshed = await fetchMemberApi<PackageDetail>(
      `/packages/subscriptions/${id}`,
    );
    setItem(refreshed);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-6 w-36 rounded bg-background-200 dark:bg-background-700" />
        <div className="animate-pulse h-48 rounded-2xl bg-background-100 dark:bg-background-800" />
        <div className="animate-pulse h-64 rounded-2xl bg-background-100 dark:bg-background-800" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <Link
          href="/packages"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400"
        >
          Back to Packages
        </Link>
        <div className="rounded-2xl border border-dashed border-background-300 bg-background-50 p-8 text-center dark:border-background-700 dark:bg-background-900">
          <p className="text-sm text-text-400">{error || "Not found"}</p>
        </div>
      </div>
    );
  }

  const canPay =
    ["APPROVED", "DISBURSED", "IN_PROGRESS"].includes(item.status.toUpperCase()) &&
    item.amountRemaining + item.penaltyAccrued > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/packages"
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400"
      >
        Back to Packages
      </Link>

      <section className="rounded-2xl border border-background-200 bg-background-50 p-5 dark:border-background-800 dark:bg-background-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
              {item.package.name}
            </p>
            <p className="mt-1 text-xs text-text-400">
              Started {formatDate(item.createdAt)}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadge(item.status)}`}
          >
            {item.status}
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-text-400">
            <span>Progress</span>
            <span className="font-semibold text-text-700 dark:text-text-100">
              {item.progress.toFixed(0)}%
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background-200 dark:bg-background-700">
            <div
              className="h-full rounded-full bg-[#a85a16] transition-all duration-500"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Subscribed amount", value: money.format(item.subscribedAmount) },
            { label: "Paid so far", value: money.format(item.amountPaid) },
            { label: "Remaining balance", value: money.format(item.amountRemaining) },
            { label: "Penalty accrued", value: money.format(item.penaltyAccrued) },
            { label: "Tenor", value: `${item.package.durationMonths} months` },
            { label: "Next due date", value: formatDate(item.nextDueAt) },
          ].map((entry) => (
            <div
              key={entry.label}
              className="rounded-xl bg-white p-4 dark:bg-background-800"
            >
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-text-400">
                {entry.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-text-900 dark:text-text-50">
                {entry.value}
              </p>
            </div>
          ))}
        </div>

        {item.disbursementBankAccount ? (
          <div className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4 dark:border-background-700 dark:bg-background-900">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-text-400">
              Disbursement account
            </p>
            <p className="mt-2 text-sm font-semibold text-text-900 dark:text-text-50">
              {item.disbursementBankAccount.bankName}
            </p>
            <p className="mt-0.5 text-sm text-text-700 dark:text-text-300">
              {item.disbursementBankAccount.accountName}
            </p>
            <p className="text-sm text-text-500">
              {item.disbursementBankAccount.accountNumber}
            </p>
          </div>
        ) : null}
      </section>

      {canPay ? (
        <button
          className="w-full min-h-[52px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          onClick={() => void handlePay()}
          type="button"
        >
          Make Payment
        </button>
      ) : null}

      {item.relatedTransactions?.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
            Payment history
          </h2>
          <div className="space-y-3">
            {item.relatedTransactions.map((txn) => (
              <TransactionCard
                key={txn.id}
                type={txn.type}
                title={txn.description || undefined}
                subtitle={txn.reference || "Package transaction"}
                amount={txn.amount}
                status={txn.status}
                timestamp={txn.createdAt}
              />
            ))}
          </div>
        </section>
      ) : null}

      {item.timeline?.length ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-background-800">
          <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
            Progress tracking
          </h2>
          <div className="mt-4 space-y-0">
            {item.timeline.map((event, index) => (
              <div
                key={`${event.label}-${index}`}
                className="flex gap-4 pb-6 last:pb-0"
              >
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 shrink-0 rounded-full bg-[#a85a16]" />
                  {index < (item.timeline?.length ?? 0) - 1 ? (
                    <div className="mt-1 w-0.5 flex-1 bg-background-200 dark:bg-background-700" />
                  ) : null}
                </div>
                <div className="-mt-1 min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                    {event.label}
                  </p>
                  <p className="text-xs text-text-400">
                    {formatDateTime(event.date)}
                  </p>
                  {typeof event.amount === "number" ? (
                    <p className="mt-1 text-xs text-text-500">
                      {money.format(event.amount)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {item.activityLog?.length ? (
        <section className="rounded-2xl border border-background-200 bg-background-50 p-5 dark:border-background-800 dark:bg-background-900">
          <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
            Activity log
          </h2>
          <div className="mt-4 space-y-3">
            {item.activityLog.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl bg-white px-4 py-3 text-sm dark:bg-background-800"
              >
                <p className="font-semibold text-text-900 dark:text-text-50">
                  {entry.action.replaceAll("_", " ")}
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
  );
}
