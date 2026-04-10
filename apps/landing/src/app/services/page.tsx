import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { services, siteConfig } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export const metadata: Metadata = {
  title: `Our Services | ${siteConfig.name}`,
  description: `Explore the cooperative financial services offered by ${siteConfig.name}.`,
};

export const dynamic = "force-static";

const serviceImages = [
  "https://images.unsplash.com/photo-1579621970590-9d624316904b?w=800&q=80",
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-coop-cream pt-20">
      <div className="section-padding mx-auto max-w-[1400px] py-24">
        <AnimatedSection className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-coop-muted">
            Services
          </p>
          <h1 className="max-w-xl font-display text-5xl font-semibold leading-[1.1] text-coop-dark md:text-6xl">
            Everything you need to grow financially
          </h1>
        </AnimatedSection>

        <div className="space-y-6">
          {services.map((service, i) => (
            <AnimatedSection key={service.slug} delay={i * 100}>
              <Link
                href={`/services/${service.slug}`}
                className="group grid grid-cols-1 gap-0 overflow-hidden rounded-4xl bg-coop-sand card-lift md:grid-cols-2"
              >
                <div
                  className={`relative h-72 md:h-80 ${i % 2 === 1 ? "md:order-2" : ""}`}
                >
                  <Image
                    src={serviceImages[i]}
                    alt={service.imageAlt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div
                  className={`flex flex-col justify-center p-10 ${i % 2 === 1 ? "md:order-1" : ""}`}
                >
                  <span className="mb-4 text-xs font-semibold uppercase tracking-widest text-coop-green">
                    Service {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="mb-4 font-display text-3xl font-semibold leading-snug text-coop-dark">
                    {service.title}
                  </h2>
                  <p className="mb-6 leading-relaxed text-coop-muted">
                    {service.description}
                  </p>
                  <span className="text-sm font-medium text-coop-green">
                    Explore service &rarr;
                  </span>
                </div>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </div>
  );
}
