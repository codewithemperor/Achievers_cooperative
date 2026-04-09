import Link from "next/link";
import { Button, Card, CardBody, Divider } from "@heroui/react";
import { MetricCard, SectionHeader, StatusBadge } from "@achievers/ui";

const memberFeatures = [
  {
    title: "Wallet funding with verification",
    description: "Members upload receipts, track approval status, and see transparent wallet updates."
  },
  {
    title: "Savings and investments",
    description: "Contribute, monitor balances, and understand returns from one guided dashboard."
  },
  {
    title: "Loan lifecycle visibility",
    description: "Apply, monitor approval, review terms, and manage repayments with confidence."
  }
];

const adminFeatures = [
  "Member onboarding and profile oversight",
  "Receipt verification and wallet approvals",
  "Loan review, decisions, and disbursement records",
  "Reports, analytics, and audit-ready transaction trails"
];

const trustPillars = [
  "Role-based controls for administrators",
  "Transparent financial activity tracking",
  "Configurable charges and system settings",
  "Documentation, notifications, and audit support"
];

export default function LandingHomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative border-b border-white/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
          <div>
            <StatusBadge tone="warning">Trusted digital operations for cooperative finance</StatusBadge>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-tight tracking-tight text-[var(--brand-ink)] sm:text-6xl">
              A modern cooperative experience built for member confidence and operational control.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Achievers Cooperative unifies savings, loans, investments, wallet funding, and administrative
              oversight into one secure digital platform designed for trust, transparency, and growth.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                as={Link}
                href="/contact"
                className="bg-[var(--brand-ink)] px-8 text-white"
                radius="full"
                size="lg"
              >
                Request a Demo
              </Button>
              <Button
                as={Link}
                href="/login"
                className="border border-[var(--brand-ink)] bg-white/70 px-8 text-[var(--brand-ink)]"
                radius="full"
                size="lg"
                variant="bordered"
              >
                Member Login
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-500">
              <span>Member-first onboarding</span>
              <span>Audit-conscious workflows</span>
              <span>Desktop-ready admin control</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(200,155,60,0.32),_transparent_52%)] blur-2xl" />
            <Card className="rounded-[2rem] border border-white/60 bg-white/75 shadow-2xl backdrop-blur-xl">
              <CardBody className="gap-6 p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--brand-gold)]">
                      Cooperative performance
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">Operations at a glance</h2>
                  </div>
                  <StatusBadge tone="success">Live-ready</StatusBadge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MetricCard
                    detail="Across member wallet and savings flows"
                    label="Transaction visibility"
                    value="100%"
                  />
                  <MetricCard
                    detail="Admin review points for sensitive actions"
                    label="Approval checkpoints"
                    value="4 core"
                  />
                  <MetricCard detail="Foundational services in the MVP" label="Priority modules" value="6" />
                  <MetricCard detail="Estimated total delivery runway" label="Implementation horizon" value="9-13 weeks" />
                </div>
                <Divider />
                <div className="grid gap-3 text-sm text-slate-600">
                  <p className="font-semibold text-[var(--brand-ink)]">Why the platform direction works</p>
                  <p>
                    The member experience is designed as an installable PWA, while administrators get a robust
                    desktop-first web interface for approvals, monitoring, and reporting.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader
          centered
          description="The proposal centers on a dual-application structure: a simple member-facing experience and a powerful admin portal sharing one secure backend."
          eyebrow="Why Achievers Cooperative"
          title="Designed around clarity for members and control for administrators"
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {memberFeatures.map((feature) => (
            <Card key={feature.title} className="border border-white/70 bg-white/80 shadow-sm backdrop-blur">
              <CardBody className="p-6">
                <h3 className="text-xl font-semibold text-[var(--brand-ink)]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white/65">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2">
          <div>
            <SectionHeader
              description="Members move through guided financial flows without needing to understand back-office complexity."
              eyebrow="Member experience"
              title="Everything a cooperative member needs in one calm, transparent interface"
            />
            <div className="mt-8 space-y-4">
              {memberFeatures.map((feature) => (
                <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="font-semibold text-[var(--brand-ink)]">{feature.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHeader
              description="Administrative users get the oversight tools required for high-trust financial operations."
              eyebrow="Administrative oversight"
              title="A web workspace built for approvals, monitoring, and reporting"
            />
            <div className="mt-8 grid gap-4">
              {adminFeatures.map((feature) => (
                <Card key={feature} className="border border-slate-200 bg-[var(--brand-mist)]/60">
                  <CardBody className="flex flex-row items-center gap-4 p-5">
                    <div className="size-3 rounded-full bg-[var(--brand-gold)]" />
                    <p className="text-sm font-medium text-[var(--brand-ink)]">{feature}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionHeader
            description="Every high-trust cooperative platform has to communicate governance as clearly as it communicates features."
            eyebrow="Trust and security"
            title="Built around the controls cooperative teams expect"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {trustPillars.map((pillar) => (
              <Card key={pillar} className="border border-slate-200 bg-white shadow-sm">
                <CardBody className="p-5">
                  <p className="text-base font-semibold text-[var(--brand-ink)]">{pillar}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--brand-ink)] text-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeader
            centered
            description="A simple three-step journey helps stakeholders understand the transformation from manual processes to a digital operating model."
            eyebrow="How it works"
            title="From member onboarding to daily operations, the flow stays understandable"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Members register and access their account",
                body: "Onboarding establishes identity, membership status, and secure access to core services."
              },
              {
                step: "02",
                title: "Wallet, savings, loans, and investments stay connected",
                body: "Financial actions feed into one transparent operational system instead of fragmented manual records."
              },
              {
                step: "03",
                title: "Administrators verify, approve, and report",
                body: "Operational decisions, audit trails, and reporting tools give the cooperative full oversight."
              }
            ].map((item) => (
              <Card key={item.step} className="border border-white/10 bg-white/5 text-white">
                <CardBody className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--brand-gold)]">
                    Step {item.step}
                  </p>
                  <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{item.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader
          centered
          description="These proof points are placeholder-ready so the cooperative can later add testimonials, milestones, and institutional trust markers."
          eyebrow="Proof and readiness"
          title="Prepared for stakeholder review and member confidence"
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
          {[
            {
              title: "Operational transparency",
              detail: "Clear records for funding approvals, loan decisions, and system activity."
            },
            {
              title: "Scalable digital foundation",
              detail: "Member PWA, admin workspace, and unified backend are designed to grow together."
            },
            {
              title: "Implementation pathway",
              detail: "MVP-first delivery keeps the project grounded in immediate cooperative value."
            }
          ].map((item) => (
            <Card key={item.title} className="border border-slate-200 bg-white">
              <CardBody className="p-6">
                <h3 className="text-lg font-semibold text-[var(--brand-ink)]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.detail}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-6 mb-6 rounded-[2rem] bg-[linear-gradient(135deg,_#13213a,_#1d3557)] text-white shadow-2xl">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
          <SectionHeader
            description="Start with a trust-first landing presence now, then extend the same design language into the member PWA and admin experience."
            eyebrow="Next step"
            title="Launch the cooperative’s digital front door with confidence"
          />
          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              as={Link}
              href="/contact"
              className="bg-[var(--brand-gold)] px-8 text-[var(--brand-ink)]"
              radius="full"
              size="lg"
            >
              Talk to the Team
            </Button>
            <Button
              as={Link}
              href="/services"
              className="border border-white/20 px-8 text-white"
              radius="full"
              size="lg"
              variant="bordered"
            >
              Explore Services
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
