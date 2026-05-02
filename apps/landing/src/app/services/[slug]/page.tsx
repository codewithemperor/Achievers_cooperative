import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { services, siteConfig } from "@/data/content";

export const dynamic = "force-static";

const serviceImages = [
  "https://images.unsplash.com/photo-1579621970590-9d624316904b?w=1200&q=80",
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80",
];

export async function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);

  if (!service) {
    return { title: "Not Found" };
  }

  return {
    title: `${service.title} | ${siteConfig.name}`,
    description: service.description,
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const serviceIndex = services.findIndex((s) => s.slug === slug);
  const service = services[serviceIndex];

  if (!service) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background-50 pt-20">
      <div className="section-padding mx-auto max-w-[1400px] py-20">
        <div className="mb-10 flex items-center gap-2 text-xs text-text-400">
          <Link href="/" className="transition-colors hover:text-text-900">
            Home
          </Link>
          <span>/</span>
          <Link href="/services" className="transition-colors hover:text-text-900">
            Services
          </Link>
          <span>/</span>
          <span className="text-text-900">{service.title}</span>
        </div>

        <div className="mb-16 grid grid-cols-1 items-start gap-16 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-text-500">
              Service {String(serviceIndex + 1).padStart(2, "0")}
            </span>
            <h1 className="mb-6 mt-3 font-display text-4xl font-semibold leading-[1.15] text-text-900 md:text-5xl">
              {service.title}
            </h1>
            <p className="mb-8 text-lg leading-relaxed text-text-400">
              {service.description}
            </p>
            <p className="mb-8 leading-relaxed text-text-400">
              Our cooperative members benefit from exclusive access to this service, designed with your financial growth in mind. All services are governed democratically and transparently, ensuring every naira works as hard as our members do.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-primary-900 px-7 py-4 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Enquire About This Service &rarr;
            </Link>
          </div>

          <div className="relative h-96 overflow-hidden rounded-4xl bg-background-100">
            <Image
              src={serviceImages[serviceIndex % serviceImages.length]}
              alt={service.imageAlt}
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        <div className="border-t border-primary-900/10 pt-16">
          <h2 className="mb-8 font-display text-2xl font-semibold text-text-900">
            Other services
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {services
              .filter((s) => s.slug !== slug)
              .map((other, i) => (
                <Link
                  key={other.slug}
                  href={`/services/${other.slug}`}
                  className="group flex items-center gap-5 rounded-3xl bg-background-100 p-5 card-lift"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
                    <Image
                      src={serviceImages[i % serviceImages.length]}
                      alt={other.imageAlt}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="mb-1 font-display text-base font-semibold text-text-900">
                      {other.title}
                    </h3>
                    <p className="line-clamp-2 text-xs text-text-400">
                      {other.description}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
