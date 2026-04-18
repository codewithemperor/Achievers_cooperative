import type { ReactNode } from "react";
import { Card } from "@heroui/react";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
}

export function MetricCard({ label, value, detail, icon }: MetricCardProps) {
  return (
    <Card className="border border-white/60 bg-white/90 shadow-sm backdrop-blur">
      <Card.Content className="gap-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {icon ? (
            <span className="text-[var(--brand-gold)]">{icon}</span>
          ) : null}
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-[var(--brand-ink)]">
            {value}
          </p>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
      </Card.Content>
    </Card>
  );
}
