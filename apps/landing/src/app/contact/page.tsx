import type { Metadata } from "next";
import { siteConfig } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import ContactForm from "@/components/ui/ContactForm";

export const metadata: Metadata = {
  title: `Contact Us | ${siteConfig.name}`,
  description: `Get in touch with ${siteConfig.name}. We'd love to hear from you.`,
};

export const dynamic = "force-static";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background-50 pt-20">
      <div className="section-padding mx-auto max-w-[1400px] py-24">
        <AnimatedSection className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-400">
            Contact
          </p>
          <h1 className="max-w-xl font-display text-5xl font-semibold leading-[1.1] text-text-900 md:text-6xl">
            Let&apos;s start a conversation
          </h1>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <AnimatedSection>
            <div className="space-y-8">
              <p className="max-w-md text-lg leading-relaxed text-text-400">
                Whether you&apos;re interested in membership, have questions about our services, or want to learn more, we&apos;re here.
              </p>

              <div className="space-y-5">
                {[
                  {
                    icon: MapPin,
                    label: "Address",
                    value: siteConfig.address,
                  },
                  {
                    icon: Phone,
                    label: "Phone",
                    value: siteConfig.contactPhone,
                  },
                  {
                    icon: Mail,
                    label: "Email",
                    value: siteConfig.contactEmail,
                  },
                  {
                    icon: Clock,
                    label: "Office Hours",
                    value: "Mon - Fri, 8:00 AM - 5:00 PM",
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-700/10">
                      <item.icon size={16} className="text-primary-700" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-400">
                        {item.label}
                      </p>
                      <p className="text-sm text-text-900">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <ContactForm />
          </AnimatedSection>
        </div>
      </div>
    </div>
  );
}
