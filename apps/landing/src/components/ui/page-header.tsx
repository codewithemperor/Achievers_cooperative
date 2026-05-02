import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-primary-900/12 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-[var(--text-900)]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm text-[var(--text-400)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
