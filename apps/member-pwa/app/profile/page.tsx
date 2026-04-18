"use client";

import { Card, Input, Button } from "@heroui/react";
import { FormField } from "@achievers/ui";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[var(--brand-ink)]">Profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage your account information
      </p>

      {/* Profile Card */}
      <Card className="mt-4 border border-slate-200 bg-white">
        <Card.Content className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-ink)] text-xl font-bold text-white">
              JO
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--brand-ink)]">
                John Doe
              </p>
              <p className="text-sm text-slate-400">Member #ACH-001</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-green-600">
                  Active
                </span>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Edit Form */}
      <Card className="mt-4 border border-slate-200 bg-white">
        <Card.Content className="p-5">
          <h3 className="text-base font-semibold text-[var(--brand-ink)]">
            Personal Information
          </h3>
          <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <FormField label="Full Name">
              <Input
                placeholder="John Doe"
                variant="secondary"
                defaultValue="John Doe"
              />
            </FormField>
            <FormField label="Email Address">
              <Input
                type="email"
                placeholder="john@example.com"
                variant="secondary"
                defaultValue="john@achievers.com"
              />
            </FormField>
            <FormField label="Phone Number">
              <Input
                type="tel"
                placeholder="+234 800 000 0000"
                variant="secondary"
                defaultValue="+234 8012345678"
              />
            </FormField>
            <Button
              type="submit"
              className="w-full bg-[var(--brand-ink)] text-white"
            >
              Save Changes
            </Button>
          </form>
        </Card.Content>
      </Card>

      {/* Security */}
      <Card className="mt-4 border border-slate-200 bg-white">
        <Card.Content className="p-5">
          <h3 className="text-base font-semibold text-[var(--brand-ink)]">
            Security
          </h3>
          <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <FormField label="Current Password">
              <Input
                type="password"
                placeholder="Enter current password"
                variant="secondary"
              />
            </FormField>
            <FormField label="New Password">
              <Input
                type="password"
                placeholder="Enter new password"
                variant="secondary"
              />
            </FormField>
            <FormField label="Confirm New Password">
              <Input
                type="password"
                placeholder="Confirm new password"
                variant="secondary"
              />
            </FormField>
            <Button
              type="submit"
              className="w-full bg-[var(--brand-ink)] text-white"
            >
              Update Password
            </Button>
          </form>
        </Card.Content>
      </Card>

      {/* Logout */}
      <button className="mt-4 w-full rounded-xl border border-red-200 bg-white p-4 text-center text-sm font-medium text-red-500 transition-colors hover:bg-red-50">
        Sign Out
      </button>
    </div>
  );
}
