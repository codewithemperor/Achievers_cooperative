"use client";

import Link from "next/link";
import Image from "next/image";
import { hero } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-background-50 pb-16 pt-24"
    >
      <div className="section-padding relative mx-auto max-w-350">
        <AnimatedSection delay={0}>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary-700/20 bg-primary-700/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary-400" />
            <span className="text-xs font-medium text-primary-700">
              {hero.badge}
            </span>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <AnimatedSection delay={100}>
              <h1 className="mb-6 whitespace-pre-line font-display text-5xl font-semibold leading-[1.1] text-text-900 text-balance md:text-6xl xl:text-7xl">
                {hero.headline}
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={200}>
              <p className="mb-10 max-w-md text-lg leading-relaxed text-text-400">
                {hero.subheadline}
              </p>
            </AnimatedSection>

            <AnimatedSection delay={300}>
              <Link
                href={hero.ctaHref}
                className="inline-flex items-center gap-2 rounded-full bg-primary-900 px-7 py-4 text-sm font-medium text-white transition-all duration-300 hover:gap-3 hover:bg-primary-700"
              >
                {hero.ctaLabel}
                <span className="text-lg leading-none" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </AnimatedSection>
          </div>

          <AnimatedSection delay={150} className="relative">
            <div className="grid h-130 grid-cols-2 gap-3">
              <div className="relative row-span-2 overflow-hidden rounded-3xl bg-primary-700/20">
                <Image
                  src="/cert.jpeg"
                  alt="Community members meeting"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-background-100">
                <Image
                  src="/images/hero-2.jpeg"
                  alt="Cooperative gathering"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-primary-700/30">
                <Image
                  src="/images/hero-3.jpeg"
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
