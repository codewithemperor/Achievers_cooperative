import Link from "next/link";
import Image from "next/image";
import { ctaSection } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export default function CtaSection() {
  return (
    <section className="bg-coop-dark py-24 overflow-hidden relative">
      {/* Decorative images grid */}
      <div className="absolute inset-0 grid grid-cols-4 gap-2 opacity-20 pointer-events-none">
        {[
          "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=60",
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=60",
          "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&q=60",
          "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=400&q=60",
          "https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=400&q=60",
          "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=60",
          "https://images.unsplash.com/photo-1618641986557-1ecd230959aa?w=400&q=60",
          "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&q=60",
        ].map((src, i) => (
          <div key={i} className="relative overflow-hidden rounded-2xl">
            <Image src={src} alt="" fill className="object-cover" />
          </div>
        ))}
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-coop-dark/70" />

      {/* Content */}
      <div className="relative section-padding mx-auto max-w-[1400px] text-center">
        <AnimatedSection>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold text-coop-cream leading-[1.1] mb-6 whitespace-pre-line">
            {ctaSection.headline}
          </h2>
          <p className="text-coop-cream/70 text-lg max-w-md mx-auto leading-relaxed mb-10">
            {ctaSection.subheadline}
          </p>
          <Link
            href={ctaSection.ctaHref}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-coop-cream text-coop-dark font-semibold text-sm hover:bg-coop-light hover:text-white transition-all duration-300"
          >
            {ctaSection.ctaLabel} →
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
