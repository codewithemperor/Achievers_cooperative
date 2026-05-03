"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { AdminModal } from "@/components/ui/admin-modal";
import {
  NumberInput,
  SelectInput,
  TextInput,
} from "@/components/ui/form-input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface PackagesResponse {
  items: Array<{
    id: string;
    name: string;
    totalAmount: number;
    durationMonths: number;
    penaltyType: string;
    isActive: boolean;
  }>;
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
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<{
    name: string;
    totalAmount: number | undefined;
    durationMonths: number | undefined;
    penaltyType: string;
    penaltyValue: number | undefined;
    penaltyFrequency: string;
  }>({
    defaultValues: {
      name: "",
      totalAmount: undefined,
      durationMonths: undefined,
      penaltyType: "FIXED",
      penaltyValue: undefined,
      penaltyFrequency: "MONTHLY",
    },
  });

  const createPackage = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await api.post("/packages", {
        name: values.name,
        totalAmount: Number(values.totalAmount),
        durationMonths: Number(values.durationMonths),
        penaltyType: values.penaltyType,
        penaltyValue: Number(values.penaltyValue),
        penaltyFrequency: values.penaltyFrequency,
      });
      showSuccessToast("Package created successfully.");
      reset();
      await packages.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to create package.",
      );
    } finally {
      setSubmitting(false);
    }
  });

  async function updateStatus(id: string, isActive: boolean) {
    try {
      setStatusUpdatingId(id);
      await api.patch(`/packages/${id}`, { isActive });
      showSuccessToast("Package status updated successfully.");
      await packages.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to update package status.",
      );
    } finally {
      setStatusUpdatingId(null);
    }
  }

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
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Duration Months"
                    name="durationMonths"
                    placeholder="Duration months"
                    min={1}
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
                    onClick={() =>
                      void handleSubmit(async (values) => {
                        try {
                          setSubmitting(true);
                          await api.post("/packages", {
                            name: values.name,
                            totalAmount: Number(values.totalAmount),
                            durationMonths: Number(values.durationMonths),
                            penaltyType: values.penaltyType,
                            penaltyValue: Number(values.penaltyValue),
                            penaltyFrequency: values.penaltyFrequency,
                          });
                          showSuccessToast("Package created successfully.");
                          reset();
                          await packages.refetch();
                          close();
                        } catch (error: any) {
                          showErrorToast(
                            error?.response?.data?.message ||
                              "Unable to create package.",
                          );
                        } finally {
                          setSubmitting(false);
                        }
                      })()
                    }
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
            header: "Duration",
            render: (item) => `${item.durationMonths} months`,
          },
          {
            key: "penalty",
            header: "Penalty",
            render: (item) => item.penaltyType,
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
            header: "Detail",
            render: (item) => (
              <div className="flex items-center gap-3">
                <Link
                  className="font-semibold text-[var(--primary-700)]"
                  href={`/admin/packages/${item.id}`}
                >
                  Open detail
                </Link>
                <button
                  className="text-xs font-semibold text-text-700"
                  disabled={statusUpdatingId === item.id}
                  onClick={() => void updateStatus(item.id, !item.isActive)}
                  type="button"
                >
                  {statusUpdatingId === item.id
                    ? "Updating..."
                    : item.isActive
                      ? "Deactivate"
                      : "Activate"}
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
