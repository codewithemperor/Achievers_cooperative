import Link from "next/link";
import Image from "next/image";
import { newsSection, newsArticles } from "@/data/content";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

const articleImages = [
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=700&q=80",
  "https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=700&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=700&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=700&q=80",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=700&q=80",
];

export default function NewsSection() {
  const [featured, ...rest] = newsArticles;

  return (
    <section className="bg-background-100 py-24">
      <div className="section-padding mx-auto max-w-[1400px]">
        <AnimatedSection className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-400">
              {newsSection.label}
            </p>
            <h2 className="font-display text-4xl font-semibold leading-[1.15] text-text-900 md:text-5xl">
              {newsSection.headline}
            </h2>
          </div>
          <Link
            href={newsSection.ctaHref}
            className="inline-flex self-start whitespace-nowrap border-b border-primary-900/30 pb-0.5 text-sm font-medium text-text-900 transition-colors hover:border-primary-700 hover:text-primary-700 md:self-auto"
          >
            {newsSection.ctaLabel} &rarr;
          </Link>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <AnimatedSection className="lg:col-span-3">
            <Link
              href={`/news/${featured.slug}`}
              className="group block h-full overflow-hidden rounded-4xl bg-background-50 card-lift"
            >
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src={featured.image || articleImages[0]}
                  alt={featured.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-7">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-500">
                    {featured.category}
                  </span>
                  <span className="text-xs text-text-400">{featured.date}</span>
                </div>
                <h3 className="mb-3 font-display text-2xl font-semibold leading-snug text-text-900">
                  {featured.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-400">
                  {featured.excerpt}
                </p>
              </div>
            </Link>
          </AnimatedSection>

          <div className="flex flex-col gap-4 lg:col-span-2">
            {rest.slice(0, 4).map((article, i) => (
              <AnimatedSection key={article.slug} delay={i * 80}>
                <Link
                  href={`/news/${article.slug}`}
                  className="group flex items-center gap-4 rounded-3xl bg-background-50 p-4 card-lift"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-primary-700/10">
                    <Image
                      src={articleImages[i + 1]}
                      alt={article.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-text-500">
                        {article.category}
                      </span>
                      <span className="text-xs text-text-400">{article.date}</span>
                    </div>
                    <h4 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-text-900">
                      {article.title}
                    </h4>
                  </div>
                </Link>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
