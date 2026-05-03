"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  House,
  ReceiptText,
  UserRound,
  WalletCards,
} from "lucide-react";
import { getMemberSession, isMemberAuthenticated } from "@/lib/member-session";

interface TabItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const tabItems: TabItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: <House className="h-5 w-5" />,
  },
  {
    label: "Loans",
    href: "/loans",
    icon: <WalletCards className="h-5 w-5" />,
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: <ReceiptText className="h-5 w-5" />,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: <UserRound className="h-5 w-5" />,
  },
];

export function MemberShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname === "/login";
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    const authenticated = isMemberAuthenticated();

    if (!authenticated && !isAuthRoute) {
      router.replace("/login");
      setCheckedAuth(true);
      return;
    }

    if (authenticated && isAuthRoute) {
      router.replace("/dashboard");
      setCheckedAuth(true);
      return;
    }

    setCheckedAuth(true);
  }, [isAuthRoute, router]);

  const session = getMemberSession();
  const isTabScreen = tabItems.some((item) => pathname === item.href);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!checkedAuth || !session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background-50">
      {/* {!isTabScreen ? (
        <header className="sticky top-0 z-40 border-b border-background-200 dark:border-white/8 bg-background-50/92 backdrop-blur-xl px-5 py-4">
          <div className="mx-auto flex w-full max-w-md items-center">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full text-sm font-medium text-text-700"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-background-200 dark:border-white/8 bg-background-100 dark:bg-white/8">
                <ArrowLeft className="h-4 w-4" />
              </span>
              <span>Back</span>
            </button>
          </div>
        </header>
      ) : null} */}

      <main
        className={`mx-auto w-full max-w-md px-5 pt-6 ${
          isTabScreen ? "pb-28" : "pb-8"
        }`}
      >
        {children}
      </main>

      {isTabScreen ? (
        <nav className="fixed bottom-4 left-0 right-0 z-50 mx-auto w-full max-w-md px-5 pb-[env(safe-area-inset-bottom)]">
          {/* Outer glow layer for depth */}
          <div className="absolute inset-0 mx-5 rounded-[30px] bg-white/20 dark:bg-white/5 blur-xl" />

          <div className="relative grid grid-cols-4 rounded-[30px] border border-white/50 dark:border-white/10 bg-white/75 dark:bg-background-100/80 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
            {tabItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-[22px] px-2 py-1.5 transition-all duration-200 ${
                    active
                      ? "bg-white dark:bg-white/15 text-primary-600 dark:text-primary-400 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]"
                      : "text-text-400 dark:text-text-500"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 ${
                      active
                        ? "bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
                        : ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={`text-[10px] leading-tight tracking-wide ${
                      active ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
