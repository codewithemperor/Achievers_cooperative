import type { Metadata } from "next";
import Image from "next/image";
import { aboutPage, siteConfig } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export const metadata: Metadata = {
  title: `About Us | ${siteConfig.name}`,
  description: `Learn about the history, mission, and values of ${siteConfig.name}.`,
};

export const dynamic = "force-static";

export default function AboutPage() {
  return (
    <div className="pt-20 bg-background-50">
      {/* Hero */}
      <section className="section-padding mx-auto max-w-[1400px] py-24">
        <AnimatedSection>
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary-700/10 border border-primary-700/20 text-xs font-semibold text-text-700 mb-8">
            {aboutPage.badge}
          </span>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold text-text-900 leading-[1.1] max-w-4xl whitespace-pre-line mb-8">
            {aboutPage.headline}
          </h1>
          <p className="text-text-400 text-lg leading-relaxed max-w-2xl">
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
              alt="Achievers Coop community gathering"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary-900/40 to-transparent" />
          </div>
        </AnimatedSection>
      </div>

      {/* History */}
      <section className="bg-background-100 py-24">
        <div className="section-padding mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <AnimatedSection>
              <p className="text-xs font-semibold uppercase tracking-widest text-text-400 mb-4">
                Our History
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-text-900 mb-6 leading-snug">
                Two decades of collective strength
              </h2>
            </AnimatedSection>
            <AnimatedSection delay={100}>
              <div className="space-y-4 text-text-400 leading-relaxed">
                {aboutPage.history.split("\n\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 bg-background-50">
        <div className="section-padding mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatedSection>
              <div className="bg-primary-900 text-background-50 rounded-4xl p-10 h-full">
                <p className="text-xs font-semibold uppercase tracking-widest text-background-50/40 mb-5">
                  Our Mission
                </p>
                <p className="font-display text-2xl font-medium leading-relaxed">
                  {aboutPage.mission}
                </p>
              </div>
            </AnimatedSection>
            <AnimatedSection delay={100}>
              <div className="bg-primary-700 text-background-50 rounded-4xl p-10 h-full">
                <p className="text-xs font-semibold uppercase tracking-widest text-background-50/40 mb-5">
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
      <section className="bg-background-100 py-24">
        <div className="section-padding mx-auto max-w-[1400px]">
          <AnimatedSection className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-400 mb-4">
              Core Values
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-text-900">
              What we stand for
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {aboutPage.values.map((value, i) => (
              <AnimatedSection key={value.title} delay={i * 70}>
                <div className="bg-background-50 rounded-3xl p-7 h-full">
                  <span className="inline-block w-8 h-8 rounded-full bg-primary-700/20 text-primary-700 font-bold text-sm flex items-center justify-center mb-4">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-text-900 mb-2">
                    {value.title}
                  </h3>
                  <p className="text-sm text-text-400 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-background-50 py-24">
        <div className="section-padding mx-auto max-w-[1400px]">
          <AnimatedSection className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-400 mb-4">
              Leadership
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-text-900">
              The people behind the mission
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {aboutPage.team.map((member, i) => (
              <AnimatedSection key={member.name} delay={i * 80}>
                <div className="group rounded-3xl overflow-hidden bg-background-100 card-lift">
                  <div className="relative h-56 overflow-hidden">
                    <Image
                      src={member.avatar}
                      alt={member.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-base font-semibold text-text-900">
                      {member.name}
                    </h3>
                    <p className="text-xs font-medium text-text-500 mb-2">
                      {member.role}
                    </p>
                    <p className="text-xs text-text-400 leading-relaxed">
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
