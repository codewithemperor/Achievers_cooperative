import Link from "next/link";
import { Button, Card, CardBody } from "@heroui/react";
import { SectionHeader } from "@achievers/ui";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <SectionHeader
        centered
        eyebrow="Choose your portal"
        title="Route members and administrators to the right experience"
        description="This page acts as the public handoff point into the authenticated products."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Card className="border border-slate-200 bg-white">
          <CardBody className="gap-4 p-8">
            <h2 className="text-2xl font-semibold text-[var(--brand-ink)]">Member portal</h2>
            <p className="text-sm leading-7 text-slate-600">
              Access your wallet, savings, loans, investments, and transaction history from the installable member app.
            </p>
            <Button as={Link} className="bg-[var(--brand-ink)] text-white" href="https://member.achievers.local" radius="full">
              Open member app
            </Button>
          </CardBody>
        </Card>
        <Card className="border border-slate-200 bg-white">
          <CardBody className="gap-4 p-8">
            <h2 className="text-2xl font-semibold text-[var(--brand-ink)]">Admin portal</h2>
            <p className="text-sm leading-7 text-slate-600">
              Review member activity, approvals, reports, and system configuration from the admin workspace.
            </p>
            <Button as={Link} className="bg-[var(--brand-gold)] text-[var(--brand-ink)]" href="https://admin.achievers.local" radius="full">
              Open admin app
            </Button>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
