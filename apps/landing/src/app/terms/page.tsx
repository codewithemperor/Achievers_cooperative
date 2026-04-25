import type { Metadata } from "next";
import { siteConfig } from "@/data/content";

export const metadata: Metadata = {
  title: `Terms & Conditions | ${siteConfig.name}`,
};

export const dynamic = "force-static";

export default function TermsPage() {
  return (
    <div className="pt-20 bg-coop-cream min-h-screen">
      <div className="section-padding mx-auto max-w-[900px] py-24">
        <h1 className="font-display text-4xl font-semibold text-coop-dark mb-3">
          Terms & Conditions
        </h1>
        <p className="text-sm text-coop-muted mb-12">Last updated: January 1, 2025</p>

        <div className="prose prose-lg max-w-none text-coop-muted space-y-8 leading-relaxed">
          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              1. Membership
            </h2>
            <p>
              Membership in Achievers Cooperative Association is open to all individuals of legal age who subscribe to the cooperative&apos;s values and fulfil the financial requirements outlined during registration. Membership confers voting rights and access to all cooperative services.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              2. Financial Obligations
            </h2>
            <p>
              Members are required to maintain their minimum share capital and meet regular contribution schedules as agreed upon at the time of enrollment. Failure to meet obligations may result in suspension of services.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              3. Governance
            </h2>
            <p>
              The cooperative is governed by its elected board and general membership. All members are encouraged to participate in Annual General Meetings and vote on resolutions that affect the cooperative&apos;s operations and direction.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              4. Limitation of Liability
            </h2>
            <p>
              Achievers Cooperative Association shall not be held liable for losses arising from circumstances beyond its control. All financial services are subject to the cooperative&apos;s bylaws and applicable Nigerian cooperative law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              5. Amendments
            </h2>
            <p>
              These terms may be amended by resolution of the board or general membership. Members will be notified of material changes with at least 30 days notice.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
