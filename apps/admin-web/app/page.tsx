import { Card, CardBody } from "@heroui/react";
import { AppShell, MetricCard, SectionHeader, StatusBadge } from "@achievers/ui";

export default function AdminHomePage() {
  return (
    <AppShell
      title="Administrative Portal"
      subtitle="Desktop-first operations shell for approvals, monitoring, reporting, and control."
      actions={<StatusBadge tone="warning">Admin workspace scaffold</StatusBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <section>
          <SectionHeader
            eyebrow="Operations overview"
            title="The admin app starts with the highest-trust workflows"
            description="This shell is reserved for member management, loan decisions, payment verification, reporting, and system configuration."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <MetricCard detail="Receipt uploads and manual checks" label="Pending wallet approvals" value="18" />
            <MetricCard detail="Applications awaiting a decision" label="Loan queue" value="7" />
            <MetricCard detail="Tracked for board and audit review" label="Today’s transactions" value="126" />
            <MetricCard detail="Operational members under management" label="Active members" value="842" />
          </div>
        </section>
        <section className="grid gap-4">
          {[
            "Member management and status controls",
            "Loan processing and decision trail",
            "Payment verification and wallet credit approvals",
            "Investment product configuration",
            "Reporting and audit support"
          ].map((item) => (
            <Card key={item} className="border border-slate-200 bg-white">
              <CardBody className="p-5">
                <p className="font-medium text-[var(--brand-ink)]">{item}</p>
              </CardBody>
            </Card>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
