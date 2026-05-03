"use client";

import Image from "next/image";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { AdminModal } from "@/components/ui/admin-modal";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface PaymentsResponse {
  items: Array<{
    id: string;
    amount: number;
    status: string;
    receiptUrl: string;
    createdAt: string;
    member: { fullName: string };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function PaymentsPage() {
  const payments = useApi<PaymentsResponse>("/payments");

  async function approve(id: string) {
    try {
      await api.patch(`/payments/${id}/approve`);
      showSuccessToast("Payment approved successfully.");
      await payments.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to approve payment.",
      );
      throw error;
    }
  }

  async function reject(id: string) {
    try {
      await api.patch(`/payments/${id}/reject`, {
        reason: "Verification failed",
      });
      showSuccessToast("Payment rejected successfully.");
      await payments.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to reject payment.",
      );
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Review uploaded transfer receipts and verification status before wallet credit is applied."
      />
      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (item) => (
              <span className="font-semibold text-text-900">
                {item.member.fullName}
              </span>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            render: (item) => currency.format(item.amount),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={
                  item.status === "APPROVED"
                    ? "success"
                    : item.status === "REJECTED"
                      ? "danger"
                      : "warning"
                }
              />
            ),
          },
          {
            key: "createdAt",
            header: "Requested At",
            render: (item) => new Date(item.createdAt).toLocaleString("en-NG"),
          },
          {
            key: "receipt",
            header: "Receipt",
            render: (item) =>
              item.receiptUrl ? (
                <AdminModal
                  title="Payment Proof"
                  trigger={
                    <button
                      className="font-semibold text-[var(--primary-700)]"
                      type="button"
                    >
                      View proof
                    </button>
                  }
                >
                  <div className="overflow-hidden rounded-[1.5rem] bg-[rgba(245,240,232,0.7)] p-3">
                    <Image
                      alt="Payment proof"
                      className="h-auto w-full rounded-[1rem] object-contain"
                      height={900}
                      src={item.receiptUrl}
                      unoptimized
                      width={900}
                    />
                  </div>
                </AdminModal>
              ) : (
                "Not uploaded"
              ),
          },
          {
            key: "actions",
            header: "Actions",
            render: (item) =>
              item.status === "PENDING" ? (
                <div className="flex gap-2">
                  <ConfirmActionButton
                    confirmMessage="Approve this payment proof and credit the member wallet."
                    confirmTitle="Approve payment?"
                    label="Approve"
                    onConfirm={() => approve(item.id)}
                    pendingLabel="Approving..."
                    tone="success"
                  />
                  <ConfirmActionButton
                    confirmMessage="Reject this payment proof and keep the wallet balance unchanged."
                    confirmTitle="Reject payment?"
                    label="Reject"
                    onConfirm={() => reject(item.id)}
                    pendingLabel="Rejecting..."
                    tone="danger"
                  />
                </div>
              ) : (
                <span className="text-xs text-text-400">
                  No actions available
                </span>
              ),
          },
        ]}
        data={payments.data?.items ?? []}
        emptyDescription={
          payments.error || "No payment verifications are waiting."
        }
        loading={payments.loading}
      />
    </div>
  );
}
