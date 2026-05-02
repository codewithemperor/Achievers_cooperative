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
  PiggyBank,
  Receipt,
  Settings,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import { clearSession } from "@/lib/session";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/loans", label: "Loans", icon: Banknote },
  { href: "/admin/savings", label: "Savings", icon: PiggyBank },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
  { href: "/admin/investments", label: "Investments", icon: TrendingUp },
  { href: "/admin/packages", label: "Packages", icon: Package },
  { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col py-6">
      <div className="mb-8 flex items-center gap-3 px-5">
        <Image src="/logo.jpeg" alt="Achievers Cooperative" width={32} height={32} className="h-8 w-auto object-contain brightness-0 invert rounded-lg" />
        <span className="text-sm font-bold text-white tracking-tight">Achievers Cooperative</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
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
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/70 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 shrink-0 border-t border-white/10 px-3 pt-4">
        <button
          className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/8 hover:text-white"
          onClick={() => {
            clearSession();
            window.location.href = "/admin/auth/login";
          }}
          type="button"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          Log Out
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const breadcrumb =
    pathname === "/admin" ? "Dashboard overview" : pathname.replace("/admin/", "").replaceAll("/", " / ");

  return (
    <div className="min-h-screen bg-[var(--background-50)] text-[var(--text-800)] dark:bg-[var(--background-950)] dark:text-[var(--text-200)]">
      <div className="mx-auto flex min-h-screen max-w-400">
        {/* Desktop sidebar — dark green */}
        <aside
          className={clsx(
            "sticky top-0 hidden h-screen max-h-screen shrink-0 flex-col xl:flex xl:w-[260px]",
            "bg-[linear-gradient(180deg,var(--primary-950),var(--primary-900),var(--primary-800))] border-r border-white/10",
          )}
        >
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header bar */}
          <header className="sticky top-0 z-30 border-b border-[var(--background-200)] bg-white/90 px-5 py-3 backdrop-blur-lg dark:border-[var(--background-800)] dark:bg-[var(--background-900)]/90">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-600)] text-white xl:hidden"
                  aria-label="Open menu"
                  onClick={() => setIsDrawerOpen(true)}
                  type="button"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div>
                  <p className="text-sm font-medium capitalize text-[var(--text-400)]">{breadcrumb}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle />
                <span className="hidden rounded-full border border-[var(--background-200)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-400)] sm:inline-block dark:border-[var(--background-700)] dark:bg-[var(--background-800)]">
                  Admin Panel
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
            type="button"
          />
          <aside
            className={clsx(
              "relative z-10 h-full w-[260px] max-w-[85vw] shadow-[0_20px_60px_rgba(0,0,0,0.3)]",
              "bg-[linear-gradient(180deg,var(--primary-950),var(--primary-900),var(--primary-800))] border-r border-white/10",
            )}
          >
            <div className="flex justify-end px-4 pt-4">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:text-white hover:bg-white/10"
                onClick={() => setIsDrawerOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent onNavClick={() => setIsDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
