"use client";

import type { PropsWithChildren } from "react";
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
  Wallet,
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
  { href: "/admin/wallet", label: "Co-op Wallet", icon: Wallet },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(232,224,208,0.95),rgba(245,240,232,1)_48%,rgba(255,255,255,0.98)_100%)] text-[var(--color-dark)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-80 shrink-0 border-r border-[rgba(26,46,26,0.1)] bg-[rgba(255,255,255,0.75)] px-6 py-8 backdrop-blur xl:block">
          <div className="rounded-[2rem] bg-[linear-gradient(160deg,rgba(26,46,26,1),rgba(61,122,53,0.94))] p-6 text-white shadow-[0_24px_60px_rgba(26,46,26,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[rgba(245,240,232,0.82)]">
              Achievers Cooperative
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Admin Workspace</h2>
            <p className="mt-2 text-sm text-[rgba(245,240,232,0.74)]">
              Operations, auditability, and member service in one place.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-[1.2rem] px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-[rgba(45,90,39,0.11)] text-[var(--color-dark)]"
                      : "text-[var(--color-coop-muted)] hover:bg-white hover:text-[var(--color-dark)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            className="mt-8 rounded-full border border-[rgba(26,46,26,0.14)] px-5 py-3 text-sm font-semibold text-[var(--color-dark)]"
            onClick={() => {
              clearSession();
              window.location.href = "/admin/auth/login";
            }}
            type="button"
          >
            Log Out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[rgba(26,46,26,0.08)] bg-[rgba(245,240,232,0.82)] px-5 py-4 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-dark)] text-white xl:hidden">
                  <Menu className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-mid)]">
                    Admin
                  </p>
                  <p className="text-sm text-[var(--color-coop-muted)]">
                    {pathname === "/admin" ? "Dashboard overview" : pathname.replace("/admin/", "").replaceAll("/", " / ")}
                  </p>
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
    </div>
  );
}
