import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[rgba(26,46,26,0.12)] pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-mid)]">
          Cooperative Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-dark)]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm text-[var(--color-coop-muted)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
