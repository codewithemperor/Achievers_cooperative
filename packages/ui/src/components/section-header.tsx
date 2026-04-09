import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  centered?: boolean;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  centered = false
}: SectionHeaderProps) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--brand-gold)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--brand-ink)] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
