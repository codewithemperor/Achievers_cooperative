"use client";

import { useState, type PropsWithChildren } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { clearSession } from "@/lib/session";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/loans", label: "Loans", icon: Banknote },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
  { href: "/admin/investments", label: "Investments", icon: TrendingUp },
  { href: "/admin/packages", label: "Packages", icon: Package },
  { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col py-8">
      <div className="mb-8 flex items-center gap-3 px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
          <Image src="/logo.jpeg" alt="Achievers Cooperative" width={32} height={32} />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/50">Cooperative</p>
          <p className="text-sm font-bold leading-tight text-white">Achievers Cooperative</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={clsx(
                "flex items-center gap-3 rounded-[1.2rem] px-4 py-3 text-sm font-medium transition",
                active
                  ? "bg-white text-[var(--color-dark)]"
                  : "text-[rgba(245,240,232,0.82)] hover:bg-[rgba(255,255,255,0.16)] hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 shrink-0 border-t border-white/10 pt-6">
        <div className="px-6">
          <button
            className="w-full rounded-full border border-[rgba(255,255,255,0.24)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            onClick={() => {
              clearSession();
              window.location.href = "/admin/auth/login";
            }}
            type="button"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

const sidebarGradient =
  "bg-[linear-gradient(180deg,rgba(26,46,26,1),rgba(45,90,39,0.98),rgba(61,122,53,0.95))]";

export function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const breadcrumb =
    pathname === "/admin" ? "Dashboard overview" : pathname.replace("/admin/", "").replaceAll("/", " / ");

  return (
    <div className="min-h-screen bg-white text-[var(--color-dark)]">
      <div className="mx-auto flex min-h-screen max-w-400">
        <aside
          className={clsx(
            "sticky top-0 hidden h-screen max-h-screen shrink-0 flex-col border-r border-[rgba(26,46,26,0.18)] xl:flex xl:w-80",
            sidebarGradient,
          )}
        >
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[rgba(26,46,26,0.08)] bg-white px-5 py-4 md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-dark)] text-white xl:hidden"
                  aria-label="Open menu"
                  onClick={() => setIsDrawerOpen(true)}
                  type="button"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div>
                  <p className="text-sm capitalize text-[var(--color-coop-muted)]">{breadcrumb}</p>
                </div>
              </div>

              <div className="rounded-full border border-[rgba(26,46,26,0.1)] bg-white px-4 py-2 text-sm text-[var(--color-coop-muted)]">
                Secure internal workspace
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-[rgba(15,23,15,0.38)] backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
            type="button"
          />
          <aside
            className={clsx(
              "relative z-10 h-full w-72 max-w-[85vw] border-r border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.28)]",
              sidebarGradient,
            )}
          >
            <div className="flex justify-end px-4 pt-4">
              <button
                className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/80 transition hover:text-white"
                onClick={() => setIsDrawerOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <SidebarContent onNavClick={() => setIsDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
