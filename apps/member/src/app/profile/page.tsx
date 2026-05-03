"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  FileText,
  LogOut,
  MonitorDown,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useProfileData } from "@/hooks/use-profile-data";
import { clearMemberSession } from "@/lib/member-session";
import { initialsFromName } from "@/lib/member-format";

const fallbackProfile = {
  id: "demo",
  email: "member@example.com",
  member: {
    id: "member-demo",
    fullName: "Member",
    phoneNumber: "08000000000",
    membershipNumber: "ACH-000000",
    status: "ACTIVE",
    joinedAt: new Date().toISOString(),
    homeAddress: "",
    stateOfOrigin: "",
    dateOfBirth: new Date().toISOString(),
    occupation: "",
    maritalStatus: "",
    identificationNumber: "",
    identificationType: "",
    avatarUrl: null,
  },
};

const menuItems = [
  { label: "Profile", href: "/account/profile", icon: UserRound },
  { label: "Bank Account", href: "/account/bank-account", icon: Building2 },
  { label: "Install App", href: "/account/install-app", icon: MonitorDown },
  {
    label: "Change Password",
    href: "/account/change-password",
    icon: ShieldCheck,
  },
  {
    label: "Terms and Conditions",
    href: "/account/terms-and-conditions",
    icon: FileText,
  },
];

export default function ProfilePage() {
  const profile = useProfileData(fallbackProfile);
  const member = profile.data.member;
  const router = useRouter();

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] bg-gradient-to-br from-[#1f8f5c] via-[#169368] to-[#0f6f61] p-5 text-white shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/18 text-2xl font-semibold">
            {member?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatarUrl}
                alt={member.fullName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initialsFromName(member?.fullName)
            )}
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">
              {member?.fullName || "Member"}
            </h1>
            <p className="mt-1 text-sm text-white/76">
              {member?.membershipNumber}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-white/16 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/88">
              {member?.status || "Active"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <div className="space-y-3">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-full border border-[var(--background-200)] px-4 py-3 text-sm font-medium text-text-700 transition hover:bg-[var(--background-100)] dark:border-white/10 dark:text-[var(--text-200)] dark:hover:bg-white/8"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--background-100)] text-[var(--primary-600)] dark:bg-white/8 dark:text-[var(--primary-700)]">
                  <item.icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-text-400" />
            </Link>
          ))}

          <button
            className="flex w-full items-center justify-between rounded-full border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
            onClick={() => {
              clearMemberSession();
              router.replace("/login");
            }}
            type="button"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
                <LogOut className="h-4 w-4" />
              </span>
              <span>Logout</span>
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
