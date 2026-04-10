"use client";

import { useState } from "react";
import { faqSection, faqs } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { Plus, Minus } from "lucide-react";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-coop-cream py-24">
      <div className="section-padding mx-auto max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left header */}
          <AnimatedSection>
            <p className="text-xs font-semibold uppercase tracking-widest text-coop-muted mb-4">
              {faqSection.label}
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-coop-dark leading-[1.15] mb-4">
              {faqSection.headline}
            </h2>
            <p className="text-coop-muted leading-relaxed">
              {faqSection.subheadline}
            </p>
          </AnimatedSection>

          {/* Right accordion */}
          <div className="flex flex-col gap-3">
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <AnimatedSection key={i} delay={i * 60}>
                  <div
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isOpen
                        ? "border-coop-green/30 bg-coop-green/5"
                        : "border-coop-dark/10 bg-white/60"
                    }`}
                  >
                    <button
                      className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                    >
                      <span className="font-medium text-coop-dark text-sm leading-snug">
                        {faq.question}
                      </span>
                      <span className="shrink-0 w-7 h-7 rounded-full bg-coop-dark/8 flex items-center justify-center">
                        {isOpen ? (
                          <Minus size={14} className="text-coop-green" />
                        ) : (
                          <Plus size={14} className="text-coop-dark" />
                        )}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5">
                        <p className="text-sm text-coop-muted leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
