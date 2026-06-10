"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { hero } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export default function HeroSection() {
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-background-50 pb-16 pt-24 dark:bg-background-950"
    >
      <div className="section-padding relative mx-auto max-w-350">
        <AnimatedSection delay={0}>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary-700/20 bg-primary-700/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary-400" />
            <span className="text-xs font-medium text-primary-700 dark:text-primary-200">
              {hero.badge}
            </span>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <AnimatedSection delay={100}>
              <h1 className="mb-6 whitespace-pre-line font-display text-5xl font-semibold leading-[1.1] text-text-900 dark:text-text-50 text-balance md:text-6xl xl:text-7xl">
                {hero.headline}
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={200}>
              <p className="mb-10 max-w-md text-lg leading-relaxed text-text-400 dark:text-text-300">
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
              <button
                className="relative row-span-2 overflow-hidden rounded-3xl bg-primary-700/20 text-left outline-none ring-primary-500/30 transition hover:scale-[0.99] focus-visible:ring-4"
                onClick={() => setIsCertificateOpen(true)}
                type="button"
                aria-label="View cooperative certificate"
              >
                <Image
                  src="/cert.jpeg"
                  alt="Achievers Cooperative certificate"
                  fill
                  className="object-cover"
                  priority
                />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  View certificate
                </span>
              </button>
              <div className="relative overflow-hidden rounded-3xl bg-background-100 dark:bg-background-800">
                <Image
                  src="/images/hero-2.jpg"
                  alt="Cooperative gathering"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-primary-700/30 dark:bg-primary-500/20">
                <Image
                  src="/images/hero-3.jpg"
                  alt="Members working together"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>

      {isCertificateOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <button
            aria-label="Close certificate viewer"
            className="absolute inset-0"
            onClick={() => setIsCertificateOpen(false)}
            type="button"
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/15 bg-background-950 shadow-2xl">
            <button
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black"
              onClick={() => setIsCertificateOpen(false)}
              type="button"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative h-[82vh] w-full">
              <Image
                src="/cert.jpeg"
                alt="Achievers Cooperative certificate"
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
