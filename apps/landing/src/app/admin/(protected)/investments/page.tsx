"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { AdminModal } from "@/components/ui/admin-modal";
import { NumberInput, TextInput } from "@/components/ui/form-input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { Banknote, TrendingDown, TrendingUp, Users } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";

interface ProductsResponse {
  items?: Array<{
    id: string;
    name: string;
    annualRate: number;
    minimumAmount: number;
    durationMonths: number;
    status: string;
    maximumAmount?: number | null;
    subscriberCount?: number;
    amountSubscribed?: number;
    withdrawalCount?: number;
  }>;
}

type ProductRow = NonNullable<ProductsResponse["items"]>[number];

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function InvestmentsPage() {
  const editModalRef = useRef<HTMLButtonElement | null>(null);
  const products = useApi<ProductsResponse | Array<any>>(
    "/investments/products",
  );
  const rows = Array.isArray(products.data)
    ? products.data
    : (products.data?.items ?? []);
  const totalSubscribers = rows.reduce(
    (sum, item) => sum + Number(item.subscriberCount ?? 0),
    0,
  );
  const totalSubscribed = rows.reduce(
    (sum, item) => sum + Number(item.amountSubscribed ?? 0),
    0,
  );
  const totalWithdrawals = rows.reduce(
    (sum, item) => sum + Number(item.withdrawalCount ?? 0),
    0,
  );
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const { control, handleSubmit, reset } = useForm<{
    name: string;
    annualRate: number | undefined;
    minimumAmount: number | undefined;
    maximumAmount: number | undefined;
    durationMonths: number | undefined;
  }>({
    defaultValues: {
      name: "",
      annualRate: undefined,
      minimumAmount: undefined,
      maximumAmount: undefined,
      durationMonths: undefined,
    },
  });

  const createProduct = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      const endpoint = editingProduct
        ? `/investments/products/${editingProduct.id}`
        : "/investments/products";
      const method = editingProduct ? api.patch : api.post;
      await method(endpoint, {
        name: values.name,
        annualRate: Number(values.annualRate),
        minimumAmount: Number(values.minimumAmount),
        maximumAmount:
          values.maximumAmount === undefined
            ? undefined
            : Number(values.maximumAmount),
        durationMonths: Number(values.durationMonths),
      });
      showSuccessToast(
        editingProduct
          ? "Investment product updated successfully."
          : "Investment product created successfully.",
      );
      reset();
      setEditingProduct(null);
      await products.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message ||
          "Unable to create investment product.",
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        subtitle="Manage investment products, subscribers, and product-level withdrawal requests."
        actions={
          <AdminModal
            description="Create an investment product and publish it to the admin catalog."
            title="Add Investment Product"
            trigger={
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white"
                onClick={() => {
                  setEditingProduct(null);
                  reset({
                    name: "",
                    annualRate: undefined,
                    minimumAmount: undefined,
                    maximumAmount: undefined,
                    durationMonths: undefined,
                  });
                }}
                type="button"
              >
                Add product
              </button>
            }
          >
            {({ close }) => (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput
                    className="rounded-2xl md:col-span-2"
                    control={control}
                    label="Product Name"
                    name="name"
                    placeholder="Product name"
                  />
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Rate %"
                    name="annualRate"
                    placeholder="Rate %"
                    min={0}
                  />
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Minimum Amount"
                    name="minimumAmount"
                    placeholder="Minimum amount"
                    min={0}
                  />
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Maximum Amount"
                    name="maximumAmount"
                    placeholder="Maximum amount"
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
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                    disabled={submitting}
                    onClick={() =>
                      void handleSubmit(async (values) => {
                        try {
                          setSubmitting(true);
                          await api.post("/investments/products", {
                            name: values.name,
                            annualRate: Number(values.annualRate),
                            minimumAmount: Number(values.minimumAmount),
                            durationMonths: Number(values.durationMonths),
                          });
                          showSuccessToast(
                            "Investment product created successfully.",
                          );
                          reset();
                          await products.refetch();
                          close();
                        } catch (error: any) {
                          showErrorToast(
                            error?.response?.data?.message ||
                              "Unable to create investment product.",
                          );
                        } finally {
                          setSubmitting(false);
                        }
                      })()
                    }
                    type="button"
                  >
                    {submitting ? "Saving..." : "Save product"}
                  </button>
                </div>
              </>
            )}
          </AdminModal>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Investment products available in the admin catalog."
          href="/admin/investments"
          icon={<TrendingUp className="h-5 w-5" />}
          title="Products"
          tone="green"
          value={rows.length}
        />
        <DashboardMetricCard
          description="Members currently subscribed across active products."
          href="/admin/investments"
          icon={<Users className="h-5 w-5" />}
          title="Subscribers"
          value={totalSubscribers}
        />
        <DashboardMetricCard
          description="Total principal subscribed across products."
          href="/admin/investments"
          icon={<Banknote className="h-5 w-5" />}
          title="Amount Subscribed"
          value={currency.format(totalSubscribed)}
        />
        <DashboardMetricCard
          description="Cancellation or withdrawal requests across products."
          href="/admin/investments"
          icon={<TrendingDown className="h-5 w-5" />}
          title="Withdrawals"
          tone={totalWithdrawals > 0 ? "red" : "neutral"}
          value={totalWithdrawals}
        />
      </div>

      <AdminModal
        description="Update the investment product configuration."
        title="Edit Investment Product"
        trigger={
          <button className="hidden" ref={editModalRef} type="button">
            Edit product
          </button>
        }
      >
        {({ close }) => (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                className="rounded-2xl md:col-span-2"
                control={control}
                label="Product Name"
                name="name"
                placeholder="Product name"
              />
              <NumberInput
                className="rounded-2xl"
                control={control}
                label="Rate %"
                name="annualRate"
                placeholder="Rate %"
                min={0}
              />
              <NumberInput
                className="rounded-2xl"
                control={control}
                label="Minimum Amount"
                name="minimumAmount"
                placeholder="Minimum amount"
                min={0}
              />
              <NumberInput
                className="rounded-2xl"
                control={control}
                label="Maximum Amount"
                name="maximumAmount"
                placeholder="Maximum amount"
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
            </div>
            <div className="mt-6 flex justify-end">
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                disabled={submitting}
                onClick={async () => {
                  await createProduct();
                  close();
                }}
                type="button"
              >
                {submitting ? "Saving..." : "Save changes"}
              </button>
            </div>
          </>
        )}
      </AdminModal>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Product",
            render: (item) => (
              <span className="font-semibold text-text-900">{item.name}</span>
            ),
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
            key: "subscribers",
            header: "Subscribers",
            render: (item) => (
              <span className="font-semibold text-text-900 dark:text-text-50">
                {item.subscriberCount ?? 0}
              </span>
            ),
            sortValue: (item) => item.subscriberCount ?? 0,
          },
          {
            key: "amountSubscribed",
            header: "Amount Subscribed",
            render: (item) => currency.format(item.amountSubscribed ?? 0),
            sortValue: (item) => item.amountSubscribed ?? 0,
          },
          {
            key: "withdrawals",
            header: "Withdrawals",
            render: (item) => (
              <span
                className={`font-semibold ${
                  (item.withdrawalCount ?? 0) > 0
                    ? "text-[#b42318]"
                    : "text-text-500"
                }`}
              >
                {item.withdrawalCount ?? 0}
              </span>
            ),
            sortValue: (item) => item.withdrawalCount ?? 0,
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={item.status === "ACTIVE" ? "success" : "warning"}
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
                    label: "View details",
                    onSelect: () => {
                      window.location.href = `/admin/investments/${item.id}`;
                    },
                  },
                  {
                    label: "Edit",
                    onSelect: () => {
                      setEditingProduct(item);
                      reset({
                        name: item.name,
                        annualRate: item.annualRate,
                        minimumAmount: item.minimumAmount,
                        maximumAmount: item.maximumAmount ?? undefined,
                        durationMonths: item.durationMonths,
                      });
                      editModalRef.current?.click();
                    },
                  },
                  {
                    label: "Delete",
                    tone: "danger",
                    confirmTitle: "Delete investment product?",
                    confirmMessage:
                      "This will remove the product from the admin catalog.",
                    onSelect: async () => {
                      try {
                        await api.delete(`/investments/products/${item.id}`);
                        showSuccessToast(
                          "Investment product deleted successfully.",
                        );
                        await products.refetch();
                      } catch (error: any) {
                        showErrorToast(
                          error?.response?.data?.message ||
                            "Unable to delete investment product.",
                        );
                      }
                    },
                  },
                ]}
              />
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
