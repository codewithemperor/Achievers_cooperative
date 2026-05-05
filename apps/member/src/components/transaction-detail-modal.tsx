"use client";

import { MemberModal } from "@/components/member-modal";
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
  [key: string]: unknown;
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

export function TransactionDetailModal({
  transaction,
  onClose,
}: {
  transaction: TransactionDetailItem | null;
  onClose: () => void;
}) {
  return (
    <MemberModal
      isOpen={Boolean(transaction)}
      onClose={onClose}
      title="Transaction details"
      description={transaction?.reference || transaction?.id}
    >
      {transaction ? (
        <div className="grid gap-3 text-sm">
          {[
            ["Type", label(String(transaction.type || "Transaction"))],
            [
              "Amount",
              typeof transaction.amount === "number"
                ? formatMoney(transaction.amount)
                : "-",
            ],
            ["Status", label(String(transaction.status || "-"))],
            ["Source", transaction.source || "Transaction"],
            ["Reference", transaction.reference || "-"],
            ["Description", transaction.description || "-"],
            [
              "Date",
              transaction.createdAt
                ? `${formatDate(transaction.createdAt)} ${formatTime(transaction.createdAt)}`
                : "-",
            ],
            ["ID", transaction.id],
          ].map(([key, value]) => (
            <div
              className="rounded-2xl border border-background-200 bg-background-50 px-4 py-3 dark:border-background-700 dark:bg-background-900"
              key={key}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-400">
                {key}
              </p>
              <p className="mt-1 break-words font-medium text-text-900 dark:text-text-50">
                {value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </MemberModal>
  );
}
