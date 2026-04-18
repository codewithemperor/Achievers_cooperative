import type { ReactNode } from "react";
import clsx from "clsx";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  icon?: ReactNode;
  color?: "green" | "sand" | "dark" | "gold";
}

const colorMap = {
  green: "from-[rgba(45,90,39,0.98)] to-[rgba(61,122,53,0.9)] text-white",
  sand: "from-[rgba(232,224,208,0.95)] to-[rgba(245,240,232,0.98)] text-[var(--color-dark)]",
  dark: "from-[rgba(26,46,26,1)] to-[rgba(45,90,39,0.9)] text-white",
  gold: "from-[rgba(214,176,84,0.95)] to-[rgba(232,224,208,0.96)] text-[var(--color-dark)]",
} as const;

export function StatCard({ title, value, change, icon, color = "sand" }: StatCardProps) {
  return (
    <div
      className={clsx(
        "rounded-[1.75rem] border border-white/60 bg-gradient-to-br p-5 shadow-[0_18px_45px_rgba(26,46,26,0.08)]",
        colorMap[color],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
          {change ? <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] opacity-75">{change}</p> : null}
        </div>
        {icon ? <div className="rounded-2xl bg-white/15 p-3">{icon}</div> : null}
      </div>
    </div>
  );
}
