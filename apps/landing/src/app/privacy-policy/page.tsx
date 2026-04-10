import type { Metadata } from "next";
import { siteConfig } from "@/data/content";

export const metadata: Metadata = {
  title: `Privacy Policy | ${siteConfig.name}`,
};

export const dynamic = "force-static";

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-20 bg-coop-cream min-h-screen">
      <div className="section-padding mx-auto max-w-[900px] py-24">
        <h1 className="font-display text-4xl font-semibold text-coop-dark mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm text-coop-muted mb-12">Last updated: January 1, 2025</p>

        <div className="prose prose-lg max-w-none text-coop-muted space-y-8 leading-relaxed">
          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              1. Information We Collect
            </h2>
            <p>
              Unity Cooperative Association collects information necessary to provide cooperative financial services. This includes your name, contact information, national identification number, and financial details necessary to process membership applications, savings plans, and loan requests.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              2. How We Use Your Information
            </h2>
            <p>
              We use your personal information exclusively to administer your membership, process financial transactions, communicate important cooperative updates, and fulfil our regulatory obligations. We do not sell or share your personal data with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              3. Data Security
            </h2>
            <p>
              All member data is stored securely in encrypted databases and is accessible only to authorised personnel. We employ industry-standard security measures and conduct annual security audits.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              4. Your Rights
            </h2>
            <p>
              As a member, you have the right to access, correct, or request deletion of your personal data at any time. To exercise these rights, contact us at{" "}
              <a href={`mailto:${siteConfig.contactEmail}`} className="text-coop-green hover:underline">
                {siteConfig.contactEmail}
              </a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold text-coop-dark mb-3">
              5. Contact
            </h2>
            <p>
              For any privacy-related concerns, please contact our Data Protection Officer at {siteConfig.contactEmail} or visit our head office at {siteConfig.address}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
