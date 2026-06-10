"use client";

import { useState, type PropsWithChildren } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  CalendarDays,
  LayoutDashboard,
  Menu,
  Package,
  PiggyBank,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "@heroui/react";
import clsx from "clsx";
import { clearSession } from "@/lib/session";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useApi } from "@/hooks/useApi";
import {
  ADMIN_REFRESH_EVENT,
  useAdminDataStore,
} from "@/lib/admin-data-store";

interface DashboardNoticeResponse {
  summary: {
    loans: { pending: number };
    investments: { pendingCancellations: number };
    packages: { pending: number };
  };
  pendingPayments: Array<unknown>;
  pendingWalletWithdrawals: Array<unknown>;
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/loans", label: "Loans", icon: Banknote },
  { href: "/admin/savings", label: "Savings", icon: PiggyBank },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowLeftRight },
  { href: "/admin/weekly-deductions", label: "Weekly Dues", icon: CalendarDays },
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
        <Image
          src="/logo.jpeg"
          alt="Achievers Cooperative"
          width={40}
          height={40}
          className="h-10 w-10 rounded-xl bg-white object-cover p-1 shadow-sm"
        />
        <span className="text-sm font-bold text-white tracking-tight">
          Achievers Cooperative
        </span>
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
          <svg
            className="h-[18px] w-[18px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
            />
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
  const [isReloading, setIsReloading] = useState(false);
  const notices = useApi<DashboardNoticeResponse>("/reports/dashboard");
  const clearAdminCache = useAdminDataStore((state) => state.clear);
  const missedRequests =
    (notices.data?.pendingPayments.length ?? 0) +
    (notices.data?.pendingWalletWithdrawals.length ?? 0) +
    (notices.data?.summary.loans.pending ?? 0) +
    (notices.data?.summary.investments.pendingCancellations ?? 0) +
    (notices.data?.summary.packages.pending ?? 0);

  const breadcrumb =
    pathname === "/admin"
      ? "Dashboard overview"
      : pathname.replace("/admin/", "").replaceAll("/", " / ");

  async function refreshAdminData() {
    if (isReloading) return;
    setIsReloading(true);
    clearAdminCache();

    const refreshTasks: Promise<void>[] = [];
    window.dispatchEvent(
      new CustomEvent(ADMIN_REFRESH_EVENT, {
        detail: {
          collect: (task: Promise<void>) => refreshTasks.push(task),
        },
      }),
    );

    const refreshTask = (
      refreshTasks.length
        ? Promise.all(refreshTasks).then(() => undefined)
        : notices.refetch({ force: true, reason: "manual", silent: true })
    );

    try {
      await toast.promise(refreshTask, {
        error: (error) =>
          error?.message || "Unable to refresh admin data. Please try again.",
        loading: "Refreshing admin data...",
        success: "Admin data refreshed successfully.",
      });
    } finally {
      setIsReloading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--background-50)] text-text-800 dark:bg-[var(--background-950)] dark:text-[var(--text-200)]">
      <div className="min-h-screen w-full overflow-x-clip">
        {/* Desktop sidebar — dark green */}
        <aside
          className={clsx(
            "fixed left-0 top-0 z-40 hidden h-screen max-h-screen shrink-0 flex-col xl:flex xl:w-[260px]",
            "bg-[linear-gradient(180deg,var(--primary-950),var(--primary-900),var(--primary-800))] border-r border-white/10",
          )}
        >
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-x-clip xl:pl-[260px]">
          {/* Header bar */}
          <header className="sticky top-0 z-30 border-b border-[var(--background-200)] bg-white/90 px-5 py-3 backdrop-blur-lg dark:border-[var(--background-800)] dark:bg-[var(--background-900)]/90">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-600)] text-white xl:hidden"
                  aria-label="Open menu"
                  onClick={() => setIsDrawerOpen(true)}
                  type="button"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div className="hidden min-h-12 w-full max-w-md items-center gap-3 rounded-2xl bg-background-50 px-4 md:flex">
                  <Search className="h-4 w-4 shrink-0 text-text-400" />
                  <input
                    className="w-full bg-transparent text-sm text-text-900 outline-none placeholder:text-text-400"
                    placeholder="Search admin workspace"
                    type="search"
                  />
                </div>
                <p className="truncate text-sm font-medium capitalize text-text-400 md:hidden">
                  {breadcrumb}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  aria-label="Refresh admin data"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-background-50 px-3 text-sm font-semibold text-text-900 transition hover:bg-background-100 disabled:cursor-wait disabled:opacity-70"
                  disabled={isReloading}
                  onClick={refreshAdminData}
                  title="Refresh admin data"
                  type="button"
                >
                  <RefreshCw
                    className={clsx("h-4 w-4", isReloading && "animate-spin")}
                  />
                  <span className="hidden sm:inline">
                    {isReloading ? "Refreshing" : "Refresh"}
                  </span>
                </button>
                <Link
                  aria-label={`${missedRequests} pending requests`}
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-background-50 text-text-900 transition hover:bg-background-100"
                  href="/admin/notifications"
                >
                  <Bell className="h-5 w-5" />
                  {missedRequests > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#b42318] px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                      {missedRequests > 99 ? "99+" : missedRequests}
                    </span>
                  ) : null}
                </Link>
                <ThemeToggle />
                <span className="hidden rounded-full border border-[var(--background-200)] bg-white px-3 py-1.5 text-xs font-medium text-text-400 sm:inline-block dark:border-[var(--background-700)] dark:bg-[var(--background-800)]">
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
