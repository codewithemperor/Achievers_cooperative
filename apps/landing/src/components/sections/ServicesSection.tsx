import Link from "next/link";
import Image from "next/image";
import { servicesSection, services } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export default function ServicesSection() {
  return (
    <section id="services" className="bg-background-50 py-24">
      <div className="section-padding mx-auto max-w-[1400px]">
        <AnimatedSection className="mb-14">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-400">
            {servicesSection.label}
          </p>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-lg font-display text-4xl font-semibold leading-[1.15] text-text-900 md:text-5xl">
              {servicesSection.headline}
            </h2>
            <p className="max-w-sm leading-relaxed text-text-400">
              {servicesSection.subheadline}
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {services.map((service, i) => (
            <AnimatedSection key={service.slug} delay={i * 100}>
              <Link
                href={`/services/${service.slug}`}
                className="group block overflow-hidden rounded-4xl bg-background-100 card-lift"
              >
                <div className="relative h-52 w-full overflow-hidden">
                  <Image
                    src={
                      i === 0
                        ? "https://images.unsplash.com/photo-1579621970590-9d624316904b?w=700&q=80"
                        : i === 1
                          ? "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=700&q=80"
                          : "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&q=80"
                    }
                    alt={service.imageAlt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="p-6">
                  <h3 className="mb-2 font-display text-xl font-semibold text-text-900">
                    {service.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-text-400">
                    {service.description}
                  </p>
                  <span className="mt-4 inline-block text-sm font-medium text-primary-700">
                    Learn more &rarr;
                  </span>
                </div>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
