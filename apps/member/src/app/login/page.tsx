"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TextInput, PasswordInput } from "@/components/form-input";
import api from "@/lib/member-api";
import { setMemberSession } from "@/lib/member-session";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, setError } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      setSubmitting(true);

      const { data: payload } = await api.post<LoginResponse>(
        "/auth/login",
        values,
      );

      if (!payload || !payload.token || payload.user.role !== "MEMBER") {
        setError("root", {
          message: "This login is for member accounts only.",
        });
        return;
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
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to sign in right now.";
      setError("root", { message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-background-50 dark:bg-background-200 p-6 py-10 shadow-lg">
        <div className="flex justify-center">
          <Image
            src="/logo.jpeg"
            alt="Achievers Cooperative"
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl object-cover"
          />
        </div>
        <div className="mt-5 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-400">
            Member Access
          </p>
          <h1 className="mt-2 font-display leading-[1.05] tracking-[-0.04em] text-3xl font-bold text-text-900">
            Sign in to your cooperative account
          </h1>
          <p className="mt-2 text-xs text-text-500 px-4">
            Use your registered email and password. New members can use their
            phone number as the default password.
          </p>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <TextInput
            control={control}
            name="email"
            label="Email address"
            placeholder="you@example.com"
            type="email"
            isRequired
          />
          <PasswordInput
            control={control}
            name="password"
            label="Password"
            placeholder="Enter your password"
            isRequired
          />
          <button
            className="min-h-11 rounded-2xl bg-primary-800 dark:bg-primary-200 px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
