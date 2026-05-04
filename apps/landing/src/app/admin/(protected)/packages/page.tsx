"use client";

import { useState } from "react";
import Link from "next/link";
import { parseDate } from "@internationalized/date";
import { useForm } from "react-hook-form";
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
import { Pencil, Trash2 } from "lucide-react";

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
    },
  });

  function buildPackagePayload(values: PackageFormValues) {
    return {
      name: values.name.trim(),
      totalAmount: Number(values.totalAmount),
      startDate: values.schedule?.start?.toString?.() || undefined,
      endDate: values.schedule?.end?.toString?.() || undefined,
      penaltyType: values.penaltyType,
      penaltyValue: Number(values.penaltyValue ?? 0),
      penaltyFrequency: "WEEKLY",
    };
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
      await method(endpoint, buildPackagePayload(values));
      showSuccessToast(
        editingPackage
          ? "Package updated successfully."
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        subtitle="Structured savings or repayment packages with penalty configuration and subscription visibility."
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
            render: (item) => (
              <div className="flex items-center gap-3">
                <Link
                  className="font-semibold text-[var(--primary-700)]"
                  href={`/admin/packages/${item.id}`}
                >
                  Open detail
                </Link>
                <AdminModal
                  description="Update package configuration."
                  title="Edit Package"
                  trigger={
                    <button
                      className="text-text-700"
                      onClick={() => {
                        setEditingPackage(item);
                        reset({
                          name: item.name,
                          totalAmount: item.totalAmount,
                          schedule: toScheduleRange(item),
                          penaltyType: item.penaltyType,
                          penaltyValue: 0,
                          penaltyFrequency: "WEEKLY",
                        });
                      }}
                      type="button"
                    >
                      <Pencil className="h-4 w-4" />
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
                <button
                  className="text-[#b42318]"
                  onClick={async () => {
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
                  }}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
        data={packages.data?.items ?? []}
        emptyDescription={
          packages.error || "No packages have been configured yet."
        }
        loading={packages.loading}
      />
    </div>
  );
}
