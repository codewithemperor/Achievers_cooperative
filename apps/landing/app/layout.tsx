import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@heroui/react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Achievers Cooperative",
  description:
    "Achievers Cooperative brings savings, loans, investments, and transparent member operations into one trusted digital experience."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen">
            <header className="sticky top-0 z-40 border-b border-white/50 bg-white/75 backdrop-blur-xl">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
                <Link href="/" className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-[var(--brand-ink)] text-center text-sm font-semibold leading-10 text-white">
                    AC
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--brand-gold)]">
                      Achievers Cooperative
                    </p>
                    <p className="text-sm text-slate-500">Digital trust for member finance</p>
                  </div>
                </Link>
                <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
                  <Link href="/about">About</Link>
                  <Link href="/services">Services</Link>
                  <Link href="/faq">FAQ</Link>
                  <Link href="/contact">Contact</Link>
                </nav>
                <Button
                  as={Link}
                  href="/login"
                  className="bg-[var(--brand-ink)] text-white"
                  radius="full"
                  size="sm"
                >
                  Login
                </Button>
              </div>
            </header>
            {children}
            <footer className="border-t border-slate-200 bg-white/80">
              <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--brand-gold)]">
                    Achievers Cooperative
                  </p>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">
                    A trust-first digital platform for savings, loans, investments, and accountable cooperative
                    operations.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--brand-ink)]">Explore</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <Link href="/about">About</Link>
                    <Link href="/services">Services</Link>
                    <Link href="/faq">FAQ</Link>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--brand-ink)]">Access</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <Link href="/login">Member and admin login</Link>
                    <Link href="/contact">Request a demo</Link>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
