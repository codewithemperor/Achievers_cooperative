import { Card, CardBody } from "@heroui/react";
import { SectionHeader } from "@achievers/ui";

const services = [
  ["Savings management", "Members view balances, contribute more funds, and track history from one dashboard."],
  ["Loan services", "Applications, review status, repayment schedules, and admin approvals stay visible."],
  ["Investment services", "Products, expected returns, and maturity tracking remain easy to understand."],
  ["Wallet funding", "Members fund wallets by bank transfer and receipt upload with admin verification."],
  ["Administrative controls", "Operations staff manage approvals, system settings, reports, and audit trails."],
  ["Notifications", "The platform is ready for SMS, email, push, and in-app updates as the product grows."]
];

export default function ServicesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeader
        eyebrow="Services"
        title="Core financial and administrative capabilities"
        description="The cooperative platform combines member services and operational oversight into one coordinated system."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {services.map(([title, body]) => (
          <Card key={title} className="border border-slate-200 bg-white">
            <CardBody className="p-6">
              <h2 className="text-xl font-semibold text-[var(--brand-ink)]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  );
}
