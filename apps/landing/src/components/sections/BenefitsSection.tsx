import Image from "next/image";
import { benefitsSection, benefits, statsNumbers } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { Shield, Coins, Megaphone, Network } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  shield: Shield,
  coins: Coins,
  megaphone: Megaphone,
  network: Network,
};

export default function BenefitsSection() {
  return (
    <section className="bg-coop-sand py-24 overflow-hidden">
      <div className="section-padding mx-auto max-w-[1400px]">
        {/* Header */}
        <AnimatedSection className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-coop-muted mb-4">
            {benefitsSection.label}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-coop-dark max-w-lg leading-[1.15]">
            {benefitsSection.headline}
          </h2>
          <p className="text-coop-muted max-w-sm mt-4 leading-relaxed">
            {benefitsSection.subheadline}
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Benefits list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {benefits.map((b, i) => {
              const Icon = iconMap[b.icon] ?? Shield;
              return (
                <AnimatedSection key={b.title} delay={i * 80}>
                  <div className="bg-coop-cream rounded-3xl p-6 h-full">
                    <div className="w-10 h-10 rounded-2xl bg-coop-green/10 flex items-center justify-center mb-4">
                      <Icon size={18} className="text-coop-green" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-coop-dark mb-2">
                      {b.title}
                    </h3>
                    <p className="text-sm text-coop-muted leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>

          {/* Right column — image + stats */}
          <div className="flex flex-col gap-5">
            {/* Image */}
            <AnimatedSection delay={100}>
              <div className="relative h-64 rounded-4xl overflow-hidden bg-coop-green/20">
                <Image
                  src="https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=800&q=80"
                  alt="Cooperative members in discussion"
                  fill
                  className="object-cover"
                />
                {/* Overlay card */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-coop-green flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">UC</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-coop-dark">
                      Think of us as your financial family
                    </p>
                    <p className="text-xs text-coop-muted">
                      Member-owned. Member-governed.
                    </p>
                  </div>
                </div>
              </div>
            </AnimatedSection>

            {/* Stats grid */}
            <AnimatedSection delay={200}>
              <div className="grid grid-cols-2 gap-4">
                {statsNumbers.map((stat, i) => (
                  <div
                    key={i}
                    className="bg-coop-dark rounded-3xl p-6 text-coop-cream"
                  >
                    <p className="font-display text-3xl font-semibold mb-1">
                      {stat.value}
                    </p>
                    <p className="text-sm text-coop-cream/60">{stat.label}</p>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
}
