"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HandCoins } from "lucide-react";
import { MemberModal } from "@/components/member-modal";
import { NumberInput, SelectInput, TextareaInput } from "@/components/form-input";
import type { SelectOption } from "@/components/form-input";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { apiCallWithAlert, MySwal } from "@/lib/alert";
import api from "@/lib/member-api";
import { useMemberData } from "@/hooks/use-member-data";
import { formatMoney } from "@/lib/member-format";

interface LoanItem {
  id: string;
  amount: number;
  remainingBalance: number;
  amountPaidSoFar?: number;
  tenorMonths: number;
  purpose: string;
  status: string;
  repaymentProgress?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  bankAccount?: {
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
}

interface LoansPayload {
  items: LoanItem[];
}

interface GuarantorPayload {
  items: Array<{
    id: string;
    fullName: string;
    membershipNumber: string;
    phoneNumber: string;
  }>;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

const ACTIVE_STATUSES = ["APPROVED", "DISBURSED", "IN_PROGRESS", "OVERDUE"];

const loanSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid loan amount"),
  tenorMonths: z.coerce.number().int().positive("Enter tenor in months").max(60, "Maximum tenor is 60 months"),
  purpose: z.string().min(1, "Loan purpose is required").max(500),
  guarantorOneId: z.string(),
  guarantorTwoId: z.string(),
  bankAccountId: z.string(),
});

type LoanFormValues = z.infer<typeof loanSchema>;

function maskAccountNumber(num: string) {
  if (!num || num.length < 4) return num;
  return `**** ${num.slice(-4)}`;
}

export default function LoansPage() {
  const loans = useMemberData<LoansPayload>("/loans", { items: [] });
  const guarantors = useMemberData<GuarantorPayload>("/members/guarantors", { items: [] });
  const bankAccounts = useMemberData<BankAccount[]>("/bank-accounts", []);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanItem | null>(null);

  const hasActiveLoan = loans.data.items.some((loan) => ACTIVE_STATUSES.includes(loan.status.toUpperCase()));
  const totalOutstanding = loans.data.items.reduce((sum, item) => sum + (item.remainingBalance || 0), 0);
  const totalRequested = loans.data.items.reduce((sum, item) => sum + item.amount, 0);

  const { control, handleSubmit, reset, watch } = useForm<LoanFormValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      amount: 0,
      tenorMonths: 0,
      purpose: "",
      guarantorOneId: "",
      guarantorTwoId: "",
      bankAccountId: "",
    },
  });

  const selectedGuarantorOne = watch("guarantorOneId");

  const guarantorOneOptions: SelectOption[] = guarantors.data.items.map((g) => ({
    id: g.id,
    label: `${g.fullName} / ${g.membershipNumber}`,
  }));

  const guarantorTwoOptions: SelectOption[] = guarantors.data.items
    .filter((g) => g.id !== selectedGuarantorOne)
    .map((g) => ({
      id: g.id,
      label: `${g.fullName} / ${g.membershipNumber}`,
    }));

  const bankAccountOptions: SelectOption[] = bankAccounts.data.map((b) => ({
    id: b.id,
    label: `${b.bankName} - ${maskAccountNumber(b.accountNumber)}`,
  }));

  const defaultBankAccountId = useMemo(
    () => bankAccounts.data.find((account) => account.isDefault)?.id ?? bankAccounts.data[0]?.id ?? "",
    [bankAccounts.data],
  );

  async function onSubmit(values: LoanFormValues) {
    const endpoint = editingLoan ? `/loans/${editingLoan.id}` : "/loans";
    const method = editingLoan ? api.patch : api.post;

    const result = await apiCallWithAlert({
      title: editingLoan ? "Update Loan Application" : "Loan Application",
      loadingText: editingLoan ? "Updating loan application..." : "Submitting loan application...",
      apiCall: () =>
        method(endpoint, {
          amount: values.amount,
          tenorMonths: values.tenorMonths,
          purpose: values.purpose,
          guarantorOneId: values.guarantorOneId || undefined,
          guarantorTwoId: values.guarantorTwoId || undefined,
          bankAccountId: values.bankAccountId || undefined,
        }),
      successTitle: editingLoan ? "Application Updated" : "Application Submitted",
      successText: editingLoan
        ? "Your pending loan application has been updated."
        : "Your loan application has been submitted and is pending review.",
    });

    if (result) {
      setIsLoanModalOpen(false);
      setEditingLoan(null);
      reset();
      await loans.refetch();
    }
  }

  function openCreateModal() {
    setEditingLoan(null);
    reset({
      amount: 0,
      tenorMonths: 0,
      purpose: "",
      guarantorOneId: "",
      guarantorTwoId: "",
      bankAccountId: defaultBankAccountId,
    });
    setIsLoanModalOpen(true);
  }

  function openEditModal(loan: LoanItem) {
    setEditingLoan(loan);
    reset({
      amount: loan.amount,
      tenorMonths: loan.tenorMonths,
      purpose: loan.purpose,
      guarantorOneId: "",
      guarantorTwoId: "",
      bankAccountId: loan.bankAccount?.id ?? defaultBankAccountId,
    });
    setIsLoanModalOpen(true);
  }

  async function deleteLoan(loan: LoanItem) {
    const result = await MySwal.fire({
      title: "Delete pending application?",
      text: "This pending loan request will be removed.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    const removed = await apiCallWithAlert({
      title: "Delete Loan Application",
      loadingText: "Removing application...",
      apiCall: () => api.delete(`/loans/${loan.id}`),
      successTitle: "Application Deleted",
      successText: "The pending loan application has been removed.",
    });

    if (removed) {
      await loans.refetch();
    }
  }

  return (
    <div className="space-y-5">
      <SummaryCard
        eyebrow="Loans"
        title="Outstanding balance"
        value={formatMoney(totalOutstanding)}
        caption={`Total requested: ${formatMoney(totalRequested)}`}
        ctaLabel={!hasActiveLoan && bankAccounts.data.length ? "New application" : undefined}
        onCtaClick={!hasActiveLoan && bankAccounts.data.length ? openCreateModal : undefined}
        icon={<HandCoins className="h-5 w-5" />}
        gradient="from-[#ff7b7b] via-[#f14d73] to-[#cb2d58]"
      />

      {hasActiveLoan ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50/95 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">Active loan in progress</h2>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            You already have an approved or active loan. Finish it before creating another application.
          </p>
        </section>
      ) : bankAccounts.data.length === 0 ? (
        <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
          <h2 className="text-lg font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">Apply for a loan</h2>
          <p className="mt-1 text-sm text-[var(--text-400)]">
            Add a bank account in your{" "}
            <Link href="/account/bank-account" className="font-semibold text-[var(--primary-600)] underline dark:text-[var(--primary-700)]">
              Bank Account
            </Link>{" "}
            page before submitting a request.
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">My loans</h2>
          <p className="mt-1 text-sm text-[var(--text-400)]">Applications and repayment states are now shown in the same shared card format.</p>
        </div>

        {loans.data.items.length ? (
          loans.data.items.map((loan) => (
            <TransactionCard
              key={loan.id}
              type="LOAN"
              title={loan.purpose}
              subtitle={`${loan.tenorMonths} months${loan.bankAccount ? ` • ${loan.bankAccount.bankName}` : ""}`}
              amount={loan.remainingBalance ?? loan.amount}
              status={loan.status}
              timestamp={loan.bankAccount ? new Date().toISOString() : new Date().toISOString()}
              ctaLabel="View details"
              href={loan.canEdit || loan.canDelete ? undefined : `/loans/${loan.id}`}
              extra={
                loan.canEdit || loan.canDelete ? (
                  <div className="flex flex-wrap gap-2">
                    {loan.canEdit ? (
                      <button
                        className="rounded-full border border-[var(--background-200)] px-3 py-1.5 text-xs font-semibold text-[var(--text-700)]"
                        onClick={(event) => {
                          event.preventDefault();
                          openEditModal(loan);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                    ) : null}
                    {loan.canDelete ? (
                      <button
                        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                        onClick={(event) => {
                          event.preventDefault();
                          void deleteLoan(loan);
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <Link href={`/loans/${loan.id}`} className="text-xs font-semibold text-[var(--primary-600)] dark:text-[var(--primary-700)]">
                    Paid so far: {formatMoney(loan.amountPaidSoFar ?? 0)}
                  </Link>
                )
              }
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
            You have not created any loan applications yet.
          </div>
        )}
      </section>

      <MemberModal
        isOpen={isLoanModalOpen}
        onClose={() => {
          setIsLoanModalOpen(false);
          setEditingLoan(null);
        }}
        title={editingLoan ? "Edit loan application" : "Loan application"}
        description="Provide the amount, tenor, purpose, and the disbursement account for your request."
      >
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <SelectInput
            control={control}
            name="bankAccountId"
            label="Disbursement bank account"
            placeholder="Select a bank account"
            options={bankAccountOptions}
            isRequired
          />
          <NumberInput
            control={control}
            name="amount"
            label="Loan amount"
            placeholder="Enter amount"
            isRequired
            min={1}
            formatOptions={{ style: "currency", currency: "NGN", maximumFractionDigits: 0 }}
          />
          <NumberInput
            control={control}
            name="tenorMonths"
            label="Tenor in months"
            placeholder="e.g. 12"
            isRequired
            min={1}
            max={60}
          />
          <TextareaInput
            control={control}
            name="purpose"
            label="Purpose of the loan"
            placeholder="Describe what you need the loan for"
            isRequired
            rows={3}
            maxLength={500}
            showCount
          />
          <SelectInput
            control={control}
            name="guarantorOneId"
            label="Guarantor 1"
            placeholder="Select guarantor 1"
            options={guarantorOneOptions}
          />
          <SelectInput
            control={control}
            name="guarantorTwoId"
            label="Guarantor 2"
            placeholder="Select guarantor 2"
            options={guarantorTwoOptions}
          />
          <button
            className="min-h-[44px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            type="submit"
          >
            {editingLoan ? "Save changes" : "Submit application"}
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
