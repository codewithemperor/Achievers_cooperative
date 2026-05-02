"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PasswordInput } from "@/components/form-input";
import { apiCallWithAlert } from "@/lib/alert";
import api from "@/lib/member-api";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function AccountChangePasswordPage() {
  const { control, handleSubmit, reset } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: PasswordFormValues) {
    const result = await apiCallWithAlert({
      title: "Password Change",
      loadingText: "Updating password...",
      apiCall: () =>
        api.post("/auth/change-password", {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      successTitle: "Password Changed",
      successText: "Your password has been updated successfully.",
    });

    if (result) {
      reset();
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white/92 p-5 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <h1 className="text-xl font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">Change password</h1>
        <p className="mt-1 text-sm text-[var(--text-400)]">Update your sign-in password from this secure page.</p>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <PasswordInput control={control} name="currentPassword" label="Current password" placeholder="Enter your current password" isRequired />
          <PasswordInput
            control={control}
            name="newPassword"
            label="New password"
            placeholder="Enter your new password"
            isRequired
            description="Must be at least 8 characters."
          />
          <PasswordInput control={control} name="confirmPassword" label="Confirm new password" placeholder="Re-enter your new password" isRequired />
          <button className="min-h-[44px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80" type="submit">
            Update password
          </button>
        </form>
      </section>
    </div>
  );
}
