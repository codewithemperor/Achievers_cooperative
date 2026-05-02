"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, House, ReceiptText, UserRound, WalletCards } from "lucide-react";
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
  const isHomeScreen = pathname === "/dashboard";

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!checkedAuth || !session) {
    return null;
  }

  return (
    <div
      className={
        isHomeScreen
          ? "min-h-screen bg-[linear-gradient(180deg,#1d8e61_0%,#14785d_17rem,var(--background-50)_17rem,var(--background-50)_100%)] dark:bg-[linear-gradient(180deg,#14664a_0%,#0f5945_17rem,var(--background-50)_17rem,var(--background-50)_100%)]"
          : "min-h-screen bg-[var(--background-50)] dark:bg-[var(--background-50)]"
      }
    >
      {!isTabScreen ? (
        <header className="sticky top-0 z-40 border-b border-[var(--background-200)] bg-white/92 px-5 py-4 backdrop-blur-xl dark:border-white/8 dark:bg-[var(--background-100)]/92">
          <div className="mx-auto flex w-full max-w-md items-center">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full text-sm font-medium text-[var(--text-700)] dark:text-[var(--text-100)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--background-200)] bg-[var(--background-50)] dark:border-white/8 dark:bg-white/8">
                <ArrowLeft className="h-4 w-4" />
              </span>
              <span>Back</span>
            </button>
          </div>
        </header>
      ) : null}

      <main className="mx-auto w-full max-w-md px-5 pb-8 pt-6">{children}</main>

      {isTabScreen ? (
        <nav className="sticky bottom-4 z-40 mx-auto mt-2 w-full max-w-md px-5 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4 rounded-[30px] border border-white/35 bg-white/68 p-2 shadow-[0_24px_48px_rgba(23,38,84,0.18)] backdrop-blur-2xl dark:border-white/8 dark:bg-[color:rgba(15,23,42,0.74)]">
            {tabItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 rounded-[24px] px-2 py-2 transition-all duration-200 ${
                    active
                      ? "bg-white/60 text-[var(--primary-600)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:bg-white/10 dark:text-white"
                      : "text-[var(--text-500)] dark:text-[var(--text-300)]"
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl">{item.icon}</span>
                  <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
