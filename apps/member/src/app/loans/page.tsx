"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HandCoins } from "lucide-react";
import { MemberModal } from "@/components/member-modal";
import {
  NumberInput,
  SelectInput,
  TextareaInput,
} from "@/components/form-input";
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
  tenorMonths: z.coerce
    .number()
    .int()
    .positive("Enter tenor in months")
    .max(60, "Maximum tenor is 60 months"),
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
  const guarantors = useMemberData<GuarantorPayload>("/members/guarantors", {
    items: [],
  });
  const bankAccounts = useMemberData<BankAccount[]>("/bank-accounts", []);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanItem | null>(null);

  const hasActiveLoan = loans.data.items.some((loan) =>
    ACTIVE_STATUSES.includes(loan.status.toUpperCase()),
  );
  const totalOutstanding = loans.data.items.reduce(
    (sum, item) => sum + (item.remainingBalance || 0),
    0,
  );
  const totalRequested = loans.data.items.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

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

  const guarantorOneOptions: SelectOption[] = guarantors.data.items.map(
    (g) => ({
      id: g.id,
      label: `${g.fullName} / ${g.membershipNumber}`,
    }),
  );

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
    () =>
      bankAccounts.data.find((account) => account.isDefault)?.id ??
      bankAccounts.data[0]?.id ??
      "",
    [bankAccounts.data],
  );

  async function onSubmit(values: LoanFormValues) {
    const endpoint = editingLoan ? `/loans/${editingLoan.id}` : "/loans";
    const method = editingLoan ? api.patch : api.post;

    const result = await apiCallWithAlert({
      title: editingLoan ? "Update Loan Application" : "Loan Application",
      loadingText: editingLoan
        ? "Updating loan application..."
        : "Submitting loan application...",
      apiCall: () =>
        method(endpoint, {
          amount: values.amount,
          tenorMonths: values.tenorMonths,
          purpose: values.purpose,
          guarantorOneId: values.guarantorOneId || undefined,
          guarantorTwoId: values.guarantorTwoId || undefined,
          bankAccountId: values.bankAccountId || undefined,
        }),
      successTitle: editingLoan
        ? "Application Updated"
        : "Application Submitted",
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
        ctaLabel={
          !hasActiveLoan && bankAccounts.data.length
            ? "New application"
            : undefined
        }
        onCtaClick={
          !hasActiveLoan && bankAccounts.data.length
            ? openCreateModal
            : undefined
        }
        icon={<HandCoins className="h-5 w-5" />}
        gradient="from-[#2a1210] via-[#200e0c] to-[#160908]"
      />

      {/* Active loan notice — styled to match the loan card's dark burgundy tone */}
      {hasActiveLoan ? (
        <section className="rounded-[20px] border border-[#3d1a17] bg-[#2a1210] px-4 py-3">
          <h2 className="text-sm font-semibold text-red-300">
            Active loan in progress
          </h2>
          <p className="mt-0.5 text-xs text-red-400/80">
            You have an ongoing loan. Complete your current repayment before
            submitting a new application.
          </p>
        </section>
      ) : bankAccounts.data.length === 0 ? (
        <section className="rounded-[20px] border border-background-200 dark:border-white/8 bg-background-50 dark:bg-background-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-text-900 dark:text-text-50">
            Bank account required
          </h2>
          <p className="mt-0.5 text-xs text-text-400">
            You need a saved bank account before you can apply for a loan. Add
            one in your{" "}
            <Link
              href="/account/bank-account"
              className="font-semibold text-primary-600 dark:text-primary-400 underline"
            >
              Bank Account
            </Link>{" "}
            settings.
          </p>
        </section>
      ) : null}

      {/* Loan list */}
      <section className="space-y-5 mt-5">
        <div>
          <h2 className="text-xl font-semibold font-display tracking-tight text-text-900">
            My loans history
          </h2>
          <p className="text-xs text-text-500">
            All your loan applications and their current repayment status.
          </p>
        </div>

        {loans.data.items.length ? (
          <div className="space-y-2 flex flex-col">
            {loans.data.items.map((loan) => (
              <TransactionCard
                key={loan.id}
                type="LOAN"
                title={loan.purpose}
                subtitle={`${loan.tenorMonths} months${loan.bankAccount ? ` · ${loan.bankAccount.bankName}` : ""}`}
                amount={loan.remainingBalance ?? loan.amount}
                status={loan.status}
                timestamp={new Date().toISOString()}
                href={
                  loan.canEdit || loan.canDelete
                    ? undefined
                    : `/loans/${loan.id}`
                }
                extra={
                  loan.canEdit || loan.canDelete ? (
                    <>
                      {loan.canEdit ? (
                        <button
                          className="rounded-full border border-background-200 dark:border-white/10 px-3 py-1 text-xs font-semibold text-text-700 dark:text-text-200"
                          onClick={(e) => {
                            e.preventDefault();
                            openEditModal(loan);
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                      ) : null}
                      {loan.canDelete ? (
                        <button
                          className="rounded-full border border-red-200 dark:border-red-900 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400"
                          onClick={(e) => {
                            e.preventDefault();
                            void deleteLoan(loan);
                          }}
                          type="button"
                        >
                          Delete
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <Link
                      href={`/loans/${loan.id}`}
                      className="text-xs font-semibold text-primary-600 dark:text-primary-400"
                    >
                      Paid: {formatMoney(loan.amountPaidSoFar ?? 0)}
                    </Link>
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-background-300 dark:border-white/10 px-5 py-10 text-center text-sm text-text-400">
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
        title={editingLoan ? "Edit loan application" : "New loan application"}
        description="Fill in the amount, repayment period, purpose, and the account you want the funds sent to."
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
            formatOptions={{
              style: "currency",
              currency: "NGN",
              maximumFractionDigits: 0,
            }}
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
            className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            type="submit"
          >
            {editingLoan ? "Save changes" : "Submit application"}
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
