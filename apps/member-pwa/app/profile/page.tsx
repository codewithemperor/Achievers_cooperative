"use client";

import { useEffect, useState } from "react";
import { MemberModal } from "../components/member-modal";
import { getApiBaseUrl, getMemberToken, uploadMemberImage } from "../lib/member-api";
import { useMemberData } from "../lib/use-member-data";

interface AuthPayload {
  id: string;
  email: string;
  member: {
    id: string;
    fullName: string;
    phoneNumber: string;
    membershipNumber: string;
    status: string;
    joinedAt: string;
    homeAddress?: string;
    stateOfOrigin?: string;
    dateOfBirth?: string;
    occupation?: string;
    maritalStatus?: string;
    identificationNumber?: string;
    identificationType?: string;
    avatarUrl?: string | null;
  } | null;
}

interface DashboardPayload {
  termsHtml: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const fallbackAuth: AuthPayload = {
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

export default function ProfilePage() {
  const auth = useMemberData<AuthPayload>("/auth/me", fallbackAuth);
  const dashboard = useMemberData<DashboardPayload>("/members/me/dashboard", {
    termsHtml: "<p>Terms and conditions will appear here once connected.</p>",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileForm, setProfileForm] = useState({
    homeAddress: "",
    occupation: "",
    avatarUrl: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHint, setInstallHint] = useState<string | null>(null);

  const member = auth.data.member;

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallHint("App install started.");
        setInstallPrompt(null);
      }
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setInstallHint("On iPhone or iPad, open Share and choose Add to Home Screen.");
      return;
    }

    setInstallHint("Use your browser menu or install icon to add this app to your device.");
  }

  async function handleProfilePictureUpload(file: File | null) {
    if (!file) return;

    try {
      const upload = await uploadMemberImage(file, "member-avatar");
      setProfileForm((current) => ({ ...current, avatarUrl: upload.url }));
    } catch {
      setMessage("Unable to upload that image right now.");
    }
  }

  async function submitPasswordChange() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getMemberToken() ? { Authorization: `Bearer ${getMemberToken()}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to change password right now.");
      }

      setMessage("Password updated successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsPasswordModalOpen(false);
    } catch {
      setMessage("Unable to change password right now.");
    }
  }

  async function saveProfile() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/members/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(getMemberToken() ? { Authorization: `Bearer ${getMemberToken()}` } : {}),
        },
        body: JSON.stringify({
          homeAddress: profileForm.homeAddress || undefined,
          occupation: profileForm.occupation || undefined,
          avatarUrl: profileForm.avatarUrl || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to save profile changes right now.");
      }

      setMessage("Profile changes saved.");
      setIsProfileModalOpen(false);
    } catch {
      setMessage("Unable to save profile changes right now.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-green)] text-lg font-semibold text-white">
              {member?.avatarUrl ? (
                <img alt={member.fullName} className="h-full w-full object-cover" src={member.avatarUrl} />
              ) : (
                (member?.fullName.slice(0, 2).toUpperCase() || "AC")
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--brand-ink)]">{member?.fullName || "Member"}</h1>
              <p className="text-sm text-[var(--brand-moss)]">{member?.membershipNumber}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">{member?.status}</p>
            </div>
          </div>
          <button
            aria-label="Edit profile"
            className="rounded-full border border-[var(--brand-stroke)] bg-white p-3 text-[var(--brand-ink)]"
            onClick={() => {
              setProfileForm({
                homeAddress: member?.homeAddress || "",
                occupation: member?.occupation || "",
                avatarUrl: member?.avatarUrl || "",
              });
              setIsProfileModalOpen(true);
            }}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125 16.875 4.5" />
            </svg>
          </button>
        </div>
      </section>

      {message ? (
        <div className="rounded-[1.5rem] border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)]">
          {message}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Profile</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-[var(--brand-stroke)] bg-white px-4 py-2 text-xs font-semibold text-[var(--brand-ink)]"
              onClick={() => void installApp()}
              type="button"
            >
              Install app
            </button>
            <button
              className="rounded-full border border-[var(--brand-stroke)] bg-white px-4 py-2 text-xs font-semibold text-[var(--brand-ink)]"
              onClick={() => setIsPasswordModalOpen(true)}
              type="button"
            >
              Change password
            </button>
          </div>
        </div>
        {installHint ? (
          <div className="mt-4 rounded-[1.25rem] border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)]">
            {installHint}
          </div>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Phone number</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{member?.phoneNumber || "-"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Email</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{auth.data.email}</p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Home address</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{member?.homeAddress || "-"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Occupation</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{member?.occupation || "-"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">State of origin</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{member?.stateOfOrigin || "-"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Marital status</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{member?.maritalStatus || "-"}</p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Date of birth</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">
              {member?.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString("en-NG") : "-"}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--brand-stroke)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--brand-moss)]">Identification</p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">
              {member?.identificationType || "-"} {member?.identificationNumber ? ` / ${member.identificationNumber}` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--brand-ink)]">Terms and conditions</h2>
        <div
          className="prose prose-sm mt-4 max-w-none text-[var(--brand-ink)]"
          dangerouslySetInnerHTML={{ __html: dashboard.data.termsHtml }}
        />
      </section>

      <MemberModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Edit profile"
        description="Update your address, occupation, and profile picture."
      >
        <div className="grid gap-4">
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setProfileForm((current) => ({ ...current, homeAddress: event.target.value }))}
            placeholder="Home address"
            value={profileForm.homeAddress}
          />
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setProfileForm((current) => ({ ...current, occupation: event.target.value }))}
            placeholder="Occupation"
            value={profileForm.occupation}
          />
          <div className="grid gap-2">
            <label className="text-sm font-medium text-[var(--brand-ink)]" htmlFor="member-profile-picture">
              Profile picture
            </label>
            <input
              id="member-profile-picture"
              accept="image/*"
              className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm outline-none"
              onChange={(event) => void handleProfilePictureUpload(event.target.files?.[0] ?? null)}
              type="file"
            />
            <input
              className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
              onChange={(event) => setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))}
              placeholder="Or paste image URL"
              value={profileForm.avatarUrl}
            />
          </div>
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => void saveProfile()}
            type="button"
          >
            Save profile
          </button>
        </div>
      </MemberModal>

      <MemberModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change password"
        description="Update your member sign-in password."
      >
        <div className="grid gap-4">
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
            placeholder="Current password"
            type="password"
            value={passwordForm.currentPassword}
          />
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
            placeholder="New password"
            type="password"
            value={passwordForm.newPassword}
          />
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Confirm new password"
            type="password"
            value={passwordForm.confirmPassword}
          />
          <button
            className="rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm font-semibold text-[var(--brand-ink)]"
            onClick={() => void submitPasswordChange()}
            type="button"
          >
            Update password
          </button>
        </div>
      </MemberModal>
    </div>
  );
}
