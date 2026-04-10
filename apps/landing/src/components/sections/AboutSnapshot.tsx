import Link from "next/link";
import { aboutSnapshot } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export default function AboutSnapshot() {
  return (
    <section className="bg-coop-dark text-coop-cream py-20">
      <div className="section-padding mx-auto max-w-[1400px]">
        <AnimatedSection>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-coop-cream/40 mb-5">
                {aboutSnapshot.label}
              </p>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-medium leading-[1.2] text-balance">
                {aboutSnapshot.headline}
              </h2>
            </div>
            <Link
              href={aboutSnapshot.ctaHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-coop-cream/30 text-sm font-medium hover:bg-coop-cream hover:text-coop-dark transition-all duration-200 whitespace-nowrap self-start md:self-auto"
            >
              {aboutSnapshot.ctaLabel}
              <span>→</span>
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
