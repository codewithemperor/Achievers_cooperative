import type { Metadata } from "next";
import Image from "next/image";
import { aboutPage, siteConfig } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export const metadata: Metadata = {
  title: `About Us | ${siteConfig.name}`,
  description: `Learn about the history, mission, and values of ${siteConfig.name}.`,
};

export const dynamic = "force-static";

const teamImages = [
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&q=80",
  "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=400&q=80",
];

export default function AboutPage() {
  return (
    <div className="pt-20 bg-coop-cream">
      {/* Hero */}
      <section className="section-padding mx-auto max-w-[1400px] py-24">
        <AnimatedSection>
          <span className="inline-block px-4 py-1.5 rounded-full bg-coop-green/10 border border-coop-green/20 text-xs font-semibold text-coop-green mb-8">
            {aboutPage.badge}
          </span>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold text-coop-dark leading-[1.1] max-w-4xl whitespace-pre-line mb-8">
            {aboutPage.headline}
          </h1>
          <p className="text-coop-muted text-lg leading-relaxed max-w-2xl">
            {aboutPage.intro}
          </p>
        </AnimatedSection>
      </section>

      {/* Full-width image */}
      <div className="section-padding mx-auto max-w-[1400px] mb-24">
        <AnimatedSection>
          <div className="relative h-80 md:h-[500px] rounded-4xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=1400&q=80"
              alt="Unity Coop community gathering"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-coop-dark/40 to-transparent" />
          </div>
        </AnimatedSection>
      </div>

      {/* History */}
      <section className="bg-coop-sand py-24">
        <div className="section-padding mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <AnimatedSection>
              <p className="text-xs font-semibold uppercase tracking-widest text-coop-muted mb-4">Our History</p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-coop-dark mb-6 leading-snug">
                Two decades of collective strength
              </h2>
            </AnimatedSection>
            <AnimatedSection delay={100}>
              <div className="space-y-4 text-coop-muted leading-relaxed">
                {aboutPage.history.split("\n\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 bg-coop-cream">
        <div className="section-padding mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatedSection>
              <div className="bg-coop-dark text-coop-cream rounded-4xl p-10 h-full">
                <p className="text-xs font-semibold uppercase tracking-widest text-coop-cream/40 mb-5">
                  Our Mission
                </p>
                <p className="font-display text-2xl font-medium leading-relaxed">
                  {aboutPage.mission}
                </p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={100}>
              <div className="bg-coop-green text-coop-cream rounded-4xl p-10 h-full">
                <p className="text-xs font-semibold uppercase tracking-widest text-coop-cream/40 mb-5">
                  Our Vision
                </p>
                <p className="font-display text-2xl font-medium leading-relaxed">
                  {aboutPage.vision}
                </p>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-coop-sand py-24">
        <div className="section-padding mx-auto max-w-[1400px]">
          <AnimatedSection className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-coop-muted mb-4">
              Core Values
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-coop-dark">
              What we stand for
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {aboutPage.values.map((value, i) => (
              <AnimatedSection key={value.title} delay={i * 70}>
                <div className="bg-coop-cream rounded-3xl p-7 h-full">
                  <span className="inline-block w-8 h-8 rounded-full bg-coop-green/20 text-coop-green font-bold text-sm flex items-center justify-center mb-4">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-coop-dark mb-2">
                    {value.title}
                  </h3>
                  <p className="text-sm text-coop-muted leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-coop-cream py-24">
        <div className="section-padding mx-auto max-w-[1400px]">
          <AnimatedSection className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-coop-muted mb-4">
              Leadership
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-coop-dark">
              The people behind the mission
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {aboutPage.team.map((member, i) => (
              <AnimatedSection key={member.name} delay={i * 80}>
                <div className="group rounded-3xl overflow-hidden bg-coop-sand card-lift">
                  <div className="relative h-56 overflow-hidden">
                    <Image
                      src={teamImages[i]}
                      alt={member.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-base font-semibold text-coop-dark">
                      {member.name}
                    </h3>
                    <p className="text-xs font-medium text-coop-green mb-2">
                      {member.role}
                    </p>
                    <p className="text-xs text-coop-muted leading-relaxed">
                      {member.bio}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
