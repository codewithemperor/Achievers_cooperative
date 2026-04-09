import { Card, CardBody } from "@heroui/react";

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card className="border border-dashed border-slate-300 bg-white/70">
      <CardBody className="p-8 text-center">
        <h3 className="text-lg font-semibold text-[var(--brand-ink)]">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </CardBody>
    </Card>
  );
}
