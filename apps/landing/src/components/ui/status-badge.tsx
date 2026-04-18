import clsx from "clsx";

interface StatusBadgeProps {
  status: string;
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
}

const variantMap = {
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-rose-100 text-rose-800 border-rose-200",
  info: "bg-sky-100 text-sky-800 border-sky-200",
  neutral: "bg-stone-100 text-stone-700 border-stone-200",
} as const;

export function StatusBadge({ status, variant = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
        variantMap[variant],
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
