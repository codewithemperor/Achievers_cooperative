import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { newsArticles, siteConfig } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export const metadata: Metadata = {
  title: `News & Insights | ${siteConfig.name}`,
  description:
    "Stay up to date with the latest news, updates, and stories from Unity Cooperative Association.",
};

export const dynamic = "force-static";

const articleImages = [
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=700&q=80",
  "https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=700&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=700&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=700&q=80",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=700&q=80",
];

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-coop-cream pt-20">
      <div className="section-padding mx-auto max-w-[1400px] py-24">
        <AnimatedSection className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-coop-muted">
            News & Insights
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.1] text-coop-dark md:text-6xl">
            Stories from the
            <br />
            cooperative world
          </h1>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {newsArticles.map((article, i) => (
            <AnimatedSection key={article.slug} delay={i * 80}>
              <Link
                href={`/news/${article.slug}`}
                className="group block h-full overflow-hidden rounded-4xl bg-coop-sand card-lift"
              >
                <div className="relative h-52 overflow-hidden">
                  <Image
                    src={articleImages[i % articleImages.length]}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-coop-green">
                      {article.category}
                    </span>
                    <span className="text-xs text-coop-muted">{article.date}</span>
                  </div>
                  <h2 className="mb-3 font-display text-xl font-semibold leading-snug text-coop-dark">
                    {article.title}
                  </h2>
                  <p className="line-clamp-2 text-sm leading-relaxed text-coop-muted">
                    {article.excerpt}
                  </p>
                  <span className="mt-4 inline-block text-sm font-medium text-coop-green">
                    Read more &rarr;
                  </span>
                </div>
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </div>
  );
}
