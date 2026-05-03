"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate, formatMoney, formatTime } from "@/lib/member-format";
import {
  getStatusTone,
  getTransactionTitle,
  getTransactionTone,
} from "@/lib/transaction-ui";

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
    <div className="rounded-[20px] border border-background-200 dark:border-white/8 bg-background-50 dark:bg-background-100 px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.iconBg} ${tone.iconColor}`}
        >
          {tone.icon}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* Left: title + subtitle */}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold font-display text-text-900 dark:text-text-50">
                {getTransactionTitle(type, title)}
              </p>
              {subtitle ? (
                <p className="truncate text-xs text-text-400 mt-0.5">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {/* Right: amount + status */}
            <div className="shrink-0 text-right">
              {typeof amount === "number" ? (
                <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                  {formatMoney(amount)}
                </p>
              ) : amountLabel ? (
                <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                  {amountLabel}
                </p>
              ) : null}
              {status ? (
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${statusTone.badge}`}
                >
                  {status.replaceAll("_", " ")}
                </span>
              ) : null}
            </div>
          </div>

          {/* Footer row: date/time + cta or extra inline */}
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-text-400">
            <span>
              {formatDate(timestamp)} · {formatTime(timestamp)}
            </span>

            {ctaLabel ? (
              <span className="inline-flex items-center gap-0.5 font-semibold text-primary-600 dark:text-primary-400">
                {ctaLabel}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            ) : extra ? (
              <div className="flex items-center gap-1.5">{extra}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{body}</Link>;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {body}
      </button>
    );
  }
  return body;
}
