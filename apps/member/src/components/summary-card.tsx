"use client";

import type { ReactNode } from "react";
import Link from "next/link";

interface SummaryCardProps {
  eyebrow: string;
  title: string;
  value: string;
  caption?: string;
  ctaLabel?: string;
  href?: string;
  onCtaClick?: () => void;
  icon?: ReactNode;
  gradient?: string;
}

export function SummaryCard({
  eyebrow,
  title,
  value,
  caption,
  ctaLabel,
  href,
  onCtaClick,
  icon,
  gradient = "from-[#1f8f5c] via-[#169368] to-[#0f6f61]",
}: SummaryCardProps) {
  const hasCta = Boolean(ctaLabel && (href || onCtaClick));

  return (
    <article
      className={`relative overflow-hidden rounded-[28px] bg-linear-to-br ${gradient} p-5 text-white `}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.34),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_32%)]" />
      <div
        className={`relative flex flex-col ${hasCta ? "min-h-50 justify-between" : "min-h-36 justify-start"}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">
              {title}
            </p>
            {/* <h2 className="mt-3 max-w-56 text-white text-xl font-semibold tracking-tight">
              {title}
            </h2> */}
          </div>
          {icon ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/16 text-white backdrop-blur-sm">
              {icon}
            </div>
          ) : null}
        </div>

        <div className="mt-2">
          <p className="text-4xl font-bold font-display leading-none tracking-normal">
            {value}
          </p>
          {caption ? (
            <p className="mt-2 max-w-[16rem] text-sm text-white/76">
              {caption}
            </p>
          ) : null}
          {ctaLabel && href ? (
            <Link
              href={href}
              className="mt-5 flex min-h-11 w-full tracking-wide items-center justify-center rounded-full bg-white/18 px-4 py-2 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/24"
            >
              {ctaLabel}
            </Link>
          ) : null}
          {ctaLabel && !href && onCtaClick ? (
            <button
              type="button"
              onClick={onCtaClick}
              className="mt-5 flex min-h-11 w-full items-center justify-center rounded-full bg-white/18 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/24 tracking-wide"
            >
              {ctaLabel}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
