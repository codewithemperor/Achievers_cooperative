import { Button } from "@heroui/react";
import { AppShell, MetricCard, SectionHeader, StatusBadge } from "@achievers/ui";
import { formatCurrency } from "@achievers/utils";

const quickActions = ["Fund wallet", "View loan status", "Add savings", "Browse investments"];

export default function MemberHomePage() {
  return (
    <AppShell
      title="Member PWA"
      subtitle="Installable member experience for cooperative financial services."
      actions={<StatusBadge tone="success">PWA foundation ready</StatusBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <SectionHeader
            eyebrow="Member dashboard"
            title="A calm home screen for the highest-frequency member tasks"
            description="This initial shell establishes the structure for wallet, savings, loans, investments, and notification surfaces."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <MetricCard detail="Available now" label="Wallet balance" value={formatCurrency(125000)} />
            <MetricCard detail="Across active contributions" label="Savings total" value={formatCurrency(540000)} />
            <MetricCard detail="Awaiting next approval step" label="Loan status" value="Under review" />
            <MetricCard detail="Across 2 active plans" label="Investments" value={formatCurrency(320000)} />
          </div>
        </section>
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--brand-ink)]">Priority quick actions</h2>
          <div className="mt-6 grid gap-3">
            {quickActions.map((action) => (
              <Button key={action} className="justify-start bg-[var(--brand-mist)] text-[var(--brand-ink)]" radius="lg" variant="flat">
                {action}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
