"use client";

import { useMemberData } from "@/hooks/use-member-data";

interface DashboardPayload {
  termsHtml: string;
}

export default function AccountTermsAndConditionsPage() {
  const dashboard = useMemberData<DashboardPayload>("/members/me/dashboard", {
    termsHtml: "<p>Terms and conditions will appear here once connected.</p>",
  });

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white/92 p-5 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <h1 className="text-xl font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">Terms and conditions</h1>
        <div
          className="prose prose-sm mt-5 max-w-none text-[var(--text-700)] dark:text-[var(--text-200)]"
          dangerouslySetInnerHTML={{ __html: dashboard.data.termsHtml }}
        />
      </section>
    </div>
  );
}
