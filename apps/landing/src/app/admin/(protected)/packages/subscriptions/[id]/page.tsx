"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { NumberInput } from "@/components/ui/form-input";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import api from "@/lib/api";

interface PackageSubscriptionDetail {
  id: string;
  status: string;
  amountPaid: number;
  amountRemaining: number;
  penaltyAccrued: number;
  subscribedAmount: number;
  progress: number;
  createdAt: string;
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
  if (["APPROVED", "COMPLETED", "ACTIVE"].includes(value)) return "success";
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

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] border border-[var(--primary-900)/8] bg-white p-5">
          <p className="text-sm text-text-400">Subscribed amount</p>
          <p className="mt-2 text-xl font-semibold text-text-900">
            {currency.format(detail.data?.subscribedAmount ?? 0)}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--primary-900)/8] bg-white p-5">
          <p className="text-sm text-text-400">Amount paid</p>
          <p className="mt-2 text-xl font-semibold text-text-900">
            {currency.format(detail.data?.amountPaid ?? 0)}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--primary-900)/8] bg-white p-5">
          <p className="text-sm text-text-400">Remaining</p>
          <p className="mt-2 text-xl font-semibold text-text-900">
            {currency.format(detail.data?.amountRemaining ?? 0)}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--primary-900)/8] bg-white p-5">
          <p className="text-sm text-text-400">Penalty accrued</p>
          <p className="mt-2 text-xl font-semibold text-text-900">
            {currency.format(detail.data?.penaltyAccrued ?? 0)}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <p className="text-sm text-text-400">Member</p>
            <p className="mt-2 text-2xl font-semibold text-text-900">
              {detail.data?.member.fullName || "-"}
            </p>
            <p className="mt-1 text-sm">
              {detail.data?.member.membershipNumber || ""}
            </p>
            <p className="mt-3 text-sm text-text-400">Wallet balance</p>
            <p className="mt-1 text-lg font-semibold text-text-900">
              {currency.format(
                detail.data?.member.wallet?.availableBalance ?? 0,
              )}
            </p>
            <div className="mt-4">
              <StatusBadge
                status={detail.data?.status || "UNKNOWN"}
                variant={getStatusVariant(detail.data?.status || "UNKNOWN") as any}
              />
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <h2 className="text-xl font-semibold text-text-900">Activity log</h2>
            <div className="mt-4 space-y-3">
              {(detail.data?.activityLog ?? []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4"
                >
                  <p className="font-semibold text-text-900">
                    {item.action.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-text-400">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-text-400">Repayment progress</span>
              <span className="font-semibold text-text-900">
                {Math.round(detail.data?.progress ?? 0)}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-[var(--primary-900)/8]">
              <div
                className="h-3 rounded-full bg-[var(--primary-700)] transition-all"
                style={{ width: `${detail.data?.progress ?? 0}%` }}
              />
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <h2 className="text-xl font-semibold text-text-900">
              Package transactions
            </h2>
            <div className="mt-4 space-y-3">
              {(detail.data?.relatedTransactions ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-[1.25rem] bg-[var(--background-50)/72] p-4"
                >
                  <div>
                    <p className="font-semibold text-text-900">{item.type}</p>
                    <p className="mt-1 text-xs text-text-400">
                      {item.reference || "Package activity"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-text-900">
                      {currency.format(item.amount)}
                    </p>
                    <p className="mt-1 text-xs text-text-400">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
