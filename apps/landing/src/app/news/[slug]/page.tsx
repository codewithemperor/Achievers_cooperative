import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { newsArticles, siteConfig } from "@/data/content";

export const dynamic = "force-static";

const articleImages = [
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80",
  "https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=1200&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80",
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80",
];

export async function generateStaticParams() {
  return newsArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = newsArticles.find((a) => a.slug === slug);
  if (!article) return { title: "Not Found" };
  return {
    title: `${article.title} | ${siteConfig.name}`,
    description: article.excerpt,
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const articleIndex = newsArticles.findIndex((a) => a.slug === slug);
  const article = newsArticles[articleIndex];

  if (!article) notFound();

  const relatedArticles = newsArticles
    .filter((a) => a.slug !== slug)
    .slice(0, 3);

  return (
    <div className="pt-20 bg-coop-cream min-h-screen">
      <article className="section-padding mx-auto max-w-[900px] py-20">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-coop-muted mb-10">
          <Link href="/" className="hover:text-coop-dark transition-colors">Home</Link>
          <span>/</span>
          <Link href="/news" className="hover:text-coop-dark transition-colors">News</Link>
          <span>/</span>
          <span className="text-coop-dark">{article.title}</span>
        </div>

        {/* Category + date */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-coop-green">
            {article.category}
          </span>
          <span className="text-xs text-coop-muted">{article.date}</span>
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-coop-dark leading-[1.15] mb-8">
          {article.title}
        </h1>

        {/* Cover image */}
        <div className="relative h-64 md:h-96 rounded-4xl overflow-hidden mb-12 bg-coop-sand">
          <Image
            src={articleImages[articleIndex % articleImages.length]}
            alt={article.title}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Body */}
        <div className="prose prose-lg max-w-none text-coop-muted leading-relaxed space-y-6">
          <p className="text-xl text-coop-dark font-medium leading-relaxed">
            {article.excerpt}
          </p>
          <p>
            Unity Cooperative Association continues to serve its members with dedication and transparency. This development marks another milestone in our journey toward building a more equitable financial ecosystem for all members and the wider community.
          </p>
          <p>
            Our cooperative model ensures that every decision made at the institutional level reflects the interests and voices of our membership. We remain committed to democratic governance, fair financial practices, and sustainable community development.
          </p>
          <p>
            Members who wish to learn more or participate in related programs are encouraged to visit any of our branch offices or reach out through our digital platform. Together, we continue to build prosperity through collective action.
          </p>
        </div>
      </article>

      {/* Related articles */}
      <section className="bg-coop-sand py-16">
        <div className="section-padding mx-auto max-w-[1400px]">
          <h2 className="font-display text-2xl font-semibold text-coop-dark mb-8">
            More from the newsroom
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {relatedArticles.map((related, i) => (
              <Link
                key={related.slug}
                href={`/news/${related.slug}`}
                className="group block bg-coop-cream rounded-3xl overflow-hidden card-lift"
              >
                <div className="relative h-40 overflow-hidden">
                  <Image
                    src={articleImages[i % articleImages.length]}
                    alt={related.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5">
                  <span className="text-xs font-semibold text-coop-green uppercase tracking-wide">
                    {related.category}
                  </span>
                  <h3 className="font-display text-base font-semibold text-coop-dark mt-1 leading-snug">
                    {related.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
