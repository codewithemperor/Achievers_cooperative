"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { AdminModal } from "@/components/ui/admin-modal";
import { TextareaInput } from "@/components/ui/form-input";
import { useForm } from "react-hook-form";
import { Building2, ShieldCheck, Calendar } from "lucide-react";

interface BankAccountInfo {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  verifiedAt: string | null;
}

interface LoanDetail {
  id: string;
  amount: number;
  remainingBalance: number;
  amountPaidSoFar: number;
  repaymentProgress: number;
  tenorMonths: number;
  purpose: string;
  status: string;
  dueDate?: string | null;
  submittedAt: string;
  approvedAt?: string | null;
  disbursedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  bankAccount?: BankAccountInfo | null;
  member: { fullName: string; membershipNumber: string; user: { email: string } };
  guarantorOne?: { fullName: string; membershipNumber: string } | null;
  guarantorTwo?: { fullName: string; membershipNumber: string } | null;
  paymentSchedule: Array<{ installment: number; dueDate: string; amount: number; status: string }>;
  timeline: Array<{ label: string; date: string; status: string; amount?: number; reference?: string | null }>;
  relatedTransactions: Array<{ id: string; type: string; amount: number; status: string; reference?: string | null; createdAt: string }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function variantForStatus(status: string) {
  switch (status) {
    case "PENDING": return "warning";
    case "APPROVED": return "info";
    case "DISBURSED": return "info";
    case "IN_PROGRESS": return "success";
    case "COMPLETED": return "success";
    case "OVERDUE": return "danger";
    case "REJECTED": return "danger";
    case "PAID": return "success";
    default: return "neutral";
  }
}

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const loan = useApi<LoanDetail>(`/loans/${params.id}`);
  const [rejecting, setRejecting] = useState(false);
  const { control, handleSubmit, reset } = useForm<{ reason: string }>({
    defaultValues: { reason: "" },
  });

  const status = loan.data?.status;
  const isNewLoan = status === "PENDING";
  const isApprovedLoan = status === "APPROVED";
  const isDisbursedLoan = status === "DISBURSED";

  async function runAction(action: "approve" | "reject" | "disburse" | "markInProgress", reason?: string) {
    try {
      if (action === "reject") {
        await api.patch(`/loans/${params.id}/reject`, { reason: reason || undefined });
        showSuccessToast("Loan rejected successfully.");
      } else if (action === "approve") {
        await api.patch(`/loans/${params.id}/approve`);
        showSuccessToast("Loan approved successfully.");
      } else if (action === "disburse") {
        await api.patch(`/loans/${params.id}/disburse`);
        showSuccessToast("Loan disbursed successfully. Funds will be sent to the member's bank account.");
      } else if (action === "markInProgress") {
        await api.patch(`/loans/${params.id}/mark-in-progress`);
        showSuccessToast("Loan marked as in progress.");
      }
      await loan.refetch();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || `Unable to ${action} loan.`);
      throw error;
    }
  }

  const handleReject = (close?: () => void) => handleSubmit(async (values) => {
    try {
      setRejecting(true);
      await runAction("reject", values.reason);
      reset();
      close?.();
    } catch {
      // Error handled in runAction
    } finally {
      setRejecting(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan detail"
        subtitle="Track approval, disbursement, repayments, and the expected installment schedule for this facility."
        actions={
          <>
            {isNewLoan ? (
              <>
                <ConfirmActionButton
                  confirmMessage="Approve this pending loan request and move it to the disbursement stage."
                  confirmTitle="Approve loan request?"
                  label="Approve"
                  onConfirm={() => runAction("approve")}
                  pendingLabel="Approving..."
                  tone="success"
                />
                <AdminModal
                  description="Provide an optional reason for rejecting this loan request. The member will be notified."
                  title="Reject loan request"
                  trigger={
                    <button
                      className="rounded-full bg-[#b42318] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                      type="button"
                    >
                      Reject
                    </button>
                  }
                >
                  {({ close }) => (
                    <>
                      <TextareaInput
                        control={control}
                        label="Reason (optional)"
                        name="reason"
                        placeholder="Enter rejection reason..."
                        rows={3}
                      />
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          className="rounded-full border border-[var(--primary-900)/12] px-4 py-2 text-sm font-medium text-[var(--text-900)]"
                          onClick={close}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="rounded-full bg-[#b42318] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                          disabled={rejecting}
                          onClick={() => void handleReject(close)()}
                          type="button"
                        >
                          {rejecting ? "Rejecting..." : "Confirm rejection"}
                        </button>
                      </div>
                    </>
                  )}
                </AdminModal>
              </>
            ) : null}
            {isApprovedLoan ? (
              <ConfirmActionButton
                confirmMessage={
                  loan.data?.bankAccount
                    ? `Disburse this approved loan. Funds will be sent to ${loan.data.bankAccount.accountName}'s account at ${loan.data.bankAccount.bankName} (${loan.data.bankAccount.accountNumber}).`
                    : "Disburse this approved loan. A LOAN_DISBURSEMENT transaction record will be created."
                }
                confirmTitle="Disburse approved loan?"
                label="Disburse"
                onConfirm={() => runAction("disburse")}
                pendingLabel="Disbursing..."
                tone="success"
              />
            ) : null}
            {isDisbursedLoan ? (
              <ConfirmActionButton
                confirmMessage="Mark this disbursed loan as in progress. The member can begin repaying from their wallet."
                confirmTitle="Mark as in progress?"
                label="Mark as In Progress"
                onConfirm={() => runAction("markInProgress")}
                pendingLabel="Updating..."
                tone="success"
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <p className="text-sm text-[var(--text-400)]">Member</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-900)]">{loan.data?.member.fullName || "-"}</p>
            <p className="mt-1 text-sm">{loan.data?.member.membershipNumber || ""}</p>
            <p className="mt-1 text-sm text-[var(--text-400)]">{loan.data?.member.user.email || ""}</p>
            {loan.data?.bankAccount ? (
              <p className="mt-1 text-sm text-[var(--text-400)]">
                {loan.data.bankAccount.bankName} - {loan.data.bankAccount.accountNumber}
              </p>
            ) : null}
            <div className="mt-4">
              <StatusBadge
                status={loan.data?.status || "UNKNOWN"}
                variant={variantForStatus(loan.data?.status || "PENDING") as any}
              />
            </div>
          </section>

          {loan.data?.bankAccount ? (
            <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[var(--text-400)]" />
                <h2 className="text-lg font-semibold text-[var(--text-900)]">Bank Account</h2>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                  <p className="text-sm text-[var(--text-400)]">Bank Name</p>
                  <p className="mt-1 font-semibold text-[var(--text-900)]">{loan.data.bankAccount.bankName}</p>
                </div>
                <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                  <p className="text-sm text-[var(--text-400)]">Account Number</p>
                  <p className="mt-1 font-semibold text-[var(--text-900)]">{loan.data.bankAccount.accountNumber}</p>
                </div>
                <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                  <p className="text-sm text-[var(--text-400)]">Account Name</p>
                  <p className="mt-1 font-semibold text-[var(--text-900)]">{loan.data.bankAccount.accountName}</p>
                </div>
                <div className="flex items-center gap-2 rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                  <ShieldCheck className={`h-4 w-4 ${loan.data.bankAccount.verifiedAt ? "text-[var(--secondary-600)]" : "text-[var(--text-400)]"}`} />
                  <p className="text-sm font-medium text-[var(--text-900)]">
                    {loan.data.bankAccount.verifiedAt ? "Verified" : "Not verified"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {loan.data?.dueDate ? (
            <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--text-400)]" />
                <h2 className="text-lg font-semibold text-[var(--text-900)]">Due Date</h2>
              </div>
              <p className="mt-3 text-lg font-semibold text-[var(--text-900)]">
                {new Date(loan.data.dueDate).toLocaleDateString("en-NG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </section>
          ) : null}

          {loan.data?.rejectionReason ? (
            <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
              <h2 className="text-lg font-semibold text-[var(--text-900)]">Rejection Reason</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-400)]">{loan.data.rejectionReason}</p>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--text-900)]">Guarantors</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                <p className="text-sm text-[var(--text-400)]">Guarantor 1</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{loan.data?.guarantorOne?.fullName || "Not assigned"}</p>
                <p className="text-xs text-[var(--text-400)]">{loan.data?.guarantorOne?.membershipNumber || ""}</p>
              </div>
              <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                <p className="text-sm text-[var(--text-400)]">Guarantor 2</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{loan.data?.guarantorTwo?.fullName || "Not assigned"}</p>
                <p className="text-xs text-[var(--text-400)]">{loan.data?.guarantorTwo?.membershipNumber || ""}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-[var(--text-400)]">Amount</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-900)]">{currency.format(loan.data?.amount ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Paid so far</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-900)]">{currency.format(loan.data?.amountPaidSoFar ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Remaining</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-900)]">{currency.format(loan.data?.remainingBalance ?? 0)}</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-[var(--text-400)]">Repayment progress</span>
                <span className="font-semibold text-[var(--text-900)]">{Math.round(loan.data?.repaymentProgress ?? 0)}%</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--primary-900)/8]">
                <div
                  className="h-3 rounded-full bg-[var(--primary-700)] transition-all"
                  style={{ width: `${loan.data?.repaymentProgress ?? 0}%` }}
                />
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--text-400)]">{loan.data?.purpose || "No purpose provided."}</p>
          </section>

          {(isApprovedLoan || isDisbursedLoan) && (
            <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-[var(--background-50)/50] p-6">
              <p className="text-sm font-medium text-[var(--text-400)]">Disbursement Notice</p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-900)]">
                Disbursement will be made to member&apos;s bank account
                {loan.data?.bankAccount ? (
                  <>
                    {" "}({loan.data.bankAccount.bankName} &mdash; {loan.data.bankAccount.accountNumber})
                  </>
                ) : null}.
                A LOAN_DISBURSEMENT transaction record will be created.
              </p>
            </section>
          )}

          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--text-900)]">Loan Timeline</h2>
            <div className="mt-4 space-y-3">
              {(loan.data?.timeline ?? []).map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--text-900)]">{item.label}</p>
                      <p className="mt-1 text-xs text-[var(--text-400)]">{new Date(item.date).toLocaleString("en-NG")}</p>
                      {typeof item.amount === "number" ? (
                        <p className="mt-1 text-xs text-[var(--text-400)]">{currency.format(item.amount)}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={item.status} variant={variantForStatus(item.status.toUpperCase()) as any} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--text-900)]">Installment Schedule</h2>
            <div className="mt-4 space-y-3">
              {(loan.data?.paymentSchedule ?? []).map((item) => (
                <div key={item.installment} className="flex items-center justify-between rounded-[1.25rem] bg-[var(--background-50)/72] p-4">
                  <div>
                    <p className="font-semibold text-[var(--text-900)]">Installment {item.installment}</p>
                    <p className="mt-1 text-xs text-[var(--text-400)]">{new Date(item.dueDate).toLocaleDateString("en-NG")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[var(--text-900)]">{currency.format(item.amount)}</p>
                    <div className="mt-2">
                      <StatusBadge status={item.status} variant={variantForStatus(item.status) as any} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
