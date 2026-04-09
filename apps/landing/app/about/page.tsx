import { Card, CardBody } from "@heroui/react";
import { SectionHeader } from "@achievers/ui";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeader
        eyebrow="About the cooperative"
        title="A digital foundation for a trust-based financial community"
        description="Achievers Cooperative is positioned as a modern, transparent financial community where members can access savings, loans, investments, and accountable service delivery from one coordinated platform."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Mission",
            body: "Help members build financial resilience through reliable cooperative services and transparent digital operations."
          },
          {
            title: "Vision",
            body: "Become a reference point for cooperative innovation by combining member trust with efficient digital systems."
          },
          {
            title: "Values",
            body: "Trust, accountability, accessibility, and disciplined financial stewardship shape every operational choice."
          }
        ].map((item) => (
          <Card key={item.title} className="border border-slate-200 bg-white">
            <CardBody className="p-6">
              <h2 className="text-xl font-semibold text-[var(--brand-ink)]">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  );
}
