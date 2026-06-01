"use client";

import { useState } from "react";
import { parseDate } from "@internationalized/date";
import { Controller, useForm } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { AdminModal } from "@/components/ui/admin-modal";
import {
  DateRangePickerInput,
  NumberInput,
  SelectInput,
  TextInput,
} from "@/components/ui/form-input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { CheckCircle2, Clock3, Package, Pencil, Trash2, Users } from "lucide-react";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { ActionMenu } from "@/components/ui/action-menu";

interface PackagesResponse {
  items: Array<{
    id: string;
    name: string;
    totalAmount: number;
    pendingRequestCount: number;
    subscriberCount: number;
    durationMonths: number;
    startDate?: string | null;
    endDate?: string | null;
    penaltyType: string;
    isActive: boolean;
  }>;
}

interface PackageFormValues {
  name: string;
  totalAmount: number | undefined;
  schedule: { start: any; end: any } | null;
  penaltyType: string;
  penaltyValue: number | undefined;
  penaltyFrequency: string;
  addAllMembers: boolean;
}

const penaltyOptions: Array<{ id: string; label: string }> = [
  { id: "FIXED", label: "Fixed Amount" },
  { id: "PERCENTAGE", label: "Percentage" },
  { id: "NONE", label: "No Penalty" },
];

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function PackagesPage() {
  const packages = useApi<PackagesResponse>("/packages");
  const packageRows = packages.data?.items ?? [];
  const activePackages = packageRows.filter((item) => item.isActive);
  const pendingRequests = packageRows.reduce(
    (sum, item) => sum + Number(item.pendingRequestCount ?? 0),
    0,
  );
  const subscribers = packageRows.reduce(
    (sum, item) => sum + Number(item.subscriberCount ?? 0),
    0,
  );
  const [submitting, setSubmitting] = useState(false);
  const [editingPackage, setEditingPackage] = useState<
    PackagesResponse["items"][number] | null
  >(null);
  const { control, handleSubmit, reset } = useForm<PackageFormValues>({
    defaultValues: {
      name: "",
      totalAmount: undefined,
      schedule: null,
      penaltyType: "FIXED",
      penaltyValue: undefined,
      penaltyFrequency: "WEEKLY",
      addAllMembers: false,
    },
  });

  function buildPackagePayload(values: PackageFormValues) {
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      totalAmount: Number(values.totalAmount),
      startDate: values.schedule?.start?.toString?.() || undefined,
      endDate: values.schedule?.end?.toString?.() || undefined,
      penaltyType: values.penaltyType,
      penaltyValue: Number(values.penaltyValue ?? 0),
      penaltyFrequency: "WEEKLY",
    };

    payload.addAllMembers = Boolean(values.addAllMembers);

    return payload;
  }

  function toScheduleRange(item: PackagesResponse["items"][number]) {
    if (!item.startDate || !item.endDate) {
      return null;
    }

    return {
      start: parseDate(item.startDate.slice(0, 10)),
      end: parseDate(item.endDate.slice(0, 10)),
    };
  }

  const createPackage = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      const endpoint = editingPackage
        ? `/packages/${editingPackage.id}`
        : "/packages";
      const method = editingPackage ? api.patch : api.post;
      const { data } = await method(endpoint, buildPackagePayload(values));
      const autoSubscriberCount = Number(data?.autoSubscriberCount ?? 0);
      showSuccessToast(
        editingPackage
          ? values.addAllMembers
            ? `Package updated and ${autoSubscriberCount} member(s) were added.`
            : "Package updated successfully."
          : values.addAllMembers
            ? `Package created and ${autoSubscriberCount} member(s) were added.`
            : "Package created successfully.",
      );
      reset();
      setEditingPackage(null);
      await packages.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to save package.",
      );
      throw error;
    } finally {
      setSubmitting(false);
    }
  });

  const renderAddAllMembersCheckbox = (description: string) => (
    <Controller
      control={control}
      name="addAllMembers"
      render={({ field }) => (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--primary-900)/12] bg-white px-4 py-3 text-sm text-text-700 md:col-span-2">
          <input
            checked={Boolean(field.value)}
            className="mt-1 h-4 w-4 accent-[var(--primary-700)]"
            onChange={(event) => field.onChange(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-semibold text-text-900">
              Add all members to this package
            </span>
            <span className="mt-1 block text-xs text-text-400">
              {description}
            </span>
          </span>
        </label>
      )}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        actions={
          <AdminModal
            description="Create a package and choose from the default penalty configuration options."
            title="Add Package"
            trigger={
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white"
                onClick={() => {
                  setEditingPackage(null);
                  reset({
                    name: "",
                    totalAmount: undefined,
                    schedule: null,
                    penaltyType: "FIXED",
                    penaltyValue: 0,
                    penaltyFrequency: "WEEKLY",
                    addAllMembers: false,
                  });
                }}
                type="button"
              >
                Add package
              </button>
            }
          >
            {({ close }) => (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput
                    className="rounded-2xl md:col-span-2"
                    control={control}
                    label="Package Name"
                    name="name"
                    placeholder="Package name"
                  />
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Total Amount"
                    name="totalAmount"
                    placeholder="Total amount"
                    min={0}
                  />
                  <DateRangePickerInput
                    className="rounded-2xl"
                    control={control}
                    label="Date Range"
                    name="schedule"
                    description="Repayment frequency is fixed to weekly."
                  />
                  <SelectInput
                    className="rounded-2xl"
                    control={control}
                    label="Penalty Type"
                    name="penaltyType"
                    options={penaltyOptions}
                  />
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Penalty Value"
                    name="penaltyValue"
                    placeholder="Penalty value"
                    min={0}
                  />
                  {renderAddAllMembersCheckbox(
                    "Active members will be subscribed automatically when the package is created.",
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                    disabled={submitting}
                    onClick={async () => {
                      try {
                        await createPackage();
                        close();
                      } catch {}
                    }}
                    type="button"
                  >
                    {submitting ? "Saving..." : "Save package"}
                  </button>
                </div>
              </>
            )}
          </AdminModal>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Package plans created for members."
          href="/admin/packages"
          icon={<Package className="h-5 w-5" />}
          title="Total Packages"
          tone="green"
          value={packageRows.length}
        />
        <DashboardMetricCard
          description="Packages currently available to members."
          href="/admin/packages"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Active Packages"
          value={activePackages.length}
        />
        <DashboardMetricCard
          description="Package requests waiting for admin action."
          href="/admin/packages"
          icon={<Clock3 className="h-5 w-5" />}
          title="Pending Requests"
          tone={pendingRequests ? "amber" : "neutral"}
          value={pendingRequests}
        />
        <DashboardMetricCard
          description="Total subscribers across package plans."
          href="/admin/packages"
          icon={<Users className="h-5 w-5" />}
          title="Subscribers"
          value={subscribers}
        />
      </div>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Package",
            render: (item) => (
              <span className="font-semibold text-text-900">{item.name}</span>
            ),
          },
          {
            key: "amount",
            header: "Total Amount",
            render: (item) => currency.format(item.totalAmount),
          },
          {
            key: "duration",
            header: "Date Range",
            render: (item) =>
              item.startDate && item.endDate
                ? `${new Date(item.startDate).toLocaleDateString("en-NG")} - ${new Date(item.endDate).toLocaleDateString("en-NG")}`
                : `${item.durationMonths} months`,
          },
          {
            key: "penalty",
            header: "Penalty",
            render: (item) => item.penaltyType,
          },
          {
            key: "pendingRequests",
            header: "Pending Requests",
            render: (item) => item.pendingRequestCount ?? 0,
          },
          {
            key: "subscribers",
            header: "Subscribers",
            render: (item) => item.subscriberCount ?? 0,
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.isActive ? "ACTIVE" : "INACTIVE"}
                variant={item.isActive ? "success" : "warning"}
              />
            ),
          },
          {
            key: "detail",
            header: "Actions",
            align: "right",
            isAction: true,
            render: (item) => (
              <ActionMenu
                items={[
                  {
                    label: "Open details",
                    onSelect: () => {
                      window.location.href = `/admin/packages/${item.id}`;
                    },
                  },
                  {
                    label: "Edit",
                    onSelect: () => {
                        setEditingPackage(item);
                        reset({
                          name: item.name,
                          totalAmount: item.totalAmount,
                          schedule: toScheduleRange(item),
                          penaltyType: item.penaltyType,
                          penaltyValue: 0,
                          penaltyFrequency: "WEEKLY",
                          addAllMembers: false,
                        });
                    },
                  },
                  {
                    label: "Delete",
                    tone: "danger",
                    confirmTitle: "Delete package?",
                    confirmMessage:
                      "Are you sure you want to delete this package?",
                    onSelect: async () => {
                    try {
                      await api.delete(`/packages/${item.id}`);
                      showSuccessToast("Package deleted successfully.");
                      await packages.refetch();
                    } catch (error: any) {
                      showErrorToast(
                        error?.response?.data?.message ||
                        "Unable to delete package.",
                      );
                    }
                    },
                  },
                ]}
              />
            ),
          },
        ]}
        data={packageRows}
        statusAccessor={(item) => (item.isActive ? "ACTIVE" : "INACTIVE")}
        emptyDescription={
          packages.error || "No packages have been configured yet."
        }
        loading={packages.loading}
      />
      {editingPackage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4 backdrop-blur-sm">
          <button
            aria-label="Close edit package"
            className="absolute inset-0"
            onClick={() => setEditingPackage(null)}
            type="button"
          />
          <div className="relative z-[101] max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-primary-900/8 bg-white shadow-[0_24px_60px_var(--primary-900)/12] dark:border-[var(--background-700)] dark:bg-[var(--background-900)]">
            <div className="flex items-start justify-between gap-4 border-b border-primary-900/8 px-5 py-4 sm:px-6 dark:border-[var(--background-700)]">
              <div>
                <h2 className="text-2xl font-semibold text-text-900 dark:text-text-50">
                  Edit Package
                </h2>
                <p className="mt-2 text-sm text-text-400">
                  Update package configuration.
                </p>
              </div>
              <button
                className="rounded-full border border-primary-900/12 px-3 py-1 text-sm text-text-900 dark:border-[var(--background-700)] dark:text-text-100"
                onClick={() => setEditingPackage(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  className="rounded-2xl md:col-span-2"
                  control={control}
                  label="Package Name"
                  name="name"
                  placeholder="Package name"
                />
                <NumberInput
                  className="rounded-2xl"
                  control={control}
                  label="Total Amount"
                  name="totalAmount"
                  placeholder="Total amount"
                  min={0}
                />
                <DateRangePickerInput
                  className="rounded-2xl"
                  control={control}
                  label="Date Range"
                  name="schedule"
                  description="Repayment frequency is fixed to weekly."
                />
                <SelectInput
                  className="rounded-2xl"
                  control={control}
                  label="Penalty Type"
                  name="penaltyType"
                  options={penaltyOptions}
                />
                <NumberInput
                  className="rounded-2xl"
                  control={control}
                  label="Penalty Value"
                  name="penaltyValue"
                  placeholder="Penalty value"
                  min={0}
                />
                {renderAddAllMembersCheckbox(
                  "Only active members who are not already subscribed to this package will be added.",
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                  disabled={submitting}
                  onClick={async () => {
                    try {
                      await createPackage();
                      setEditingPackage(null);
                    } catch {}
                  }}
                  type="button"
                >
                  {submitting ? "Saving..." : "Save package"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
