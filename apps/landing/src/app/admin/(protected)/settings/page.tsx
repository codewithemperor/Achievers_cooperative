"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@heroui/react";
import { useForm } from "react-hook-form";
import { AdminModal } from "@/components/ui/admin-modal";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { TextInput } from "@/components/ui/form-input";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

function EditSettingForm({
  item,
  onSaved,
}: {
  item: ConfigItem;
  onSaved: (value: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<{ key: string; value: string }>({
    defaultValues: {
      key: item.key,
      value: item.value,
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await onSaved(values.value);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <div className="grid gap-4">
        <TextInput className="rounded-2xl" control={control} isDisabled label="Config Key" name="key" />
        <TextInput className="rounded-2xl" control={control} label="Config Value" name="value" />
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white"
          isDisabled={submitting}
          onPress={() => void submit()}
        >
          {submitting ? "Saving..." : "Save setting"}
        </Button>
      </div>
    </>
  );
}

export default function SettingsPage() {
  const config = useApi<ConfigItem[] | { items: ConfigItem[] }>("/config");
  const rows = Array.isArray(config.data) ? config.data : config.data?.items ?? [];

  async function updateConfig(key: string, value: string) {
    try {
      await api.patch(`/config/${key}`, { value });
      showSuccessToast("Setting updated successfully.");
      await config.refetch();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to update setting.");
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="System-wide cooperative parameters for defaults, notifications, and operations."
      />

      <DataTable
        columns={[
          {
            key: "key",
            header: "Key",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.key}</span>,
          },
          {
            key: "value",
            header: "Value",
            render: (item) => item.value,
          },
          {
            key: "updated",
            header: "Updated",
            render: (item) => new Date(item.updatedAt).toLocaleString(),
          },
          {
            key: "edit",
            header: "Edit",
            render: (item) => (
              <AdminModal
                description="Update the config value. The config key remains locked."
                title="Edit Setting"
                trigger={
                  <button className="inline-flex items-center gap-2 font-semibold text-[var(--color-green)]" type="button">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                }
              >
                <EditSettingForm item={item} onSaved={(value) => updateConfig(item.key, value)} />
              </AdminModal>
            ),
          },
        ]}
        data={rows}
        emptyDescription={config.error || "No settings are configured yet."}
        loading={config.loading}
      />
    </div>
  );
}
