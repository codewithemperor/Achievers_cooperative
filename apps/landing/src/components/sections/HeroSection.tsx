"use client";

import Link from "next/link";
import Image from "next/image";
import { hero } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-coop-cream pb-16 pt-24"
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a2e1a' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="section-padding relative mx-auto max-w-[1400px]">
        <AnimatedSection delay={0}>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-coop-green/20 bg-coop-green/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-coop-light" />
            <span className="text-xs font-medium text-coop-green">
              {hero.badge}
            </span>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <AnimatedSection delay={100}>
              <h1 className="mb-6 whitespace-pre-line font-display text-5xl font-semibold leading-[1.1] text-coop-dark text-balance md:text-6xl xl:text-7xl">
                {hero.headline}
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={200}>
              <p className="mb-10 max-w-md text-lg leading-relaxed text-coop-muted">
                {hero.subheadline}
              </p>
            </AnimatedSection>

            <AnimatedSection delay={300}>
              <Link
                href={hero.ctaHref}
                className="inline-flex items-center gap-2 rounded-full bg-coop-dark px-7 py-4 text-sm font-medium text-white transition-all duration-300 hover:gap-3 hover:bg-coop-green"
              >
                {hero.ctaLabel}
                <span className="text-lg leading-none" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </AnimatedSection>
          </div>

          <AnimatedSection delay={150} className="relative">
            <div className="grid h-[520px] grid-cols-2 gap-3">
              <div className="relative row-span-2 overflow-hidden rounded-3xl bg-coop-green/20">
                <Image
                  src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80"
                  alt="Community members meeting"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-coop-sand">
                <Image
                  src="https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&q=80"
                  alt="Cooperative gathering"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-coop-green/30">
                <Image
                  src="https://images.unsplash.com/photo-1464863979621-258859e62245?w=600&q=80"
                  alt="Members working together"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
