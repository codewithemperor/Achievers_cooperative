"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { AdminModal } from "@/components/ui/admin-modal";
import { NumberInput, TextareaInput } from "@/components/ui/form-input";
import { useForm } from "react-hook-form";
import {
  Banknote,
  Building2,
  Calendar,
  CircleDollarSign,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";

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
  approvedAmount?: number;
  disbursedAmount: number;
  remainingToDisburse: number;
  remainingBalance: number;
  amountPaidSoFar: number;
  repaymentProgress: number;
  loanBondRequired?: boolean;
  loanBondAmount?: number;
  loanBondPaidAt?: string | null;
  loanBondTransactionId?: string | null;
  loanBondPaid?: boolean;
  canPayLoanBond?: boolean;
  canDisburse?: boolean;
  tenorMonths: number;
  tenorUnit?: "MONTHS" | "WEEKS";
  purpose: string;
  status: string;
  dueDate?: string | null;
  nextRepaymentAt?: string | null;
  submittedAt: string;
  approvedAt?: string | null;
  disbursedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  bankAccount?: BankAccountInfo | null;
  member: {
    fullName: string;
    membershipNumber: string;
    user: { email: string };
    wallet?: {
      availableBalance: number;
      pendingBalance: number;
    } | null;
  };
  guarantorOne?: { fullName: string; membershipNumber: string } | null;
  guarantorTwo?: { fullName: string; membershipNumber: string } | null;
  paymentSchedule: Array<{
    installment: number;
    dueDate: string;
    amount: number;
    expectedAmount?: number;
    paidAmount?: number;
    remainingAmount?: number;
    status: string;
  }>;
  timeline: Array<{
    label: string;
    date: string;
    status: string;
    amount?: number;
    reference?: string | null;
  }>;
  relatedTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    createdAt: string;
  }>;
  activities: Array<{
    id: string;
    type: "AMOUNT_INCREASE" | "DISBURSEMENT";
    previousAmount?: number | null;
    newAmount?: number | null;
    deltaAmount: number;
    note?: string | null;
    createdAt: string;
    actor?: { email: string; role: string } | null;
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function variantForStatus(status: string) {
  switch (status) {
    case "PENDING":
      return "warning";
    case "APPROVED":
      return "info";
    case "DISBURSED":
      return "info";
    case "IN_PROGRESS":
      return "success";
    case "COMPLETED":
      return "success";
    case "OVERDUE":
      return "danger";
    case "REJECTED":
      return "danger";
    case "PAID":
      return "success";
    case "PARTIAL":
      return "warning";
    case "UPCOMING":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatLoanDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const loan = useApi<LoanDetail>(`/loans/${params.id}`);
  const [rejecting, setRejecting] = useState(false);
  const [repaying, setRepaying] = useState(false);
  const [increasing, setIncreasing] = useState(false);
  const [payingBond, setPayingBond] = useState(false);
  const [disbursing, setDisbursing] = useState(false);
  const { control, handleSubmit, reset, watch } = useForm<{
    reason: string;
    amount: number | undefined;
    newAmount: number | undefined;
    tenorMonths: number | undefined;
    tenorUnit: "MONTHS" | "WEEKS";
    disburseAmount: number | undefined;
  }>({
    defaultValues: { reason: "", amount: undefined, newAmount: undefined, tenorMonths: undefined, tenorUnit: "WEEKS", disburseAmount: undefined },
  });

  const status = loan.data?.status;
  const isNewLoan = status === "PENDING";
  const isApprovedLoan = status === "APPROVED";
  const isDisbursedLoan = status === "DISBURSED";
  const approvedAmount = loan.data?.approvedAmount ?? loan.data?.amount ?? 0;
  const disbursedAmount = loan.data?.disbursedAmount ?? 0;
  const remainingToDisburse = loan.data?.remainingToDisburse ?? Math.max(approvedAmount - disbursedAmount, 0);
  const loanBondRequired = Boolean(loan.data?.loanBondRequired);
  const loanBondAmount = loanBondRequired ? loan.data?.loanBondAmount ?? 0 : 0;
  const loanBondPaid = loanBondRequired && Boolean(loan.data?.loanBondPaidAt || loan.data?.loanBondPaid);
  const increaseValue = Number(watch("newAmount") ?? 0);
  const tenorValue = Number(watch("tenorMonths") ?? 0);
  const disburseValue = Number(watch("disburseAmount") ?? 0);
  const canIncreaseAmount = ["PENDING", "APPROVED", "DISBURSED", "IN_PROGRESS"].includes(status || "");
  const canPayLoanBond = Boolean(loan.data?.canPayLoanBond ?? (loanBondRequired && status === "APPROVED" && !loanBondPaid));
  const canDisburse =
    loan.data?.canDisburse ??
    (["APPROVED", "DISBURSED", "IN_PROGRESS"].includes(status || "") &&
      (!loanBondRequired || loanBondPaid) &&
      remainingToDisburse > 0);
  const isRepayable = ["DISBURSED", "IN_PROGRESS", "OVERDUE"].includes(
    status || "",
  );

  async function runAction(
    action: "approve" | "reject" | "markInProgress",
    reason?: string,
  ) {
    try {
      if (action === "reject") {
        await api.patch(`/loans/${params.id}/reject`, {
          reason: reason || undefined,
        });
        showSuccessToast("Loan rejected successfully.");
      } else if (action === "approve") {
        await api.patch(`/loans/${params.id}/approve`);
        showSuccessToast("Loan approved successfully.");
      } else if (action === "markInProgress") {
        await api.patch(`/loans/${params.id}/mark-in-progress`);
        showSuccessToast("Loan marked as in progress.");
      }
      await loan.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || `Unable to ${action} loan.`,
      );
      throw error;
    }
  }

  async function handlePayLoanBond() {
    try {
      setPayingBond(true);
      await api.post(`/loans/${params.id}/pay-bond`);
      showSuccessToast("Loan bond paid successfully.");
      await loan.refetch();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to pay loan bond.");
      throw error;
    } finally {
      setPayingBond(false);
    }
  }

  const handleReject = (close?: () => void) =>
    handleSubmit(async (values) => {
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

  const handleRepay = (close?: () => void) =>
    handleSubmit(async (values) => {
      try {
        setRepaying(true);
        await api.post(`/loans/${params.id}/admin-repay`, {
          amount: Number(values.amount),
        });
        showSuccessToast("Loan repayment processed successfully.");
        reset({ reason: "", amount: undefined });
        await loan.refetch();
        close?.();
      } catch (error: any) {
        showErrorToast(
          error?.response?.data?.message ||
            "Unable to process loan repayment.",
        );
      } finally {
        setRepaying(false);
      }
    });

  const handleIncreaseAmount = (close?: () => void) =>
    handleSubmit(async (values) => {
      const amount = Number(values.newAmount);
      if (!Number.isFinite(amount) || amount <= approvedAmount) return;
      try {
        setIncreasing(true);
        await api.patch(`/loans/${params.id}/increase-amount`, {
          amount,
          tenorMonths: tenorValue > (loan.data?.tenorMonths ?? 0) ? tenorValue : undefined,
          tenorUnit: watch("tenorUnit"),
          reason: values.reason || undefined,
        });
        showSuccessToast("Loan approved amount increased successfully.");
        reset({ reason: "", amount: undefined, newAmount: undefined, tenorMonths: undefined, tenorUnit: "WEEKS", disburseAmount: undefined });
        await loan.refetch();
        close?.();
      } catch (error: any) {
        showErrorToast(error?.response?.data?.message || "Unable to increase loan amount.");
      } finally {
        setIncreasing(false);
      }
    });

  const handleDisburse = (close?: () => void) =>
    handleSubmit(async (values) => {
      const amount = Number(values.disburseAmount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > remainingToDisburse) return;
      try {
        setDisbursing(true);
        await api.patch(`/loans/${params.id}/disburse`, { amount });
        showSuccessToast("Loan disbursement recorded successfully.");
        reset({ reason: "", amount: undefined, newAmount: undefined, tenorMonths: undefined, tenorUnit: "WEEKS", disburseAmount: undefined });
        await loan.refetch();
        close?.();
      } catch (error: any) {
        showErrorToast(error?.response?.data?.message || "Unable to disburse loan.");
      } finally {
        setDisbursing(false);
      }
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan detail"
        subtitle="Track approval, disbursement, repayments, and the expected installment schedule for this facility."
        actions={
          <>
            {canIncreaseAmount ? (
              <AdminModal
                description="Enter the new total approved amount for this loan. Repayment balance will not change until money is disbursed."
                title="Increase loan amount"
                trigger={
                  <button
                    className="rounded-full border border-[var(--primary-900)/12] px-4 py-2 text-sm font-semibold text-text-900 transition-colors hover:bg-background-50 dark:border-[var(--background-700)] dark:text-text-50 dark:hover:bg-[var(--background-800)]"
                    onClick={() =>
                      reset({
                        reason: "",
                        amount: undefined,
                        newAmount: approvedAmount,
                        tenorMonths: loan.data?.tenorMonths,
                        tenorUnit: loan.data?.tenorUnit ?? "WEEKS",
                        disburseAmount: undefined,
                      })
                    }
                    type="button"
                  >
                    Increase amount
                  </button>
                }
              >
                {({ close }) => {
                  const increase = Math.max(increaseValue - approvedAmount, 0);
                  return (
                    <>
                      <NumberInput
                        control={control}
                        label="New approved amount"
                        name="newAmount"
                        min={approvedAmount + 1}
                      />
                      <p className="mt-2 text-sm text-text-500 dark:text-text-300">
                        Current approved amount is {currency.format(approvedAmount)}. Increase: {currency.format(increase)}.
                      </p>
                      <div className="mt-4">
                        <NumberInput
                          control={control}
                          label="Loan tenor in months"
                          name="tenorMonths"
                          min={loan.data?.tenorMonths ?? 1}
                        />
                        <div className="mt-2 rounded-2xl bg-background-50 p-4 text-sm text-text-500 dark:bg-[var(--background-800)] dark:text-text-300">
                          Enter the total loan tenor in months. If repayment is weekly, the system converts those months into weekly installments.
                        </div>
                      </div>
                      <div className="mt-4">
                        <TextareaInput
                          control={control}
                          label="Reason (optional)"
                          name="reason"
                          placeholder="Why is the loan amount being increased?"
                          rows={3}
                        />
                      </div>
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          className="rounded-full border border-[var(--primary-900)/12] px-4 py-2 text-sm font-medium text-text-900 dark:border-[var(--background-700)] dark:text-text-50"
                          onClick={close}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                          disabled={increasing || !Number.isFinite(increaseValue) || increaseValue <= approvedAmount}
                          onClick={() => void handleIncreaseAmount(close)()}
                          type="button"
                        >
                          {increasing ? "Saving..." : "Save increase"}
                        </button>
                      </div>
                    </>
                  );
                }}
              </AdminModal>
            ) : null}
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
                          className="rounded-full border border-[var(--primary-900)/12] px-4 py-2 text-sm font-medium text-text-900"
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
            {canPayLoanBond ? (
              <ConfirmActionButton
                confirmMessage={`Deduct ${currency.format(loanBondAmount)} from the member wallet as the required loan bond. Disbursement will be available after this payment succeeds.`}
                confirmTitle="Pay loan bond?"
                isDisabled={payingBond}
                label="Pay Loan Bond"
                onConfirm={() => handlePayLoanBond()}
                pendingLabel="Paying..."
                tone="success"
              />
            ) : null}
            {canDisburse ? (
              <AdminModal
                description="Record the amount actually transferred now. The member repays only disbursed funds."
                title="Disburse loan"
                trigger={
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                    onClick={() =>
                      reset({
                        reason: "",
                        amount: undefined,
                        newAmount: undefined,
                        disburseAmount: remainingToDisburse,
                      })
                    }
                    type="button"
                  >
                    Disburse
                  </button>
                }
              >
                {({ close }) => {
                  const remainingAfter = Math.max(remainingToDisburse - (Number.isFinite(disburseValue) ? disburseValue : 0), 0);
                  const invalid = !Number.isFinite(disburseValue) || disburseValue <= 0 || disburseValue > remainingToDisburse;
                  return (
                    <>
                      <NumberInput
                        control={control}
                        label="Amount to disburse"
                        name="disburseAmount"
                        min={1}
                        max={remainingToDisburse}
                      />
                      <div className="mt-4 grid gap-3 rounded-2xl bg-background-50 p-4 text-sm dark:bg-[var(--background-800)]">
                        <div className="flex justify-between gap-4">
                          <span className="text-text-400">Total approved</span>
                          <span className="font-semibold text-text-900 dark:text-text-50">{currency.format(approvedAmount)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-text-400">Already disbursed</span>
                          <span className="font-semibold text-text-900 dark:text-text-50">{currency.format(disbursedAmount)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-text-400">Amount to disburse</span>
                          <span className="font-semibold text-text-900 dark:text-text-50">{currency.format(Number.isFinite(disburseValue) ? disburseValue : 0)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-text-400">Remaining after this</span>
                          <span className="font-semibold text-text-900 dark:text-text-50">{currency.format(remainingAfter)}</span>
                        </div>
                      </div>
                      {invalid ? (
                        <p className="mt-2 text-sm text-[#b42318]">
                          Amount must be greater than zero and not more than {currency.format(remainingToDisburse)}.
                        </p>
                      ) : null}
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          className="rounded-full border border-[var(--primary-900)/12] px-4 py-2 text-sm font-medium text-text-900 dark:border-[var(--background-700)] dark:text-text-50"
                          onClick={close}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                          disabled={disbursing || invalid}
                          onClick={() => void handleDisburse(close)()}
                          type="button"
                        >
                          {disbursing ? "Disbursing..." : "Confirm disbursement"}
                        </button>
                      </div>
                    </>
                  );
                }}
              </AdminModal>
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
            {isRepayable ? (
              <AdminModal
                description="Enter the repayment amount to deduct directly from the member's wallet."
                title="Pay Loan"
                trigger={
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white"
                    type="button"
                  >
                    Pay Loan
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
                          loan.data?.member.wallet?.availableBalance ?? 0,
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
                        className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        disabled={repaying}
                        onClick={() => void handleRepay(close)()}
                        type="button"
                      >
                        {repaying ? "Processing..." : "Process repayment"}
                      </button>
                    </div>
                  </>
                )}
              </AdminModal>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          description="Maximum total amount currently approved for this loan."
          href={`/admin/loans/${params.id}`}
          icon={<Banknote className="h-5 w-5" />}
          title="Approved Amount"
          tone="green"
          value={currency.format(approvedAmount)}
        />
        <DashboardMetricCard
          description={`${currency.format(remainingToDisburse)} is still available for later disbursement.`}
          href={`/admin/loans/${params.id}`}
          icon={<WalletCards className="h-5 w-5" />}
          title="Disbursed"
          tone="green"
          value={currency.format(disbursedAmount)}
        />
        {loanBondRequired ? (
          <DashboardMetricCard
            description={loanBondPaid ? "Required loan bond has been paid." : "Required before this loan can be disbursed."}
            href={`/admin/loans/${params.id}`}
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Loan Bond"
            tone={loanBondPaid ? "green" : "amber"}
            value={loanBondPaid ? "Paid" : currency.format(loanBondAmount)}
          />
        ) : null}
        <DashboardMetricCard
          description="Total repayments already applied to this loan."
          href={`/admin/loans/${params.id}`}
          icon={<CircleDollarSign className="h-5 w-5" />}
          title="Paid So Far"
          value={currency.format(loan.data?.amountPaidSoFar ?? 0)}
        />
        <DashboardMetricCard
          description="Outstanding balance still owed by the member."
          href={`/admin/loans/${params.id}`}
          icon={<WalletCards className="h-5 w-5" />}
          title="Repayment Balance"
          tone={(loan.data?.remainingBalance ?? 0) > 0 ? "amber" : "neutral"}
          value={currency.format(loan.data?.remainingBalance ?? 0)}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-text-400">Member</p>
                <h2 className="mt-1 text-xl font-semibold text-text-900 dark:text-text-50">
                  {loan.data?.member.fullName || "-"}
                </h2>
                <p className="mt-1 text-sm text-text-400">
                  {loan.data?.member.membershipNumber || ""}{" "}
                  {loan.data?.member.user.email
                    ? `- ${loan.data.member.user.email}`
                    : ""}
                </p>
              </div>
              <StatusBadge
                status={loan.data?.status || "UNKNOWN"}
                variant={variantForStatus(loan.data?.status || "PENDING") as any}
              />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-text-400">Repayment progress</span>
                  <span className="font-semibold text-text-900 dark:text-text-50">
                    {Math.round(loan.data?.repaymentProgress ?? 0)}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-[color-mix(in_oklab,var(--primary-900)_8%,transparent)] dark:bg-[var(--background-800)]">
                  <div
                    className="h-3 rounded-full bg-[var(--primary-700)] transition-all"
                    style={{ width: `${loan.data?.repaymentProgress ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                    Approved Amount
                  </p>
                  <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                    {currency.format(approvedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                    Disbursed So Far
                  </p>
                  <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                    {currency.format(disbursedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                    Remaining To Disburse
                  </p>
                  <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                    {currency.format(remainingToDisburse)}
                  </p>
                </div>
                {loanBondRequired ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                      Loan Bond
                    </p>
                    <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                      {loanBondPaid ? "Paid" : currency.format(loanBondAmount)}
                    </p>
                    {loan.data?.loanBondPaidAt ? (
                      <p className="mt-1 text-xs text-text-400">
                        {formatLoanDate(loan.data.loanBondPaidAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                    Next Repayment
                  </p>
                  <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                    {formatLoanDate(loan.data?.nextRepaymentAt ?? loan.data?.dueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-400">
                    Wallet Balance
                  </p>
                  <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                    {currency.format(
                      loan.data?.member.wallet?.availableBalance ?? 0,
                    )}
                  </p>
                </div>
              </div>

              {loan.data?.bankAccount ? (
                <div className="rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-text-400" />
                    <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                      Bank Account
                    </p>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-text-900 dark:text-text-50">
                    {loan.data.bankAccount.accountName}
                  </p>
                  <p className="mt-1 text-sm text-text-400">
                    {loan.data.bankAccount.bankName} -{" "}
                    {loan.data.bankAccount.accountNumber}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm text-text-500 dark:text-text-300">
                    <ShieldCheck
                      className={`h-4 w-4 ${
                        loan.data.bankAccount.verifiedAt
                          ? "text-[var(--secondary-600)]"
                          : "text-text-400"
                      }`}
                    />
                    {loan.data.bankAccount.verifiedAt
                      ? "Verified"
                      : "Not verified"}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]">
                <p className="text-sm font-semibold text-text-900 dark:text-text-50">
                  Guarantors
                </p>
                <div className="mt-3 space-y-3">
                  {[loan.data?.guarantorOne, loan.data?.guarantorTwo].map(
                    (guarantor, index) => (
                      <div key={`guarantor-${index + 1}`}>
                        <p className="text-xs text-text-400">
                          Guarantor {index + 1}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-text-900 dark:text-text-50">
                          {guarantor?.fullName || "Not assigned"}
                        </p>
                        <p className="text-xs text-text-400">
                          {guarantor?.membershipNumber || ""}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {loan.data?.rejectionReason ? (
                <div className="rounded-2xl bg-[#fff1f0] p-4 text-sm text-[#b42318] dark:bg-[#7f1d1d] dark:text-[#fecaca]">
                  <p className="font-semibold">Rejection Reason</p>
                  <p className="mt-2 leading-6">{loan.data.rejectionReason}</p>
                </div>
              ) : null}

              {(isApprovedLoan || isDisbursedLoan) && (
                <div className="rounded-2xl bg-background-50 p-4 text-sm leading-6 text-text-500 dark:bg-[var(--background-800)] dark:text-text-300">
                  {!loanBondRequired
                    ? "Disbursement will be made to the member's bank account. A LOAN_DISBURSEMENT transaction record will be created."
                    : loanBondPaid
                    ? "Disbursement will be made to the member's bank account. A LOAN_DISBURSEMENT transaction record will be created."
                    : `Loan bond of ${currency.format(loanBondAmount)} must be paid from the member wallet before disbursement.`}
                </div>
              )}
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
            <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
              Loan Timeline
            </h2>
            <div className="mt-5">
              {(loan.data?.timeline ?? []).length ? (
                <ol className="relative space-y-4 before:absolute before:bottom-0 before:left-5 before:top-0 before:w-px before:bg-primary-900/10 dark:before:bg-[var(--background-700)]">
                  {(loan.data?.timeline ?? []).map((item, index) => (
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
                              {new Date(item.date).toLocaleString("en-NG")}
                            </p>
                          </div>
                          <StatusBadge
                            status={item.status}
                            variant={
                              variantForStatus(item.status.toUpperCase()) as any
                            }
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
                  No timeline records found for this loan.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
            <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
              Loan Activity
            </h2>
            <div className="mt-4 space-y-3">
              {(loan.data?.activities ?? []).length ? (
                (loan.data?.activities ?? []).map((activity) => (
                  <div
                    className="rounded-2xl bg-background-50 p-4 dark:bg-[var(--background-800)]"
                    key={activity.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text-900 dark:text-text-50">
                          {activity.type === "AMOUNT_INCREASE" ? "Approved amount increased" : "Partial disbursement"}
                        </p>
                        <p className="mt-1 text-sm text-text-400">
                          {new Date(activity.createdAt).toLocaleString("en-NG")}
                          {activity.actor?.email ? ` by ${activity.actor.email}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-text-900 dark:text-text-50">
                        {currency.format(activity.deltaAmount)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-text-500 dark:text-text-300 sm:grid-cols-2">
                      {activity.previousAmount != null ? (
                        <span>Previous: {currency.format(activity.previousAmount)}</span>
                      ) : null}
                      {activity.newAmount != null ? (
                        <span>New: {currency.format(activity.newAmount)}</span>
                      ) : null}
                    </div>
                    {activity.note ? (
                      <p className="mt-3 text-sm text-text-500 dark:text-text-300">{activity.note}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-primary-900/12 p-5 text-sm text-text-400 dark:border-[var(--background-700)]">
                  No loan increase or partial disbursement activity has been recorded yet.
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
                    header: "Expected",
                    render: (item) => currency.format(item.expectedAmount ?? item.amount),
                    sortValue: (item) => item.expectedAmount ?? item.amount,
                  },
                  {
                    key: "paidAmount",
                    header: "Paid",
                    render: (item) => currency.format(item.paidAmount ?? 0),
                    sortValue: (item) => item.paidAmount ?? 0,
                  },
                  {
                    key: "remainingAmount",
                    header: "Remaining",
                    render: (item) =>
                      currency.format(item.remainingAmount ?? Math.max((item.expectedAmount ?? item.amount) - (item.paidAmount ?? 0), 0)),
                    sortValue: (item) =>
                      item.remainingAmount ?? Math.max((item.expectedAmount ?? item.amount) - (item.paidAmount ?? 0), 0),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (item) => (
                      <StatusBadge
                        status={item.status}
                        variant={variantForStatus(item.status) as any}
                      />
                    ),
                  },
                ]}
                data={loan.data?.paymentSchedule ?? []}
                emptyDescription="No installment records found for this loan."
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
