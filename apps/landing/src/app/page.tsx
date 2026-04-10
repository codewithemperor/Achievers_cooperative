import type { Metadata } from "next";
import { siteConfig } from "@/data/content";
import HeroSection from "@/components/sections/HeroSection";
import AboutSnapshot from "@/components/sections/AboutSnapshot";
import ServicesSection from "@/components/sections/ServicesSection";
import BenefitsSection from "@/components/sections/BenefitsSection";
import StatsTicker from "@/components/sections/StatsTicker";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import NewsSection from "@/components/sections/NewsSection";
import FaqSection from "@/components/sections/FaqSection";
import CtaSection from "@/components/sections/CtaSection";

export const metadata: Metadata = {
  title: `${siteConfig.name} - ${siteConfig.tagline}`,
  description: siteConfig.description,
};

// SSG: page is fully static at build time.
export const dynamic = "force-static";
export const revalidate = false;

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <AboutSnapshot />
      <ServicesSection />
      <StatsTicker />
      <BenefitsSection />
      <TestimonialsSection />
      <NewsSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
