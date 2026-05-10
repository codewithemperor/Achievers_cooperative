import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { footer, siteConfig } from "@/data/content";

export default function Footer() {
  return (
    <footer className="bg-[#07130d] text-white dark:bg-black">
      <div className="section-padding mx-auto max-w-[1400px] pt-16 pb-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.35fr_0.8fr_0.8fr_1fr] lg:gap-12 mb-14">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <Image
                src="/logo.jpeg"
                alt="Achievers Cooperative"
                width={48}
                height={48}
                className="h-12 w-12 rounded-2xl object-cover"
              />
              <div>
                <p className="font-display text-xl font-semibold text-white">
                  Achievers Cooperative
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                  Shared progress
                </p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/70">
              {footer.tagline}
            </p>

            <div className="mt-6 grid gap-3 text-sm text-white/70">
              <a
                className="flex items-start gap-3 transition hover:text-white"
                href={`mailto:${siteConfig.contactEmail}`}
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" />
                <span>{siteConfig.contactEmail}</span>
              </a>
              <a
                className="flex items-start gap-3 transition hover:text-white"
                href={`tel:${siteConfig.contactPhone.replaceAll(" ", "")}`}
              >
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" />
                <span>{siteConfig.contactPhone}</span>
              </a>
              <p className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" />
                <span>{siteConfig.address}</span>
              </p>
            </div>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/45">
              Pages
            </p>
            <ul className="space-y-3">
              {footer.pages.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/45">
              Information
            </p>
            <ul className="space-y-3">
              {footer.information.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-white">Member support</p>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Contact member services for onboarding, savings, loan, and
              cooperative account guidance.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-primary-900 transition hover:bg-primary-100"
            >
              Contact us
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 md:flex-row">
          <p className="text-xs text-white/45">
            &copy; {new Date().getFullYear()} Achievers Cooperative
            Association. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            {footer.socials.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="text-xs text-white/45 transition-colors hover:text-white"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
