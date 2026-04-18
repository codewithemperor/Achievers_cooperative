"use client";

import { Card, Input, Button, Divider } from "@heroui/react";
import { FormField } from "@achievers/ui";
import { useState } from "react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure system parameters and platform settings
        </p>
      </div>

      {saved && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          Settings saved successfully.
        </div>
      )}

      {/* Membership Charges */}
      <Card className="mb-6 border border-slate-200 bg-white">
        <Card.Content className="p-5">
          <h3 className="text-base font-semibold text-[var(--brand-ink)]">
            Membership Charges
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Configure fees applied to wallet funding transactions
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <FormField label="Charge Type">
              <div className="flex gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="chargeType"
                    defaultChecked
                    className="accent-[var(--brand-ink)]"
                  />
                  Percentage (%)
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="chargeType"
                    className="accent-[var(--brand-ink)]"
                  />
                  Fixed Amount (₦)
                </label>
              </div>
            </FormField>
            <FormField label="Charge Value">
              <Input
                type="number"
                defaultValue="2"
                variant="bordered"
                radius="lg"
                placeholder="Enter percentage or fixed amount"
              />
            </FormField>
            <Button
              type="submit"
              className="bg-[var(--brand-ink)] text-white"
              radius="lg"
            >
              Save Changes
            </Button>
          </form>
        </Card.Content>
      </Card>

      {/* Loan Settings */}
      <Card className="mb-6 border border-slate-200 bg-white">
        <Card.Content className="p-5">
          <h3 className="text-base font-semibold text-[var(--brand-ink)]">
            Loan Settings
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Configure loan interest rates and limits
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <FormField label="Default Interest Rate (%)">
              <Input
                type="number"
                defaultValue="5"
                variant="bordered"
                radius="lg"
              />
            </FormField>
            <FormField label="Maximum Loan Multiplier (x savings)">
              <Input
                type="number"
                defaultValue="3"
                variant="bordered"
                radius="lg"
              />
            </FormField>
            <FormField label="Maximum Loan Tenor (months)">
              <Input
                type="number"
                defaultValue="24"
                variant="bordered"
                radius="lg"
              />
            </FormField>
            <Button
              type="submit"
              className="bg-[var(--brand-ink)] text-white"
              radius="lg"
            >
              Save Changes
            </Button>
          </form>
        </Card.Content>
      </Card>

      {/* Savings Settings */}
      <Card className="mb-6 border border-slate-200 bg-white">
        <Card.Content className="p-5">
          <h3 className="text-base font-semibold text-[var(--brand-ink)]">
            Savings Settings
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Configure minimum savings contribution
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <FormField label="Minimum Contribution (₦)">
              <Input
                type="number"
                defaultValue="1000"
                variant="bordered"
                radius="lg"
              />
            </FormField>
            <Button
              type="submit"
              className="bg-[var(--brand-ink)] text-white"
              radius="lg"
            >
              Save Changes
            </Button>
          </form>
        </Card.Content>
      </Card>

      {/* Bank Details */}
      <Card className="border border-slate-200 bg-white">
        <Card.Content className="p-5">
          <h3 className="text-base font-semibold text-[var(--brand-ink)]">
            Bank Transfer Details
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            These details are shown to members when funding their wallets
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <FormField label="Bank Name">
              <Input
                defaultValue="Guaranty Trust Bank"
                variant="bordered"
                radius="lg"
              />
            </FormField>
            <FormField label="Account Number">
              <Input defaultValue="0123456789" variant="bordered" radius="lg" />
            </FormField>
            <FormField label="Account Name">
              <Input
                defaultValue="Achievers Cooperative"
                variant="bordered"
                radius="lg"
              />
            </FormField>
            <Button
              type="submit"
              className="bg-[var(--brand-ink)] text-white"
              radius="lg"
            >
              Save Changes
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
