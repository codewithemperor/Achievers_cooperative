import Link from "next/link";
import Image from "next/image";
import { footer } from "@/data/content";

export default function Footer() {
  return (
    <footer className="bg-primary-900 text-background-50">
      <div className="section-padding mx-auto max-w-[1400px] pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-14">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-3">
              <Image
                src="/logo.jpeg"
                alt="Achievers Cooperative"
                width={120}
                height={40}
                className="h-8 w-auto object-contain brightness-0 invert"
              />
            </div>
            <p className="text-background-50/60 text-sm leading-relaxed max-w-xs">
              {footer.tagline}
            </p>
          </div>

          {/* Pages */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-background-50/40 mb-4">
              Pages
            </p>
            <ul className="space-y-3">
              {footer.pages.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-background-50/70 hover:text-background-50 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-background-50/40 mb-4">
              Information
            </p>
            <ul className="space-y-3">
              {footer.information.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-background-50/70 hover:text-background-50 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-background-50/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-background-50/40">&copy; {new Date().getFullYear()} Achievers Cooperative Association. All rights reserved.</p>
          <div className="flex items-center gap-5">
            {footer.socials.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="text-xs text-background-50/40 hover:text-background-50/80 transition-colors"
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
