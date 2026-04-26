"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { clearMemberSession, getMemberSession, isMemberAuthenticated } from "../lib/member-session";

const tabItems = [
  {
    label: "Home",
    href: "/dashboard",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V21a.75.75 0 0 1-.75.75H15v-6h-6v6H3.75A.75.75 0 0 1 3 21v-10.5Z" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h11m-11 4.5h8.25m-8.25 4.5h11M3.75 7.5h.008v.008H3.75V7.5Zm0 4.5h.008v.008H3.75V12Zm0 4.5h.008v.008H3.75V16.5Z" />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/profile",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a8.25 8.25 0 0 1 14.998 0" />
      </svg>
    ),
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

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!checkedAuth || !session) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--brand-stroke)] bg-[rgba(255,253,248,0.96)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-green)] text-sm font-semibold text-white">
              AC
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--brand-moss)]">Cooperative</p>
              <p className="text-sm font-semibold text-[var(--brand-ink)]">Achievers Member App</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-[var(--brand-stroke)] bg-white px-4 py-2 text-xs font-semibold text-[var(--brand-ink)] sm:block">
              {session?.name || "Member"}
            </div>
            <button
              className="rounded-full border border-[var(--brand-stroke)] bg-white px-4 py-2 text-xs font-semibold text-[var(--brand-ink)]"
              onClick={() => {
                clearMemberSession();
                router.replace("/login");
              }}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-28 pt-6 sm:px-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--brand-stroke)] bg-[rgba(255,253,248,0.98)] backdrop-blur">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-3 px-4 py-3 sm:px-6">
          {tabItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "flex flex-col items-center justify-center gap-1 rounded-[1.35rem] bg-[var(--brand-green)] px-4 py-3 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(45,90,39,0.24)]"
                    : "flex flex-col items-center justify-center gap-1 rounded-[1.35rem] border border-[var(--brand-stroke)] bg-white px-4 py-3 text-xs font-semibold text-[var(--brand-ink)]"
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
