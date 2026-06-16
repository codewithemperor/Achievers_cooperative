"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { parseDate } from "@internationalized/date";
import { useForm, useWatch } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import {
  AutocompleteInput,
  DateRangePicker,
  NumberInput,
} from "@/components/ui/form-input";
import type { DateRange } from "@/components/ui/form-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { AdminModal } from "@/components/ui/admin-modal";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { TransactionReceiptModal } from "@/components/admin/transaction-receipt-modal";
import { useApi } from "@/hooks/useApi";
import api, { uploadAdminImage } from "@/lib/api";
import { getCurrentMonthRange, isWithinDateRange } from "@/lib/date-range";
import { ActionMenu } from "@/components/ui/action-menu";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { CheckCircle2, Clock3, Plus, Receipt, XCircle } from "lucide-react";

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
    debtSettlementAmount?: number | null;
    walletCreditAmount?: number | null;
    approvalReference?: string | null;
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

interface MemberSearchResponse {
  items: Array<{
    id: string;
    fullName: string;
    membershipNumber: string;
    email: string;
    phoneNumber: string;
  }>;
}

interface AdminPaymentFormValues {
  memberId: string;
  amount: number | undefined;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function PaymentsPage() {
  const payments = useApi<PaymentsResponse>("/payments");
  const transactions = useApi<MemberTransactionsResponse>("/transactions");
  const members = useApi<MemberSearchResponse>("/members/search");
  const currentMonthRange = useMemo(() => getCurrentMonthRange(), []);
  const { control: filtersControl } = useForm<TransactionFiltersForm>({
    defaultValues: {
      transactionDateRange: {
        start: parseDate(currentMonthRange.from),
        end: parseDate(currentMonthRange.to),
      },
    },
  });
  const {
    control: adminPaymentControl,
    handleSubmit: handleAdminPaymentSubmit,
    reset: resetAdminPayment,
  } = useForm<AdminPaymentFormValues>({
    defaultValues: { memberId: "", amount: undefined },
  });
  const selectedDateRange = useWatch({
    control: filtersControl,
    name: "transactionDateRange",
  });
  const startDate =
    selectedDateRange?.start?.toString() ?? currentMonthRange.from;
  const endDate = selectedDateRange?.end?.toString() ?? currentMonthRange.to;
  const [tab, setTab] = useState<"requests" | "transactions">("requests");
  const [adminReceiptUrl, setAdminReceiptUrl] = useState("");
  const [uploadingAdminReceipt, setUploadingAdminReceipt] = useState(false);
  const [submittingAdminPayment, setSubmittingAdminPayment] = useState(false);
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
  const memberRows = members.data?.items ?? [];
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

  async function uploadAdminReceipt(file: File | null) {
    if (!file) return;

    try {
      setUploadingAdminReceipt(true);
      const upload = await uploadAdminImage(file, "payment-receipt");
      setAdminReceiptUrl(upload.url);
      showSuccessToast("Receipt uploaded successfully.");
    } catch (error: any) {
      showErrorToast(error?.message || "Unable to upload receipt.");
      throw error;
    } finally {
      setUploadingAdminReceipt(false);
    }
  }

  const addAdminPayment = handleAdminPaymentSubmit(async (values) => {
    try {
      if (!values.memberId) {
        throw new Error("Choose a member before adding payment.");
      }
      if (!values.amount || Number(values.amount) <= 0) {
        throw new Error("Enter a valid payment amount.");
      }
      if (!adminReceiptUrl) {
        throw new Error("Upload a receipt before adding payment.");
      }

      setSubmittingAdminPayment(true);
      await api.post("/payments/admin-fund", {
        memberId: values.memberId,
        amount: Number(values.amount),
        receiptUrl: adminReceiptUrl,
      });
      showSuccessToast("Payment added and approved successfully.");
      resetAdminPayment({ memberId: "", amount: undefined });
      setAdminReceiptUrl("");
      await Promise.all([payments.refetch(), transactions.refetch()]);
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to add payment.",
      );
      throw error;
    } finally {
      setSubmittingAdminPayment(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Review uploaded transfer receipts and verification status before wallet credit is applied."
        actions={
          <AdminModal
            description="Choose a member, upload the transfer receipt, and credit the wallet immediately."
            title="Add Payment"
            trigger={
              <button
                className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                onClick={() => {
                  resetAdminPayment({ memberId: "", amount: undefined });
                  setAdminReceiptUrl("");
                }}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add payment
              </button>
            }
          >
            {({ close }) => (
              <>
                <div className="grid gap-4">
                  <AutocompleteInput
                    control={adminPaymentControl}
                    emptyLabel="No members found"
                    label="Member"
                    name="memberId"
                    options={memberRows.map((member) => ({
                      id: member.id,
                      label: member.fullName,
                      description: `${member.membershipNumber} - ${member.phoneNumber}`,
                      searchText: `${member.fullName} ${member.membershipNumber} ${member.phoneNumber} ${member.email}`,
                    }))}
                    placeholder="Search member..."
                  />

                  <NumberInput
                    control={adminPaymentControl}
                    formatOptions={{
                      style: "currency",
                      currency: "NGN",
                      minimumFractionDigits: 2,
  maximumFractionDigits: 2,
                    }}
                    isRequired
                    label="Amount"
                    min={1}
                    name="amount"
                    placeholder="Enter amount"
                  />

                  <div className="grid gap-2">
                    <label
                      className="text-sm font-medium text-text-900"
                      htmlFor="admin-payment-receipt"
                    >
                      Payment receipt
                    </label>
                    <input
                      accept="image/*"
                      className="block w-full rounded-2xl border border-[var(--primary-900)/12] px-4 py-3 text-sm"
                      id="admin-payment-receipt"
                      onChange={(event) =>
                        void uploadAdminReceipt(event.target.files?.[0] ?? null)
                      }
                      type="file"
                    />
                    {adminReceiptUrl ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        Receipt uploaded successfully.
                      </div>
                    ) : (
                      <p className="text-xs text-text-400">
                        Upload the receipt image attached to this payment.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                    disabled={uploadingAdminReceipt || submittingAdminPayment}
                    onClick={async () => {
                      try {
                        await addAdminPayment();
                        close();
                      } catch {}
                    }}
                    type="button"
                  >
                    {uploadingAdminReceipt
                      ? "Uploading..."
                      : submittingAdminPayment
                        ? "Adding..."
                        : "Add payment"}
                  </button>
                </div>
              </>
            )}
          </AdminModal>
        }
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
                    label: "Debt recovered",
                    value:
                      typeof item.debtSettlementAmount === "number"
                        ? currency.format(item.debtSettlementAmount)
                        : "-",
                  },
                  {
                    label: "Wallet credited",
                    value:
                      typeof item.walletCreditAmount === "number"
                        ? currency.format(item.walletCreditAmount)
                        : "-",
                  },
                  {
                    label: "Approval reference",
                    value: item.approvalReference || "-",
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
