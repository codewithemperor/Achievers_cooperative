"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { testimonialsSection, testimonials } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  const prev = () =>
    setActiveIndex((i) => (i - 1 + testimonials.length) % testimonials.length);
  const next = () => setActiveIndex((i) => (i + 1) % testimonials.length);

  const visibleTestimonials = [
    testimonials[activeIndex],
    testimonials[(activeIndex + 1) % testimonials.length],
    testimonials[(activeIndex + 2) % testimonials.length],
  ];

  return (
    <section className="bg-coop-cream py-24">
      <div className="section-padding mx-auto max-w-350">
        <AnimatedSection className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-coop-muted">
              {testimonialsSection.label}
            </p>
            <h2 className="max-w-lg font-display text-4xl font-semibold leading-[1.15] text-coop-dark md:text-5xl">
              {testimonialsSection.headline}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-coop-muted">
              {testimonialsSection.subheadline}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-coop-dark/20 transition-all hover:bg-coop-dark hover:text-coop-cream"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-coop-dark/20 transition-all text-white hover:bg-coop-dark hover:text-coop-cream"
              aria-label="Next testimonial"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </AnimatedSection>

        <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {visibleTestimonials.map((t, i) => (
            <div
              key={`${t.name}-${i}`}
              className="flex min-h-55 flex-col justify-between rounded-4xl bg-coop-sand p-7"
            >
              <p className="mb-6 font-display text-lg leading-relaxed text-coop-dark italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-coop-green/20">
                  <Image
                    src={
                      i === 0
                        ? "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&q=80"
                        : i === 1
                          ? "https://images.unsplash.com/photo-1618641986557-1ecd230959aa?w=100&q=80"
                          : "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=100&q=80"
                    }
                    alt={t.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-coop-dark">
                    {t.name}
                  </p>
                  <p className="text-xs text-coop-muted">{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <AnimatedSection className="text-center">
          <Link
            href={testimonialsSection.ctaHref}
            className="inline-flex items-center gap-2 rounded-full bg-coop-dark px-7 py-4 text-sm font-medium text-white transition-colors hover:bg-coop-green"
          >
            {testimonialsSection.ctaLabel} &rarr;
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
