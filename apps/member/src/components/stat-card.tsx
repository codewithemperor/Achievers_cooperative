import type { ReactNode } from "react";
import clsx from "clsx";

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  accent?: "green" | "blue" | "amber" | "dark" | "red";
}

const accentMap = {
  green: {
    border: "border-t-[var(--primary-600)]",
    iconBg: "bg-[var(--primary-50)] dark:bg-[var(--primary-900)]",
    iconColor: "text-[var(--primary-600)] dark:text-[var(--primary-400)]",
  },
  blue: {
    border: "border-t-[var(--secondary-500)]",
    iconBg: "bg-[var(--secondary-50)] dark:bg-[var(--secondary-900)]",
    iconColor: "text-[var(--secondary-500)] dark:text-[var(--secondary-400)]",
  },
  amber: {
    border: "border-t-[var(--accent-500)]",
    iconBg: "bg-[var(--accent-50)] dark:bg-[var(--accent-900)]",
    iconColor: "text-[var(--accent-600)] dark:text-[var(--accent-400)]",
  },
  dark: {
    border: "border-t-[var(--text-700)] dark:border-t-[var(--text-300)]",
    iconBg: "bg-[var(--background-100)] dark:bg-[var(--background-800)]",
    iconColor: "text-text-700 dark:text-[var(--text-300)]",
  },
  red: {
    border: "border-t-red-500",
    iconBg: "bg-red-50 dark:bg-red-900/30",
    iconColor: "text-red-500 dark:text-red-400",
  },
};

export function StatCard({
  title,
  value,
  sub,
  icon,
  accent = "green",
}: StatCardProps) {
  const style = accentMap[accent];

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border border-t-2 bg-white p-5 shadow-sm",
        "dark:bg-[var(--background-900)] dark:border-[var(--background-800)]",
        style.border,
        "dark:border-t-[var(--primary-700)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-400">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight text-text-900 dark:text-text-50">
            {value}
          </p>
          {sub ? <p className="mt-1 text-xs text-text-400">{sub}</p> : null}
        </div>
        {icon ? (
          <div
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              style.iconBg,
            )}
          >
            <div className={style.iconColor}>{icon}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
