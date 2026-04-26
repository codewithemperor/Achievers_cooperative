"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface LoanDetail {
  id: string;
  amount: number;
  remainingBalance: number;
  amountPaidSoFar: number;
  repaymentProgress: number;
  tenorMonths: number;
  purpose: string;
  status: string;
  submittedAt: string;
  approvedAt?: string | null;
  disbursedAt?: string | null;
  rejectedAt?: string | null;
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
  if (status === "APPROVED" || status === "DISBURSED" || status === "PAID") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const loan = useApi<LoanDetail>(`/loans/${params.id}`);
  const isNewLoan = loan.data?.status === "PENDING";
  const isApprovedLoan = loan.data?.status === "APPROVED" && !loan.data?.disbursedAt;
  const actionSuccessMessage: Record<"approve" | "reject" | "disburse", string> = {
    approve: "Loan approved successfully.",
    reject: "Loan rejected successfully.",
    disburse: "Loan disbursed successfully.",
  };

  async function runAction(action: "approve" | "reject" | "disburse") {
    try {
      await api.patch(`/loans/${params.id}/${action}`);
      showSuccessToast(actionSuccessMessage[action]);
      await loan.refetch();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || `Unable to ${action} loan.`);
      throw error;
    }
  }

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
                <ConfirmActionButton
                  confirmMessage="Reject this pending loan request. The action cannot be undone from this page."
                  confirmTitle="Reject loan request?"
                  label="Reject"
                  onConfirm={() => runAction("reject")}
                  pendingLabel="Rejecting..."
                  tone="danger"
                />
              </>
            ) : null}
            {isApprovedLoan ? (
              <ConfirmActionButton
                confirmMessage="Disburse this approved loan and credit the member wallet immediately."
                confirmTitle="Disburse approved loan?"
                label="Disburse"
                onConfirm={() => runAction("disburse")}
                pendingLabel="Disbursing..."
                tone="success"
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <p className="text-sm text-[var(--color-coop-muted)]">Member</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{loan.data?.member.fullName || "-"}</p>
            <p className="mt-1 text-sm">{loan.data?.member.membershipNumber || ""}</p>
            <p className="mt-1 text-sm text-[var(--color-coop-muted)]">{loan.data?.member.user.email || ""}</p>
            <div className="mt-4">
              <StatusBadge
                status={loan.data?.disbursedAt ? "DISBURSED" : loan.data?.status || "UNKNOWN"}
                variant={variantForStatus(loan.data?.disbursedAt ? "DISBURSED" : loan.data?.status || "PENDING") as any}
              />
            </div>
          </section>

          <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--color-dark)]">Guarantors</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.25rem] bg-[rgba(245,240,232,0.72)] p-4">
                <p className="text-sm text-[var(--color-coop-muted)]">Guarantor 1</p>
                <p className="mt-1 font-semibold text-[var(--color-dark)]">{loan.data?.guarantorOne?.fullName || "Not assigned"}</p>
                <p className="text-xs text-[var(--color-coop-muted)]">{loan.data?.guarantorOne?.membershipNumber || ""}</p>
              </div>
              <div className="rounded-[1.25rem] bg-[rgba(245,240,232,0.72)] p-4">
                <p className="text-sm text-[var(--color-coop-muted)]">Guarantor 2</p>
                <p className="mt-1 font-semibold text-[var(--color-dark)]">{loan.data?.guarantorTwo?.fullName || "Not assigned"}</p>
                <p className="text-xs text-[var(--color-coop-muted)]">{loan.data?.guarantorTwo?.membershipNumber || ""}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-[var(--color-coop-muted)]">Amount</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{currency.format(loan.data?.amount ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-coop-muted)]">Paid so far</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{currency.format(loan.data?.amountPaidSoFar ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-coop-muted)]">Remaining</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{currency.format(loan.data?.remainingBalance ?? 0)}</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-[var(--color-coop-muted)]">Repayment progress</span>
                <span className="font-semibold text-[var(--color-dark)]">{Math.round(loan.data?.repaymentProgress ?? 0)}%</span>
              </div>
              <div className="h-3 rounded-full bg-[rgba(26,46,26,0.08)]">
                <div
                  className="h-3 rounded-full bg-[var(--color-green)] transition-all"
                  style={{ width: `${loan.data?.repaymentProgress ?? 0}%` }}
                />
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--color-coop-muted)]">{loan.data?.purpose || "No purpose provided."}</p>
          </section>

          <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--color-dark)]">Loan Timeline</h2>
            <div className="mt-4 space-y-3">
              {(loan.data?.timeline ?? []).map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.72)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--color-dark)]">{item.label}</p>
                      <p className="mt-1 text-xs text-[var(--color-coop-muted)]">{new Date(item.date).toLocaleString("en-NG")}</p>
                      {typeof item.amount === "number" ? (
                        <p className="mt-1 text-xs text-[var(--color-coop-muted)]">{currency.format(item.amount)}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={item.status} variant={variantForStatus(item.status.toUpperCase()) as any} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--color-dark)]">Installment Schedule</h2>
            <div className="mt-4 space-y-3">
              {(loan.data?.paymentSchedule ?? []).map((item) => (
                <div key={item.installment} className="flex items-center justify-between rounded-[1.25rem] bg-[rgba(245,240,232,0.72)] p-4">
                  <div>
                    <p className="font-semibold text-[var(--color-dark)]">Installment {item.installment}</p>
                    <p className="mt-1 text-xs text-[var(--color-coop-muted)]">{new Date(item.dueDate).toLocaleDateString("en-NG")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[var(--color-dark)]">{currency.format(item.amount)}</p>
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
