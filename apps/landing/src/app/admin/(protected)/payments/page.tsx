"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { parseDate } from "@internationalized/date";
import { useForm, useWatch } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/form-input";
import type { DateRange } from "@/components/ui/form-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { TransactionReceiptModal } from "@/components/admin/transaction-receipt-modal";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { getCurrentMonthRange, isWithinDateRange } from "@/lib/date-range";
import { ActionMenu } from "@/components/ui/action-menu";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { CheckCircle2, Clock3, Receipt, XCircle } from "lucide-react";

interface PaymentsResponse {
  items: Array<{
    id: string;
    amount: number;
    status: string;
    receiptUrl: string;
    createdAt: string;
    verifiedAt?: string | null;
    rejectionReason?: string | null;
    netCreditAmount?: number | null;
    member: { fullName: string; membershipNumber?: string };
  }>;
}

interface MemberTransactionsResponse {
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    description?: string | null;
    createdAt: string;
    wallet?: {
      member?: {
        fullName: string;
        membershipNumber: string;
      };
    };
  }>;
}

interface TransactionFiltersForm {
  transactionDateRange: DateRange;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function PaymentsPage() {
  const payments = useApi<PaymentsResponse>("/payments");
  const transactions = useApi<MemberTransactionsResponse>("/transactions");
  const currentMonthRange = useMemo(() => getCurrentMonthRange(), []);
  const { control: filtersControl } = useForm<TransactionFiltersForm>({
    defaultValues: {
      transactionDateRange: {
        start: parseDate(currentMonthRange.from),
        end: parseDate(currentMonthRange.to),
      },
    },
  });
  const selectedDateRange = useWatch({
    control: filtersControl,
    name: "transactionDateRange",
  });
  const startDate =
    selectedDateRange?.start?.toString() ?? currentMonthRange.from;
  const endDate = selectedDateRange?.end?.toString() ?? currentMonthRange.to;
  const [tab, setTab] = useState<"requests" | "transactions">("requests");
  const [selectedProof, setSelectedProof] =
    useState<PaymentsResponse["items"][number] | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    title: string;
    amount: number;
    date?: string | null;
    status: string;
    reference?: string | null;
    fields: Array<{ label: string; value?: string | number | null }>;
    timeline?: Array<{ label: string; date?: string | null; status?: string }>;
  } | null>(null);

  const paymentRows = payments.data?.items ?? [];
  const pendingPayments = paymentRows.filter((item) => item.status === "PENDING");
  const processedPayments = paymentRows.filter((item) => item.status !== "PENDING");
  const visibleProcessedPayments = processedPayments.filter((item) =>
    isWithinDateRange(item.createdAt, startDate, endDate),
  );
  const approvedPayments = paymentRows.filter((item) => item.status === "APPROVED");
  const rejectedPayments = paymentRows.filter((item) => item.status === "REJECTED");
  const pendingAmount = pendingPayments.reduce(
    (sum, item) => sum + Number(item.amount ?? 0),
    0,
  );
  const dateRangeToolbar = (
    <DateRangePicker
      className="w-full"
      control={filtersControl}
      label=""
      name="transactionDateRange"
    />
  );

  async function approve(id: string) {
    try {
      await api.patch(`/payments/${id}/approve`);
      showSuccessToast("Payment approved successfully.");
      await Promise.all([payments.refetch(), transactions.refetch()]);
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
      await Promise.all([payments.refetch(), transactions.refetch()]);
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Payment proofs waiting for review."
          href="/admin/payments"
          icon={<Clock3 className="h-5 w-5" />}
          title="Pending Requests"
          tone={pendingPayments.length ? "amber" : "neutral"}
          value={pendingPayments.length}
        />
        <DashboardMetricCard
          description="Total value waiting for approval."
          href="/admin/payments"
          icon={<Receipt className="h-5 w-5" />}
          title="Pending Amount"
          tone="green"
          value={currency.format(pendingAmount)}
        />
        <DashboardMetricCard
          description="Receipts accepted and credited."
          href="/admin/payments"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Approved Payments"
          value={approvedPayments.length}
        />
        <DashboardMetricCard
          description="Rejected payment proofs."
          href="/admin/payments"
          icon={<XCircle className="h-5 w-5" />}
          title="Rejected Payments"
          tone={rejectedPayments.length ? "red" : "neutral"}
          value={rejectedPayments.length}
        />
      </div>

      <AdminTabs
        items={[
          { id: "requests", label: "Requests" },
          { id: "transactions", label: "Transactions" },
        ]}
        meta={`${pendingPayments.length} pending request(s)`}
        onChange={setTab}
        value={tab}
      />

      {tab === "requests" ? (
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-text-900">
                      {item.member.fullName}
                    </p>
                    <p className="text-xs text-text-400">
                      {item.member.membershipNumber || "-"}
                    </p>
                  </div>
                ),
                sortValue: (item) => item.member.fullName,
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
                    variant={
                      item.status === "APPROVED"
                        ? "success"
                        : item.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  />
                ),
                sortValue: (item) => item.status,
              },
              {
                key: "createdAt",
                header: "Requested",
                render: (item) =>
                  new Date(item.createdAt).toLocaleString("en-NG"),
                sortValue: (item) => new Date(item.createdAt),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                isAction: true,
                render: (item) => (
                  <ActionMenu
                    items={[
                      {
                        label: "View proof",
                        isDisabled: !item.receiptUrl,
                        onSelect: () => setSelectedProof(item),
                      },
                      {
                        label: "Approve",
                        tone: "success",
                        isDisabled: item.status !== "PENDING",
                        confirmTitle: "Approve payment?",
                        confirmMessage:
                          "Approve this payment proof and credit the member wallet.",
                        onSelect: () => approve(item.id),
                      },
                      {
                        label: "Reject",
                        tone: "danger",
                        isDisabled: item.status !== "PENDING",
                        confirmTitle: "Reject payment?",
                        confirmMessage:
                          "Reject this payment proof and keep the wallet balance unchanged.",
                        onSelect: () => reject(item.id),
                      },
                    ]}
                  />
                ),
              },
            ]}
            data={pendingPayments}
            emptyDescription={
              payments.error || "No payment verifications are waiting."
            }
            getRowKey={(item) => item.id}
            loading={payments.loading}
            searchableText={(item) =>
              `${item.member.fullName} ${item.member.membershipNumber || ""} ${item.amount} ${item.status}`
            }
            searchPlaceholder="Search payment requests..."
          />
      ) : (
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-text-900">
                      {item.member.fullName}
                    </p>
                    <p className="text-xs text-text-400">
                      {item.member.membershipNumber || "-"}
                    </p>
                  </div>
                ),
                sortValue: (item) => item.member.fullName,
              },
              {
                key: "reference",
                header: "Reference",
                render: (item) => `PAY-${item.id.slice(0, 8)}`,
                sortValue: (item) => item.id,
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
                    variant={
                      item.status === "APPROVED"
                        ? "success"
                        : item.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  />
                ),
                sortValue: (item) => item.status,
              },
              {
                key: "createdAt",
                header: "Date",
                render: (item) =>
                  new Date(item.createdAt).toLocaleString("en-NG"),
                sortValue: (item) => new Date(item.createdAt),
              },
            ]}
            data={visibleProcessedPayments}
            emptyDescription={
              transactions.error || "No payment transactions found."
            }
            getRowKey={(item) => item.id}
            loading={payments.loading || transactions.loading}
            toolbar={dateRangeToolbar}
            onRowClick={(item) =>
              setSelectedReceipt({
                title: "Payment Transaction",
                amount: item.amount,
                date: item.createdAt,
                status: item.status,
                reference: `PAY-${item.id.slice(0, 8)}`,
                fields: [
                  { label: "Member", value: item.member.fullName },
                  {
                    label: "Membership No.",
                    value: item.member.membershipNumber || "-",
                  },
                  { label: "Source", value: "Payment proof" },
                  {
                    label: "Receipt",
                    value: item.receiptUrl || "Not uploaded",
                  },
                  {
                    label: "Net credit",
                    value:
                      typeof item.netCreditAmount === "number"
                        ? currency.format(item.netCreditAmount)
                        : "-",
                  },
                  {
                    label: "Reason",
                    value: item.rejectionReason || "-",
                  },
                ],
                timeline: [
                  { label: "Request submitted", date: item.createdAt, status: "PENDING" },
                  {
                    label:
                      item.status === "REJECTED" ? "Payment rejected" : "Payment approved",
                    date: item.verifiedAt || item.createdAt,
                    status: item.status,
                  },
                ],
              })
            }
            searchableText={(item) =>
              `${item.member.fullName} ${item.member.membershipNumber || ""} ${item.amount} ${item.status}`
            }
            searchPlaceholder="Search payment transactions..."
          />
      )}

      {selectedProof?.receiptUrl ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <button
            aria-label="Close payment proof"
            className="absolute inset-0"
            onClick={() => setSelectedProof(null)}
            type="button"
          />
          <div className="relative z-[101] w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-text-900">
                Payment proof
              </h2>
              <button
                className="rounded-xl border border-primary-900/12 px-3 py-1.5 text-sm font-semibold text-text-900"
                onClick={() => setSelectedProof(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="overflow-hidden rounded-xl bg-background-50 p-3">
              <Image
                alt="Payment proof"
                className="max-h-[75vh] w-full rounded-lg object-contain"
                height={900}
                src={selectedProof.receiptUrl}
                unoptimized
                width={900}
              />
            </div>
          </div>
        </div>
      ) : null}
      {selectedReceipt ? (
        <TransactionReceiptModal
          {...selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      ) : null}
    </div>
  );
}
