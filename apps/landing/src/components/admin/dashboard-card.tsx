"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

type Tone = "green" | "amber" | "red" | "blue" | "neutral";

const toneMap: Record<Tone, string> = {
  green: "bg-[var(--primary-700)] text-white",
  amber:
    "bg-[#fff7e6] text-[#9a5b00] dark:bg-[#7a4b00] dark:text-[#ffdf75]",
  red: "bg-[#fff1f0] text-[#b42318] dark:bg-[#7f1d1d] dark:text-[#fecaca]",
  blue: "bg-[#eef4ff] text-[#175cd3] dark:bg-blue-950/35 dark:text-blue-300",
  neutral:
    "bg-white text-text-900 dark:bg-[var(--background-900)] dark:text-text-50",
};

const iconToneMap: Record<Tone, string> = {
  green: "bg-white/15 text-white",
  amber: "bg-[#fff0c2] text-[#9a5b00] dark:bg-[#9a5b00] dark:text-[#fff7c2]",
  red: "bg-[#fee4e2] text-[#b42318] dark:bg-[#991b1b] dark:text-[#fee2e2]",
  blue: "bg-[#dbeafe] text-[#175cd3]",
  neutral: "bg-background-100 text-text-700 dark:bg-[var(--background-800)] dark:text-text-200",
};

export function DashboardMetricCard({
  title,
  value,
  description,
  href,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  description: string;
  href: string;
  icon: ReactNode;
  tone?: Tone;
}) {
  const isGreen = tone === "green";

  return (
    <Link
      className={`group block rounded-2xl border border-primary-900/10 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[var(--background-800)] ${toneMap[tone]}`}
      href={href}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconToneMap[tone]}`}
        >
          {icon}
        </div>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
            isGreen
              ? "border-white/30 text-white"
              : "border-primary-900/12 text-text-900 dark:border-[var(--background-700)] dark:text-text-50"
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-5 text-sm font-semibold ${isGreen ? "text-white/85" : "text-text-500 dark:text-text-300"}`}>
        {title}
      </p>
      <p className="mt-2 text-4xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-3 text-sm ${isGreen ? "text-white/75" : "text-text-400 dark:text-text-400"}`}>
        {description}
      </p>
    </Link>
  );
}

export function DashboardPanel({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-900 dark:text-text-50">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-text-400">{subtitle}</p>
          ) : null}
        </div>
        {href ? (
          <Link
            className="rounded-full border border-primary-900/12 px-3 py-1.5 text-xs font-semibold text-text-700 transition hover:bg-background-100 dark:border-[var(--background-700)] dark:text-text-200 dark:hover:bg-[var(--background-800)]"
            href={href}
          >
            View all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardRequestCard({
  title,
  subtitle,
  amount,
  meta,
  href,
  status,
}: {
  title: string;
  subtitle: string;
  amount?: string;
  meta?: string;
  href: string;
  status?: string;
}) {
  return (
    <Link
      className="block rounded-2xl border border-primary-900/10 bg-background-50 p-4 transition hover:border-primary-700/30 hover:bg-white hover:shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-800)] dark:hover:bg-[var(--background-700)]"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-900 dark:text-text-50">
            {title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-text-400">{subtitle}</p>
        </div>
        {status ? (
          <span className="shrink-0 rounded-full bg-[#fff7e6] px-2.5 py-1 text-[11px] font-semibold text-[#9a5b00]">
            {status}
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-base font-semibold text-text-900 dark:text-text-50">{amount}</p>
        <p className="text-xs text-text-400">{meta}</p>
      </div>
    </Link>
  );
}
