"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiBaseUrl } from "../lib/member-api";
import { setMemberSession } from "../lib/member-session";

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: "MEMBER" | "SUPER_ADMIN";
    member: {
      fullName: string;
      avatarUrl?: string | null;
    } | null;
  };
}

export default function MemberLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitLogin() {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as LoginResponse | { message?: string } | null;

      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message || "Unable to sign in right now.");
      }

      if (!payload || !("token" in payload) || payload.user.role !== "MEMBER") {
        throw new Error("This login is for member accounts only.");
      }

      setMemberSession({
        token: payload.token,
        userId: payload.user.id,
        email: payload.user.email,
        name: payload.user.member?.fullName || payload.user.email,
        role: payload.user.role,
        profileImageUrl: payload.user.member?.avatarUrl || undefined,
      });

      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Unable to sign in right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#f3f0df,transparent_40%),linear-gradient(180deg,#fffdf8,#f6f1e3)] px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--brand-stroke)] bg-[rgba(255,253,248,0.92)] p-6 shadow-[0_24px_80px_rgba(23,50,30,0.12)] backdrop-blur">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[var(--brand-green)] text-lg font-semibold text-white">
          AC
        </div>
        <div className="mt-5 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-moss)]">Member Access</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">Sign in to your cooperative account</h1>
          <p className="mt-2 text-sm text-[var(--brand-moss)]">
            Use your registered email and password. New members can use their phone number as the default password.
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-[1.25rem] border border-[var(--brand-stroke)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email address"
            type="email"
            value={form.email}
          />
          <input
            className="min-h-12 rounded-2xl border border-[var(--brand-stroke)] bg-white px-4 text-sm outline-none"
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Password"
            type="password"
            value={form.password}
          />
          <button
            className="rounded-2xl bg-[var(--brand-green)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            onClick={() => void submitLogin()}
            type="button"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
