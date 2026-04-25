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
import { NumberInput, TextInput } from "@/components/ui/form-input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface ProductsResponse {
  items?: Array<{
    id: string;
    name: string;
    annualRate: number;
    minimumAmount: number;
    durationMonths: number;
    status: string;
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function InvestmentsPage() {
  const products = useApi<ProductsResponse | Array<any>>("/investments/products");
  const rows = Array.isArray(products.data) ? products.data : products.data?.items ?? [];
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, reset } = useForm<{
    name: string;
    annualRate: number | undefined;
    minimumAmount: number | undefined;
    durationMonths: number | undefined;
  }>({
    defaultValues: {
      name: "",
      annualRate: undefined,
      minimumAmount: undefined,
      durationMonths: undefined,
    },
  });

  const createProduct = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await api.post("/investments/products", {
        name: values.name,
        annualRate: Number(values.annualRate),
        minimumAmount: Number(values.minimumAmount),
        durationMonths: Number(values.durationMonths),
      });
      showSuccessToast("Investment product created successfully.");
      reset();
      await products.refetch();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to create investment product.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        subtitle="Active investment products available for members, including rate, threshold, and term."
        actions={
          <AdminModal
            description="Create an investment product and publish it to the admin catalog."
            title="Add Investment Product"
            trigger={
              <button
                className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white"
                type="button"
              >
                Add product
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput className="rounded-2xl md:col-span-2" control={control} label="Product Name" name="name" placeholder="Product name" />
              <NumberInput className="rounded-2xl" control={control} label="Rate %" name="annualRate" placeholder="Rate %" min={0} />
              <NumberInput className="rounded-2xl" control={control} label="Minimum Amount" name="minimumAmount" placeholder="Minimum amount" min={0} />
              <NumberInput className="rounded-2xl md:col-span-2" control={control} label="Duration Months" name="durationMonths" placeholder="Duration months" min={1} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white" isDisabled={submitting} onPress={() => void createProduct()}>
                {submitting ? "Saving..." : "Save product"}
              </Button>
            </div>
          </AdminModal>
        }
      />
      <DataTable
        columns={[
          {
            key: "name",
            header: "Product",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.name}</span>,
          },
          {
            key: "rate",
            header: "Annual Rate",
            render: (item) => `${item.annualRate}%`,
          },
          {
            key: "minimum",
            header: "Minimum",
            render: (item) => currency.format(item.minimumAmount),
          },
          {
            key: "duration",
            header: "Duration",
            render: (item) => `${item.durationMonths} months`,
          },
          {
            key: "status",
            header: "Status",
            render: (item) => <StatusBadge status={item.status} variant={item.status === "ACTIVE" ? "success" : "warning"} />,
          },
          {
            key: "detail",
            header: "Detail",
            render: (item) => (
              <Link className="font-semibold text-[var(--color-green)]" href={`/admin/investments/${item.id}`}>
                Open detail
              </Link>
            ),
          },
        ]}
        data={rows}
        emptyDescription={products.error || "No investment products found."}
        loading={products.loading}
      />
    </div>
  );
}
