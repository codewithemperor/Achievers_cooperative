"use client";

import type { PropsWithChildren } from "react";
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
import { Drawer } from "@heroui/react";
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
    <div className="flex h-full flex-col  py-8">
      {/* Logo + Name */}
      <div className="mb-8 flex items-center gap-3 px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
          <Image
            src="/logo.jpeg"
            alt="Achievers Cooperative"
            width={32}
            height={32}
          />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/50">
            Cooperative
          </p>
          <p className="text-sm font-bold leading-tight text-white">
            Achievers Cooperative
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-6 overflow-y-auto">
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
                  ? "bg-white text-(--color-dark)"
                  : "text-[rgba(245,240,232,0.82)] hover:bg-[rgba(255,255,255,0.16)] hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="mt-6 shrink-0 border-t border-white/10 pt-6">
        <div className="px-6">
          <button
            className="w-full rounded-full border border-[rgba(255,255,255,0.24)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 "
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

  const breadcrumb =
    pathname === "/admin"
      ? "Dashboard overview"
      : pathname.replace("/admin/", "").replaceAll("/", " / ");

  return (
    <div className="min-h-screen bg-white text-(--color-dark)">
      <div className="mx-auto flex min-h-screen max-w-400">
        {/* ── Desktop sidebar ── */}
        <aside
          className={clsx(
            "hidden xl:flex xl:w-80 xl:shrink-0",
            "sticky top-0 h-screen max-h-screen flex-col",
            "border-r border-[rgba(26,46,26,0.18)]",
            sidebarGradient,
          )}
        >
          <SidebarContent />
        </aside>

        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── Header ── */}
          <header className="sticky top-0 z-30 border-b border-[rgba(26,46,26,0.08)] bg-white px-5 py-4 md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Mobile menu trigger via HeroUI Drawer */}
                <Drawer>
                  <Drawer.Trigger
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-(--color-dark)text-white xl:hidden"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Drawer.Trigger>

                  <Drawer.Backdrop variant="blur">
                    <Drawer.Content
                      placement="left"
                      className="w-72 max-w-[85vw]"
                    >
                      <Drawer.Dialog
                        className={clsx("h-full", sidebarGradient)}
                        aria-label="Navigation"
                      >
                        <Drawer.Handle className="bg-white/20" />
                        <Drawer.CloseTrigger className="text-white/70 hover:text-white" />
                        {/* Render nav inside drawer; close on link click */}
                        <Drawer.Body className="p-0">
                          {/* We embed SidebarContent but need close fn — use uncontrolled approach */}
                          <SidebarContent />
                        </Drawer.Body>
                      </Drawer.Dialog>
                    </Drawer.Content>
                  </Drawer.Backdrop>
                </Drawer>

                <div>
                  <p className="text-sm capitalize text-(--color-coop-muted)">
                    {breadcrumb}
                  </p>
                </div>
              </div>

              <div className="rounded-full border border-[rgba(26,46,26,0.1)] bg-white px-4 py-2 text-sm text-(--color-coop-muted)">
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
