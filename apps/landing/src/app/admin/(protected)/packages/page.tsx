"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { AdminModal } from "@/components/ui/admin-modal";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/form-input";
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
      showErrorToast(error?.response?.data?.message || "Unable to create package.");
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
                className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white"
                type="button"
              >
                Add package
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput className="rounded-2xl md:col-span-2" control={control} label="Package Name" name="name" placeholder="Package name" />
              <NumberInput className="rounded-2xl" control={control} label="Total Amount" name="totalAmount" placeholder="Total amount" min={0} />
              <NumberInput className="rounded-2xl" control={control} label="Duration Months" name="durationMonths" placeholder="Duration months" min={1} />
              <SelectInput className="rounded-2xl" control={control} label="Penalty Type" name="penaltyType" options={penaltyOptions} />
              <NumberInput className="rounded-2xl" control={control} label="Penalty Value" name="penaltyValue" placeholder="Penalty value" min={0} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white" isDisabled={submitting} onPress={() => void createPackage()}>
                {submitting ? "Saving..." : "Save package"}
              </Button>
            </div>
          </AdminModal>
        }
      />
      <DataTable
        columns={[
          {
            key: "name",
            header: "Package",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.name}</span>,
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
            render: (item) => <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} variant={item.isActive ? "success" : "warning"} />,
          },
          {
            key: "detail",
            header: "Detail",
            render: (item) => (
              <Link className="font-semibold text-[var(--color-green)]" href={`/admin/packages/${item.id}`}>
                Open detail
              </Link>
            ),
          },
        ]}
        data={packages.data?.items ?? []}
        emptyDescription={packages.error || "No packages have been configured yet."}
        loading={packages.loading}
      />
    </div>
  );
}
