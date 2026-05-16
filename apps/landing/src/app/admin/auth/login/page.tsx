"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Image from "next/image";
import { Alert } from "@heroui/react";
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
  const [alert, setAlert] = useState<{
    status: "success" | "danger";
    title: string;
    description?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<LoginValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      setError(null);
      setAlert(null);
      const response = await api.post("/auth/login", {
        ...values,
        email: values.email.trim().toLowerCase(),
      });
      const user = response.data.user;

      if (user.role !== "SUPER_ADMIN") {
        const message = "This login is reserved for super administrators.";
        setAlert({
          status: "danger",
          title: "Sign in failed",
          description: message,
        });
        setError(message);
        return;
      }

      setSession({
        token: response.data.token,
        userId: user.id,
        email: user.email,
        name: user.member?.fullName || user.email,
        role: user.role,
      });

      setAlert({
        status: "success",
        title: response.data.message || "Signed in successfully.",
        description: "Opening your admin workspace.",
      });
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      const message = err?.response?.data?.message || "Unable to sign in.";
      const description = Array.isArray(message) ? message.join(", ") : message;
      setAlert({
        status: "danger",
        title: "Sign in failed",
        description,
      });
      setError(message);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-50 px-4">
      <section className="w-full max-w-md rounded-2xl bg-background-50 p-6 py-10 shadow-lg">
        <div className="flex justify-center">
          <Image
            src="/logo.jpeg"
            alt="Achievers Cooperative"
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl object-cover"
            priority
          />
        </div>

        <div className="mt-5 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-400">
            Admin Access
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.05] text-text-900">
            Sign in to admin workspace
          </h1>
        </div>

        <form
          autoComplete="off"
          className="mt-6 grid gap-4"
          onSubmit={onSubmit}
        >
          <TextInput
            autoComplete="off"
            control={control}
            label="Email address"
            name="email"
            placeholder="admin@example.com"
            type="email"
          />
          <PasswordInput
            autoComplete="new-password"
            control={control}
            label="Password"
            name="password"
            placeholder="Enter your password"
          />

          {alert ? (
            <Alert status={alert.status}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{alert.title}</Alert.Title>
                {alert.description ? (
                  <Alert.Description>{alert.description}</Alert.Description>
                ) : null}
              </Alert.Content>
            </Alert>
          ) : error ? (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Sign in failed</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <button
            className="min-h-11 rounded-2xl bg-[var(--primary-800)] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
