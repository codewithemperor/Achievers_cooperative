"use client";

import { useMemo, useState } from "react";
import { AdminModal } from "@/components/ui/admin-modal";
import { PageHeader } from "@/components/ui/page-header";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import api from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

const labels: Record<string, string> = {
  MEMBERSHIP_FEE_AMOUNT: "Membership Fee Amount",
  COOPERATIVE_DEDUCTION_DAY: "Weekly Deduction Day",
  COOPERATIVE_DEDUCTION_AMOUNT: "Weekly Deduction Amount",
  COOPERATIVE_DEDUCTION_LAST_RUN: "Last Deduction Run",
  BANK_ACCOUNT_NAME: "Bank Account Name",
  BANK_ACCOUNT_NUMBER: "Bank Account Number",
  BANK_NAME: "Bank Name",
  MEMBER_TERMS_HTML: "Member Terms & Conditions",
};

const descriptions: Record<string, string> = {
  MEMBERSHIP_FEE_AMOUNT: "Automatically posted during member registration.",
  COOPERATIVE_DEDUCTION_DAY: "The weekday on which weekly deductions become due.",
  COOPERATIVE_DEDUCTION_AMOUNT: "Deducted from every active member once per scheduled week.",
  COOPERATIVE_DEDUCTION_LAST_RUN: "Managed by the backend auto-deduction flow.",
  BANK_ACCOUNT_NAME: "Displayed to members for wallet funding transfers.",
  BANK_ACCOUNT_NUMBER: "Displayed to members for wallet funding transfers.",
  BANK_NAME: "Displayed to members for wallet funding transfers.",
  MEMBER_TERMS_HTML: "Rendered in the member profile and dashboard terms areas.",
};

const dayOptions = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function sortRows(items: ConfigItem[]) {
  return [...items].sort((left, right) => left.key.localeCompare(right.key));
}

export default function SettingsPage() {
  const config = useApi<ConfigItem[] | { items: ConfigItem[] }>("/config");
  const rows = useMemo(() => {
    const items = Array.isArray(config.data) ? config.data : config.data?.items ?? [];
    return sortRows(items);
  }, [config.data]);

  const [draftValue, setDraftValue] = useState("");
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function updateConfigValue(key: string, value: string) {
    try {
      setSaving(true);
      await api.patch(`/config/${key}`, { value });
      showSuccessToast("Setting updated successfully.");
      await config.refetch();
      setDraftKey(null);
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to update this setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage all system configuration keys from the table below. Weekly deductions now auto-run once on the scheduled day when the API receives live traffic."
      />

      <section className="overflow-hidden rounded-[2rem] border border-[var(--primary-900)/8] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--primary-900)/8]">
            <thead className="bg-[rgba(245,240,232,0.7)]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-400)]">Key</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-400)]">Value</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-400)]">Description</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-400)]">Updated</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-400)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--primary-900)/8]">
              {rows.map((item) => {
                const isTerms = item.key === "MEMBER_TERMS_HTML";
                const isReadonly = item.key === "COOPERATIVE_DEDUCTION_LAST_RUN";
                const isDay = item.key === "COOPERATIVE_DEDUCTION_DAY";
                const isNumber = item.key === "MEMBERSHIP_FEE_AMOUNT" || item.key === "COOPERATIVE_DEDUCTION_AMOUNT";

                return (
                  <tr key={item.id}>
                    <td className="px-6 py-5 align-top">
                      <p className="font-semibold text-[var(--text-900)]">{labels[item.key] || item.key}</p>
                      <p className="mt-1 text-xs text-[var(--text-400)]">{item.key}</p>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="max-w-xl break-words text-sm text-[var(--text-900)]">
                        {isTerms ? <span dangerouslySetInnerHTML={{ __html: item.value }} /> : item.value || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top text-sm text-[var(--text-400)]">
                      {descriptions[item.key] || "General system configuration value."}
                    </td>
                    <td className="px-6 py-5 align-top text-sm text-[var(--text-400)]">
                      {item.value ? new Date(item.updatedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-5 align-top text-right">
                      {isReadonly ? (
                        <span className="text-sm text-[var(--text-400)]">Auto-managed</span>
                      ) : (
                        <AdminModal
                          description={descriptions[item.key] || "Update this system configuration value."}
                          title={`Edit ${labels[item.key] || item.key}`}
                          trigger={
                            <button
                              className="rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-900)]"
                              onClick={() => {
                                setDraftKey(item.key);
                                setDraftValue(item.value);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                          }
                        >
                          <div className="space-y-4">
                            {isTerms ? (
                              <RichTextEditor value={draftKey === item.key ? draftValue : item.value} onChange={setDraftValue} />
                            ) : isDay ? (
                              <select
                                className="min-h-12 w-full rounded-2xl border border-[var(--primary-900)/12] px-4 text-sm text-[var(--text-900)] outline-none"
                                onChange={(event) => setDraftValue(event.target.value)}
                                value={draftKey === item.key ? draftValue : item.value}
                              >
                                {dayOptions.map((day) => (
                                  <option key={day} value={day}>
                                    {day}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className="min-h-12 w-full rounded-2xl border border-[var(--primary-900)/12] px-4 text-sm text-[var(--text-900)] outline-none"
                                onChange={(event) => setDraftValue(event.target.value)}
                                type={isNumber ? "number" : "text"}
                                value={draftKey === item.key ? draftValue : item.value}
                              />
                            )}
                            <div className="flex justify-end">
                              <button
                                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                                disabled={saving}
                                onClick={async () => {
                                  await updateConfigValue(item.key, draftKey === item.key ? draftValue : item.value);
                                  close();
                                }}
                                type="button"
                              >
                                {saving ? "Saving..." : "Save changes"}
                              </button>
                            </div>
                          </div>
                        </AdminModal>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
