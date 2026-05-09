"use client";

import { X } from "lucide-react";
import { formatDate, formatMoney, formatTime } from "@/lib/member-format";

export interface TransactionDetailItem {
  id: string;
  source?: string | null;
  type?: string | null;
  amount?: number | null;
  status?: string | null;
  reference?: string | null;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  disbursedAt?: string | null;
  requestedAt?: string | null;
  reason?: string | null;
  rejectionReason?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  proofUrl?: string | null;
  receiptUrl?: string | null;
  imageUrl?: string | null;
  [key: string]: unknown;
}

function label(value?: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return `${formatDate(value)} ${formatTime(value)}`;
}

function statusTone(status?: string | null) {
  const value = String(status || "").toUpperCase();
  if (["APPROVED", "COMPLETED", "SUCCESSFUL", "DISBURSED", "PAID"].includes(value)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  }
  if (["REJECTED", "FAILED", "CANCELLED", "OVERDUE"].includes(value)) {
    return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  }
  if (["PENDING", "PROCESSING"].includes(value)) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300";
  }
  return "bg-background-100 text-text-600 dark:bg-background-200 dark:text-text-300";
}

function isLink(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function valueText(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString("en-NG");
  return String(value);
}

function buildTimeline(transaction: TransactionDetailItem) {
  const status = String(transaction.status || "").toUpperCase();
  const items = [
    {
      label: transaction.source === "WITHDRAWAL_REQUEST" ? "Request submitted" : "Transaction created",
      status: "PENDING",
      date: transaction.requestedAt || transaction.createdAt,
    },
  ];

  if (transaction.approvedAt || ["APPROVED", "DISBURSED", "COMPLETED", "SUCCESSFUL"].includes(status)) {
    items.push({
      label: status === "SUCCESSFUL" ? "Payment successful" : "Approved",
      status: status === "SUCCESSFUL" ? "SUCCESSFUL" : "APPROVED",
      date: transaction.approvedAt || transaction.updatedAt || transaction.createdAt,
    });
  }

  if (transaction.disbursedAt || status === "DISBURSED") {
    items.push({
      label: "Disbursed",
      status: "DISBURSED",
      date: transaction.disbursedAt || transaction.updatedAt || transaction.createdAt,
    });
  }

  if (transaction.rejectedAt || ["REJECTED", "FAILED", "CANCELLED"].includes(status)) {
    items.push({
      label: status === "FAILED" ? "Failed" : status === "CANCELLED" ? "Cancelled" : "Rejected",
      status,
      date: transaction.rejectedAt || transaction.updatedAt || transaction.createdAt,
    });
  }

  return items;
}

export function TransactionDetailModal({
  transaction,
  onClose,
}: {
  transaction: TransactionDetailItem | null;
  onClose: () => void;
}) {
  if (!transaction) return null;

  const amount =
    typeof transaction.amount === "number" ? formatMoney(transaction.amount) : "-";
  const timeline = buildTimeline(transaction);
  const receiptLink =
    transaction.proofUrl || transaction.receiptUrl || transaction.imageUrl;
  const rawFields = [
    ["Type", label(transaction.type || transaction.source || "Transaction")],
    ["Description", transaction.description || "-"],
    ["Reference", transaction.reference || "-"],
    ["Bank", transaction.bankName],
    ["Account name", transaction.accountName],
    ["Account number", transaction.accountNumber],
    ["Reason", transaction.reason],
    ["Rejection reason", transaction.rejectionReason],
    ["Receipt image", receiptLink],
    ["Transaction ID", transaction.id],
  ] satisfies Array<[string, unknown]>;
  const fields = rawFields.filter(
    ([, value]) => value !== null && typeof value !== "undefined" && value !== "",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <button
        aria-label="Close transaction details"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <section className="relative z-10 flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-background-200 bg-white shadow-2xl dark:border-background-200 dark:bg-background-100">
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4 dark:border-background-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-400">
              Transaction receipt
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-text-900 dark:text-text-50">
              {label(transaction.type || transaction.source || "Transaction")}
            </h2>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-background-200 text-text-500 transition-colors hover:bg-background-100 dark:border-background-200 dark:hover:bg-background-200"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-3xl border border-background-200 bg-background-50 p-4 dark:border-background-200 dark:bg-background-50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-400">
                  Amount
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-text-900 dark:text-text-50">
                  {amount}
                </p>
                <p className="mt-1 text-xs text-text-400">
                  {formatDateTime(transaction.createdAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${statusTone(transaction.status)}`}
              >
                {label(transaction.status)}
              </span>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-background-200 dark:border-background-200">
            {fields.map(([key, value]) => (
              <div
                className="flex items-start justify-between gap-5 border-b border-background-200 px-4 py-3 last:border-b-0 dark:border-background-200"
                key={key}
              >
                <span className="text-sm text-text-400">{key}</span>
                {isLink(value) ? (
                  <a
                    className="max-w-[62%] break-words text-right text-sm font-semibold text-primary-600 underline-offset-4 hover:underline dark:text-primary-400"
                    href={value}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View image
                  </a>
                ) : (
                  <span className="max-w-[62%] break-words text-right text-sm font-semibold text-text-900 dark:text-text-50">
                    {valueText(value)}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5">
            <h3 className="font-display text-base font-semibold text-text-900 dark:text-text-50">
              Timeline
            </h3>
            <ol className="relative mt-4 space-y-0 before:absolute before:bottom-5 before:left-[11px] before:top-2 before:w-px before:bg-background-200 dark:before:bg-background-200">
              {timeline.map((item, index) => (
                <li className="relative flex gap-3 pb-5 last:pb-0" key={`${item.label}-${index}`}>
                  <span className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white bg-primary-600 dark:border-background-100" />
                  <div className="min-w-0 flex-1 rounded-2xl bg-background-50 px-4 py-3 dark:bg-background-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-text-900 dark:text-text-50">
                        {item.label}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusTone(item.status)}`}
                      >
                        {label(item.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-400">
                      {formatDateTime(item.date)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
