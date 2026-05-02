"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate, formatMoney, formatTime } from "@/lib/member-format";
import { getStatusTone, getTransactionTitle, getTransactionTone } from "@/lib/transaction-ui";

interface TransactionCardProps {
  type?: string | null;
  title?: string | null;
  subtitle?: string | null;
  amount?: number | null;
  amountLabel?: string | null;
  status?: string | null;
  timestamp?: string | null;
  ctaLabel?: string;
  href?: string;
  onClick?: () => void;
  extra?: ReactNode;
}

export function TransactionCard({
  type,
  title,
  subtitle,
  amount,
  amountLabel,
  status,
  timestamp,
  ctaLabel,
  href,
  onClick,
  extra,
}: TransactionCardProps) {
  const tone = getTransactionTone(type);
  const statusTone = getStatusTone(status);
  const body = (
    <div className="rounded-[24px] border border-white/55 bg-white/88 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/8 dark:bg-white/6">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.iconBg} ${tone.iconColor}`}>
          {tone.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">
                {getTransactionTitle(type, title)}
              </p>
              {subtitle ? (
                <p className="mt-1 line-clamp-2 text-sm text-[var(--text-500)] dark:text-[var(--text-300)]">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              {typeof amount === "number" ? (
                <p className="text-[15px] font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">
                  {formatMoney(amount)}
                </p>
              ) : amountLabel ? (
                <p className="text-[15px] font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">
                  {amountLabel}
                </p>
              ) : null}
              {status ? (
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusTone.badge}`}>
                  {status.replaceAll("_", " ")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--text-400)] dark:text-[var(--text-400)]">
            <span>{formatDate(timestamp)}</span>
            <span>{formatTime(timestamp)}</span>
          </div>

          {extra ? <div className="mt-3">{extra}</div> : null}

          {ctaLabel ? (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary-600)] dark:text-[var(--primary-700)]">
                {ctaLabel}
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{body}</Link>;
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {body}
      </button>
    );
  }

  return body;
}
