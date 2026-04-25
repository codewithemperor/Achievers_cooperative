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
  tenorMonths: number;
  purpose: string;
  status: string;
  disbursedAt?: string | null;
  rejectedAt?: string | null;
  member: { fullName: string; membershipNumber: string };
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

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
        subtitle="Review the selected loan application and its member context."
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
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
          <p className="text-sm text-[var(--color-coop-muted)]">Member</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{loan.data?.member.fullName || "-"}</p>
          <p className="mt-1 text-sm">{loan.data?.member.membershipNumber || ""}</p>
        </div>
        <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
          <p className="text-sm text-[var(--color-coop-muted)]">Loan amount</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">{currency.format(loan.data?.amount ?? 0)}</p>
          <p className="mt-1 text-sm">{loan.data?.tenorMonths ?? 0} month tenor</p>
          <div className="mt-4">
            <StatusBadge
              status={loan.data?.disbursedAt ? "DISBURSED" : loan.data?.status || "UNKNOWN"}
              variant={loan.data?.disbursedAt ? "success" : loan.data?.status === "REJECTED" ? "danger" : loan.data?.status === "APPROVED" ? "success" : "warning"}
            />
          </div>
        </div>
      </div>
      <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
        <h2 className="text-xl font-semibold text-[var(--color-dark)]">Purpose</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-coop-muted)]">{loan.data?.purpose || "No purpose provided."}</p>
      </div>
    </div>
  );
}
