"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { useApi } from "@/hooks/useApi";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { NumberInput } from "@/components/ui/form-input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import api from "@/lib/api";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import {
  Banknote,
  Calendar,
  Clock3,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

interface PackageSubscriptionDetail {
  id: string;
  status: string;
  amountPaid: number;
  amountRemaining: number;
  penaltyAccrued: number;
  subscribedAmount: number;
  progress: number;
  createdAt: string;
  approvedAt?: string | null;
  disbursedAt?: string | null;
  completedAt?: string | null;
  nextDueAt?: string | null;
  member: {
    fullName: string;
    membershipNumber: string;
    wallet?: {
      availableBalance: number;
      pendingBalance: number;
    } | null;
  };
  package: {
    name: string;
    isActive?: boolean;
  };
  relatedTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    createdAt: string;
  }>;
  activityLog: Array<{
    id: string;
    action: string;
    createdAt: string;
  }>;
  timeline?: Array<{
    label: string;
    date?: string | null;
    status: string;
    amount?: number;
    reference?: string | null;
  }>;
  paymentSchedule?: Array<{
    installment: number;
    dueDate: string;
    amount: number;
    status: string;
  }>;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getStatusVariant(status: string) {
  const value = status.toUpperCase();
  if (["APPROVED", "COMPLETED", "ACTIVE", "SUCCESSFUL"].includes(value)) return "success";
  if (["REJECTED", "OVERDUE", "DEFAULTING"].includes(value)) return "danger";
  if (["DISBURSED", "IN_PROGRESS"].includes(value)) return "info";
  if (value === "PENDING") return "warning";
  return "neutral";
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function AdminPackageSubscriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useApi<PackageSubscriptionDetail>(
    `/packages/subscriptions/${params.id}`,
  );
  const { control, handleSubmit, reset } = useForm<{
    amount: number | undefined;
  }>({
    defaultValues: { amount: undefined },
  });

  const processPayment = handleSubmit(async (values) => {
    try {
      await api.post(`/packages/subscriptions/${params.id}/allocate`, {
        amount: Number(values.amount),
      });
      showSuccessToast("Package repayment processed successfully.");
      reset({ amount: undefined });
      await detail.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message ||
          "Unable to process package repayment.",
      );
    }
  });

  const canPayPackage = Boolean(
    detail.data &&
      detail.data.package?.isActive !== false &&
      ["APPROVED", "DISBURSED", "IN_PROGRESS"].includes(detail.data.status),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.data?.package.name || "Package subscription detail"}
        subtitle="Monitor repayments, wallet balance, activity, and package transaction history."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {detail.data?.status === "PENDING" ? (
              <>
                <ConfirmActionButton
                  confirmTitle="Approve package subscription?"
                  confirmMessage="This will move the subscription into the approved stage."
                  label="Accept"
                  onConfirm={async () => {
                    try {
                      await api.post(`/packages/subscriptions/${params.id}/approve`);
                      showSuccessToast("Package subscription approved.");
                      await detail.refetch();
                    } catch (error: any) {
                      showErrorToast(
                        error?.response?.data?.message ||
                          "Unable to approve subscription.",
                      );
                    }
                  }}
                  tone="success"
                />
                <ConfirmActionButton
                  confirmTitle="Reject package subscription?"
                  confirmMessage="This subscription will be rejected and removed from the active workflow."
                  label="Reject"
                  onConfirm={async () => {
                    try {
                      await api.post(`/packages/subscriptions/${params.id}/reject`);
                      showSuccessToast("Package subscription rejected.");
                      await detail.refetch();
                    } catch (error: any) {
                      showErrorToast(
                        error?.response?.data?.message ||
                          "Unable to reject subscription.",
                      );
                    }
                  }}
                  tone="danger"
                />
              </>
            ) : null}
            {canPayPackage ? (
              <AdminModal
                description="Enter the repayment amount to deduct from the member's wallet."
                title="Pay Package"
                trigger={
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white"
                    type="button"
                  >
                    Pay Package
                  </button>
                }
              >
                {({ close }) => (
                  <>
                    <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                      <p className="text-sm text-text-400">
                        Current wallet balance
                      </p>
                      <p className="mt-1 text-lg font-semibold text-text-900">
                        {currency.format(
                          detail.data?.member.wallet?.availableBalance ?? 0,
                        )}
                      </p>
                    </div>
                    <div className="mt-4">
                      <NumberInput
                        control={control}
                        label="Repayment Amount"
                        name="amount"
                        placeholder="Enter repayment amount"
                        min={1}
                      />
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white"
                        onClick={async () => {
                          await processPayment();
                          close();
                        }}
                        type="button"
                      >
                        Process repayment
                      </button>
                    </div>
                  </>
                )}
              </AdminModal>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Original package amount assigned to this member."
          href={`/admin/packages/subscriptions/${params.id}`}
          icon={<Banknote className="h-5 w-5" />}
          title="Subscribed Amount"
          tone="green"
          value={currency.format(detail.data?.subscribedAmount ?? 0)}
        />
        <DashboardMetricCard
          description="Total successful repayments already posted."
          href={`/admin/packages/subscriptions/${params.id}`}
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Paid So Far"
          value={currency.format(detail.data?.amountPaid ?? 0)}
        />
        <DashboardMetricCard
          description="Outstanding package balance still expected."
          href={`/admin/packages/subscriptions/${params.id}`}
          icon={<WalletCards className="h-5 w-5" />}
          title="Remaining"
          tone={(detail.data?.amountRemaining ?? 0) > 0 ? "amber" : "neutral"}
          value={currency.format(detail.data?.amountRemaining ?? 0)}
        />
        <DashboardMetricCard
          description="Next repayment date or accrued penalty to monitor."
          href={`/admin/packages/subscriptions/${params.id}`}
          icon={<Clock3 className="h-5 w-5" />}
          title="Penalty Accrued"
          tone={(detail.data?.penaltyAccrued ?? 0) > 0 ? "red" : "neutral"}
          value={currency.format(detail.data?.penaltyAccrued ?? 0)}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-text-400">Member</p>
                <h2 className="mt-1 text-xl font-semibold text-text-900 dark:text-text-50">
                  {detail.data?.member.fullName || "-"}
                </h2>
                <p className="mt-1 text-sm text-text-400">
                  {detail.data?.member.membershipNumber || ""}
                </p>
              </div>
              <StatusBadge
                status={detail.data?.status || "UNKNOWN"}
                variant={getStatusVariant(detail.data?.status || "UNKNOWN") as any}
              />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-text-400">Repayment progress</span>
                  <span className="font-semibold text-text-900 dark:text-text-50">
                    {Math.round(detail.data?.progress ?? 0)}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[color-mix(in_oklab,var(--primary-900)_8%,transparent)] dark:bg-[var(--background-800)]">
                  <div
                    className="h-3 rounded-full bg-[var(--primary-700)] transition-all"
                    style={{ width: `${detail.data?.progress ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                    Repayment Time
                  </p>
                  <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                    {formatDateTime(detail.data?.nextDueAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                    Wallet Balance
                  </p>
                  <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                    {currency.format(
                      detail.data?.member.wallet?.availableBalance ?? 0,
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]">
                <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                  Package
                </p>
                <p className="mt-2 text-sm text-text-400">
                  {detail.data?.package.name || "-"}
                </p>
                <p className="mt-1 text-sm text-text-400">
                  Created {formatDateTime(detail.data?.createdAt)}
                </p>
              </div>
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
            <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
              Package Timeline
            </h2>
            <div className="mt-5">
              {(detail.data?.timeline ?? []).length ? (
                <ol className="relative space-y-4 before:absolute before:bottom-0 before:left-5 before:top-0 before:w-px before:bg-primary-900/10 dark:before:bg-[var(--background-700)]">
                  {(detail.data?.timeline ?? []).map((item, index) => (
                    <li className="relative flex gap-4" key={`${item.label}-${index}`}>
                      <span className="relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-900/10 bg-white dark:border-[var(--background-700)] dark:bg-[var(--background-900)]">
                        <Calendar className="h-4 w-4 text-[var(--primary-700)]" />
                      </span>
                      <div className="min-w-0 flex-1 rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-text-900 dark:text-text-50">
                              {item.label}
                            </p>
                            <p className="mt-1 text-sm text-text-400">
                              {formatDateTime(item.date)}
                            </p>
                          </div>
                          <StatusBadge
                            status={item.status}
                            variant={getStatusVariant(item.status) as any}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm text-text-500 dark:text-text-300">
                          {typeof item.amount === "number" ? (
                            <span>{currency.format(item.amount)}</span>
                          ) : null}
                          {item.reference ? <span>{item.reference}</span> : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-2xl border border-dashed border-primary-900/12 p-5 text-sm text-text-400 dark:border-[var(--background-700)]">
                  No timeline records found for this package subscription.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
            <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
              Repayment History
            </h2>
            <div className="mt-4 space-y-3">
              {(detail.data?.relatedTransactions ?? []).length ? (
                detail.data?.relatedTransactions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]"
                  >
                    <div>
                      <p className="font-semibold text-text-900 dark:text-text-50">
                        {item.type.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs text-text-400">
                        {item.reference || "Package repayment"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-text-900 dark:text-text-50">
                        {currency.format(item.amount)}
                      </p>
                      <p className="mt-1 text-xs text-text-400">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-primary-900/12 p-5 text-sm text-text-400 dark:border-[var(--background-700)]">
                  No repayments have been posted yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
            <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
              Installment Schedule
            </h2>
            <div className="mt-4">
              <DataTable
                columns={[
                  {
                    key: "installment",
                    header: "Installment",
                    render: (item) => `Installment ${item.installment}`,
                    sortValue: (item) => item.installment,
                  },
                  {
                    key: "dueDate",
                    header: "Due Date",
                    render: (item) =>
                      new Date(item.dueDate).toLocaleDateString("en-NG"),
                    sortValue: (item) => new Date(item.dueDate),
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    render: (item) => currency.format(item.amount),
                    sortValue: (item) => item.amount,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (item) => (
                      <StatusBadge
                        status={item.status}
                        variant={getStatusVariant(item.status) as any}
                      />
                    ),
                    sortValue: (item) => item.status,
                  },
                ]}
                data={detail.data?.paymentSchedule ?? []}
                emptyDescription="No installment schedule found for this package."
                getRowKey={(item) => String(item.installment)}
                searchPlaceholder="Search installments..."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
