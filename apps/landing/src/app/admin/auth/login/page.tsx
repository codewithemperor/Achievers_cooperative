"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import api from "@/lib/api";
import { setSession } from "@/lib/session";
import { PasswordInput, TextInput } from "@/components/ui/form-input";

interface LoginValues {
  email: string;
  password: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<LoginValues>({
    defaultValues: {
      email: "operations@achievers.com",
      password: "Admin@123",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      setError(null);
      const response = await api.post("/auth/login", values);
      const user = response.data.user;

      if (user.role !== "SUPER_ADMIN") {
        setError("This login is reserved for super administrators.");
        return;
      }

      setSession({
        token: response.data.token,
        userId: user.id,
        email: user.email,
        name: user.member?.fullName || user.email,
        role: user.role,
      });

      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(61,122,53,0.18),transparent_40%),linear-gradient(160deg,#f5f0e8_0%,#ffffff_55%,#e8e0d0_100%)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2.5rem] bg-[linear-gradient(165deg,rgba(26,46,26,1),rgba(45,90,39,0.94))] p-8 text-white shadow-[0_30px_80px_rgba(26,46,26,0.22)] md:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[rgba(245,240,232,0.72)]">
            Cooperative Management System
          </p>
          <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight md:text-5xl">
            Admin operations with traceable finance, members, and approvals.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-[rgba(245,240,232,0.8)]">
            Review members, verify wallet funding, oversee loans, and manage cooperative finances from one secure dashboard.
          </p>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_24px_60px_rgba(26,46,26,0.1)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-mid)]">
            Admin sign in
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--color-dark)]">Welcome back</h2>
          <p className="mt-2 text-sm text-[var(--color-coop-muted)]">
            Use an administrator account to access the cooperative workspace.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <TextInput control={control} label="Email address" name="email" placeholder="admin@example.com" />
            <PasswordInput control={control} label="Password" name="password" placeholder="Enter your password" />

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              className="w-full rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-mid)]"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Signing in..." : "Enter admin workspace"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
