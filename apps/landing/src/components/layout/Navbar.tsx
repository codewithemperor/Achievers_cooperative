"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { navLinks, siteConfig } from "@/data/content";
import { Menu, X } from "lucide-react";
import { clsx } from "clsx";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "nav-scrolled"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <nav className="section-padding mx-auto flex items-center justify-between h-16 md:h-18 max-w-350">
        {/* Logo */}
        <Link
          href="/"
          className="font-display text-xl font-semibold text-coop-dark tracking-tight"
        >
          {siteConfig.name}
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm font-medium text-coop-muted hover:text-coop-dark transition-colors duration-200"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/contact"
            className="inline-flex items-center px-5 py-2.5 rounded-full bg-coop-dark text-white text-sm font-medium hover:bg-coop-green transition-colors duration-200"
          >
            Contact Us
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-coop-dark"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-coop-cream border-t border-coop-sand px-6 py-6 flex flex-col gap-5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-base font-medium text-coop-dark"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/contact"
            onClick={() => setMenuOpen(false)}
            className="inline-flex items-center justify-center px-5 py-3 rounded-full bg-coop-dark text-white text-sm font-medium mt-2"
          >
            Contact Us
          </Link>
        </div>
      )}
    </header>
  );
}
