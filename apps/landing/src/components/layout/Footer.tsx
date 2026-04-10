import Link from "next/link";
import { footer, siteConfig } from "@/data/content";

export default function Footer() {
  return (
    <footer className="bg-coop-dark text-coop-cream">
      <div className="section-padding mx-auto max-w-[1400px] pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-14">
          {/* Brand */}
          <div className="md:col-span-2">
            <p className="font-display text-2xl font-semibold mb-3">
              {siteConfig.name}
            </p>
            <p className="text-coop-cream/60 text-sm leading-relaxed max-w-xs">
              {footer.tagline}
            </p>
          </div>

          {/* Pages */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-coop-cream/40 mb-4">
              Pages
            </p>
            <ul className="space-y-3">
              {footer.pages.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-coop-cream/70 hover:text-coop-cream transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-coop-cream/40 mb-4">
              Information
            </p>
            <ul className="space-y-3">
              {footer.information.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-coop-cream/70 hover:text-coop-cream transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-coop-cream/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-coop-cream/40">{siteConfig.copyright}</p>
          <div className="flex items-center gap-5">
            {footer.socials.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="text-xs text-coop-cream/40 hover:text-coop-cream/80 transition-colors"
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
