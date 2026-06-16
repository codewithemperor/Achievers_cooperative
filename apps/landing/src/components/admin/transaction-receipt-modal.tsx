"use client";

import { StatusBadge } from "@/components/ui/status-badge";

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function variantForStatus(status: string) {
  const value = status.toUpperCase();
  if (["APPROVED", "DISBURSED", "COMPLETED", "PAID", "SUCCESSFUL", "WITHDRAWN"].includes(value)) {
    return "success";
  }
  if (["REJECTED", "FAILED", "OVERDUE"].includes(value)) return "danger";
  if (value === "PENDING") return "warning";
  return "neutral";
}

export interface ReceiptTimelineItem {
  label: string;
  date?: string | null;
  status?: string;
}

export interface ReceiptField {
  label: string;
  value?: string | number | null;
}

export function TransactionReceiptModal({
  title = "Transaction Receipt",
  amount,
  date,
  status,
  reference,
  fields,
  timeline,
  onClose,
}: {
  title?: string;
  amount: number;
  date?: string | null;
  status: string;
  reference?: string | null;
  fields: ReceiptField[];
  timeline?: ReceiptTimelineItem[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <button
        aria-label="Close receipt"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <div
        aria-modal="true"
        className="relative z-[101] max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-primary-900/10 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] dark:border-[var(--background-700)] dark:bg-[var(--background-900)]"
        role="dialog"
      >
        <div className="border-b border-primary-900/8 p-5 dark:border-[var(--background-700)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-400">{title}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-text-900 dark:text-text-50">
                {currency.format(amount)}
              </p>
              <p className="mt-1 text-sm text-text-400">
                {formatDateTime(date)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <StatusBadge
                status={status}
                variant={variantForStatus(status) as any}
              />
              <button
                className="rounded-full border border-primary-900/12 px-3 py-1 text-sm font-semibold text-text-900 dark:border-[var(--background-700)] dark:text-text-100"
                onClick={onClose}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
          {reference ? (
            <p className="mt-4 rounded-2xl bg-background-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-400 dark:bg-[var(--background-800)]">
              {reference}
            </p>
          ) : null}
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="divide-y divide-primary-900/8 rounded-2xl border border-primary-900/8 dark:divide-[var(--background-700)] dark:border-[var(--background-700)]">
            {fields.map((field) => (
              <div
                className="flex items-start justify-between gap-5 px-4 py-3 text-sm"
                key={field.label}
              >
                <span className="text-text-400">{field.label}</span>
                {typeof field.value === "string" &&
                /^https?:\/\//i.test(field.value) ? (
                  <a
                    className="max-w-[60%] break-words text-right font-semibold text-[var(--primary-700)] hover:underline"
                    href={field.value}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View image
                  </a>
                ) : (
                  <span className="max-w-[60%] break-words text-right font-semibold text-text-900 dark:text-text-50">
                    {field.value || "-"}
                  </span>
                )}
              </div>
            ))}
          </div>

          {timeline?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-text-900 dark:text-text-50">
                Timeline
              </h3>
              <ol className="relative mt-3 space-y-3 before:absolute before:bottom-0 before:left-3 before:top-0 before:w-px before:bg-primary-900/10 dark:before:bg-[var(--background-700)]">
                {timeline.map((item, index) => (
                  <li className="relative flex gap-3" key={`${item.label}-${index}`}>
                    <span className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white bg-[var(--primary-700)] dark:border-[var(--background-900)]" />
                    <div className="min-w-0 flex-1 rounded-2xl bg-background-50 p-3 dark:bg-[var(--background-800)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                            {item.label}
                          </p>
                          <p className="mt-1 text-xs text-text-400">
                            {formatDateTime(item.date)}
                          </p>
                        </div>
                        {item.status ? (
                          <StatusBadge
                            status={item.status}
                            variant={variantForStatus(item.status) as any}
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
