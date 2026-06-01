"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Autocomplete, ListBox } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminModal } from "@/components/ui/admin-modal";
import {
  NumberInput,
  SelectInput,
  TextareaInput,
} from "@/components/ui/form-input";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { Banknote, CheckCircle2, Clock3, Plus, Wallet } from "lucide-react";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { ActionMenu } from "@/components/ui/action-menu";

interface BankAccountInfo {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  verifiedAt: string | null;
}

interface LoansResponse {
  items: Array<{
    id: string;
    amount: number;
    remainingBalance: number;
    tenorMonths: number;
    tenorUnit?: "MONTHS" | "WEEKS";
    purpose: string;
    status: string;
    submittedAt: string;
    dueDate?: string | null;
    disbursedAt?: string | null;
    bankAccount?: BankAccountInfo | null;
    member: { fullName: string };
    guarantorOne?: {
      id: string;
      fullName: string;
      membershipNumber: string;
    } | null;
    guarantorTwo?: {
      id: string;
      fullName: string;
      membershipNumber: string;
    } | null;
  }>;
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

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function variantForLoan(status: string) {
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
    default:
      return "neutral";
  }
}

export default function LoansPage() {
  const loans = useApi<LoansResponse>("/loans?limit=1000");
  const members = useApi<MemberSearchResponse>("/members/search");
  const [submitting, setSubmitting] = useState(false);
  const [memberBankAccounts, setMemberBankAccounts] = useState<BankAccountInfo[]>([]);
  const { control, handleSubmit, reset, setValue, watch } = useForm<{
    memberId: string;
    guarantorOneId: string;
    guarantorTwoId: string;
    amount: number | undefined;
    tenorMonths: number | undefined;
    tenorUnit: "MONTHS" | "WEEKS";
    purpose: string;
    bankAccountId: string;
  }>({
    defaultValues: {
      memberId: "",
      guarantorOneId: "",
      guarantorTwoId: "",
      amount: undefined,
      tenorMonths: undefined,
      tenorUnit: "WEEKS",
      purpose: "",
      bankAccountId: "",
    },
  });

  const selectedMemberId = watch("memberId");
  const selectedGuarantorOneId = watch("guarantorOneId");
  const selectedGuarantorTwoId = watch("guarantorTwoId");
  const loanRows = loans.data?.items ?? [];
  const allLoanRows = loanRows;
  const pendingLoans = allLoanRows.filter((item) => item.status === "PENDING");
  const activeLoans = allLoanRows.filter((item) =>
    ["APPROVED", "DISBURSED", "IN_PROGRESS", "OVERDUE"].includes(item.status),
  );
  const completedLoans = allLoanRows.filter((item) => item.status === "COMPLETED");
  const activeAmount = activeLoans.reduce(
    (sum, item) => sum + Number(item.remainingBalance ?? item.amount ?? 0),
    0,
  );

  useEffect(() => {
    if (!selectedMemberId) {
      setMemberBankAccounts([]);
      setValue("bankAccountId", "");
      return;
    }

    let active = true;
    void api
      .get<BankAccountInfo[]>(`/bank-accounts/member/${selectedMemberId}`)
      .then((response) => {
        if (!active) return;
        const accounts = response.data;
        setMemberBankAccounts(accounts);
        const defaultId =
          accounts.find((item) => item.isDefault)?.id ?? accounts[0]?.id ?? "";
        setValue("bankAccountId", defaultId);
      })
      .catch(() => {
        if (!active) return;
        setMemberBankAccounts([]);
        setValue("bankAccountId", "");
      });

    return () => {
      active = false;
    };
  }, [selectedMemberId, setValue]);

  const createLoan = (close?: () => void) =>
    handleSubmit(async (values) => {
      try {
        setSubmitting(true);
        await api.post("/loans", {
          memberId: values.memberId,
          guarantorOneId: values.guarantorOneId || undefined,
          guarantorTwoId: values.guarantorTwoId || undefined,
          amount: Number(values.amount),
          tenorMonths: Number(values.tenorMonths),
          tenorUnit: values.tenorUnit,
          purpose: values.purpose,
          bankAccountId: values.bankAccountId || undefined,
        });
        showSuccessToast("Loan request created successfully.");
        reset();
        await loans.refetch();
        close?.();
      } catch (error: any) {
        showErrorToast(
          error?.response?.data?.message || "Unable to create loan request.",
        );
      } finally {
        setSubmitting(false);
      }
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        actions={
          <AdminModal
            description="Create or update a loan request using the same fields and repayment setup available to members."
            title="New Loan Request"
            trigger={
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white"
                onClick={() => {
                  reset({
                    memberId: "",
                    guarantorOneId: "",
                    guarantorTwoId: "",
                    amount: undefined,
                    tenorMonths: undefined,
                    tenorUnit: "WEEKS",
                    purpose: "",
                    bankAccountId: "",
                  });
                }}
                type="button"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New loan
                </span>
              </button>
            }
          >
            {({ close }) => (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      label: "Member",
                      field: "memberId",
                      selectedKey: selectedMemberId,
                    },
                    {
                      label: "Guarantor 1",
                      field: "guarantorOneId",
                      selectedKey: selectedGuarantorOneId,
                    },
                    {
                      label: "Guarantor 2",
                      field: "guarantorTwoId",
                      selectedKey: selectedGuarantorTwoId,
                    },
                  ].map((entry, index) => (
                    <div
                      className={index === 0 ? "md:col-span-2" : ""}
                      key={entry.field}
                    >
                      <p className="mb-2 text-sm font-medium text-text-900">
                        {entry.label}
                      </p>
                      <Autocomplete
                        onSelectionChange={(key) =>
                          setValue(entry.field as any, key ? String(key) : "")
                        }
                        selectedKey={entry.selectedKey || null}
                      >
                        <Autocomplete.Trigger className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--primary-900)/12] bg-white px-3">
                          <Autocomplete.Value />
                          <Autocomplete.ClearButton className="text-sm text-text-400" />
                          <Autocomplete.Indicator />
                        </Autocomplete.Trigger>
                        <Autocomplete.Popover>
                          <ListBox className="max-h-64 overflow-auto p-2">
                            {(members.data?.items ?? []).map((member) => (
                              <ListBox.Item
                                id={member.id}
                                key={member.id}
                                textValue={member.fullName}
                              >
                                <div className="py-1">
                                  <p className="font-medium text-text-900">
                                    {member.fullName}
                                  </p>
                                  <p className="text-xs text-text-400">
                                    {member.membershipNumber} ·{" "}
                                    {member.phoneNumber}
                                  </p>
                                </div>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Autocomplete.Popover>
                      </Autocomplete>
                    </div>
                  ))}
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Amount"
                    name="amount"
                    placeholder="Amount"
                    min={1000}
                  />
                  <NumberInput
                    className="rounded-2xl"
                    control={control}
                    label="Loan Tenor In Months"
                    name="tenorMonths"
                    placeholder="e.g. 10"
                    min={1}
                  />
                  <SelectInput
                    className="rounded-2xl"
                    control={control}
                    label="Repayment Frequency"
                    name="tenorUnit"
                    options={[
                      { id: "WEEKS", label: "Weekly repayment" },
                      { id: "MONTHS", label: "Monthly repayment" },
                    ]}
                  />
                  <SelectInput
                    className="rounded-2xl md:col-span-2"
                    control={control}
                    label="Disbursement Bank Account"
                    name="bankAccountId"
                    options={memberBankAccounts.map((account) => ({
                      id: account.id,
                      label: `${account.bankName} - ${account.accountNumber}`,
                    }))}
                    description={
                      selectedMemberId && memberBankAccounts.length === 0
                        ? "No bank accounts found for the selected member."
                        : undefined
                    }
                  />
                  <TextareaInput
                    className="rounded-2xl md:col-span-2"
                    control={control}
                    label="Purpose"
                    name="purpose"
                    placeholder="Purpose"
                    rows={5}
                  />
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                    disabled={submitting}
                    onClick={() => void createLoan(close)()}
                    type="button"
                  >
                    {submitting
                      ? "Creating..."
                      : "Create loan"}
                  </button>
                </div>
              </>
            )}
          </AdminModal>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Loan applications waiting for admin review."
          href="/admin/loans"
          icon={<Clock3 className="h-5 w-5" />}
          title="Pending Loans"
          tone={pendingLoans.length ? "amber" : "neutral"}
          value={pendingLoans.length}
        />
        <DashboardMetricCard
          description="Loans currently approved, disbursed, active, or overdue."
          href="/admin/loans"
          icon={<Banknote className="h-5 w-5" />}
          title="Active Loans"
          tone="green"
          value={activeLoans.length}
        />
        <DashboardMetricCard
          description="Outstanding balance across active loans."
          href="/admin/loans"
          icon={<Wallet className="h-5 w-5" />}
          title="Active Loan Amount"
          value={currency.format(activeAmount)}
        />
        <DashboardMetricCard
          description="Loans fully completed by members."
          href="/admin/loans"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Completed Loans"
          value={completedLoans.length}
        />
      </div>

      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (item) => (
              <div>
                <span className="font-semibold text-text-900">
                  {item.member.fullName}
                </span>
              </div>
            ),
          },
          {
            key: "amount",
            header: "Original",
            render: (item) => currency.format(item.amount),
          },
          {
            key: "remaining",
            header: "Remaining",
            render: (item) =>
              currency.format(item.remainingBalance ?? item.amount),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={variantForLoan(item.status) as any}
              />
            ),
          },
          {
            key: "view",
            header: "Actions",
            align: "right",
            isAction: true,
            render: (item) => (
              <ActionMenu
                items={[
                  {
                    label: "View details",
                    onSelect: () => {
                      window.location.href = `/admin/loans/${item.id}`;
                    },
                  },
                ]}
              />
            ),
          },
        ]}
        data={loanRows}
        emptyDescription={loans.error || "No loans are available yet."}
        loading={loans.loading}
      />
    </div>
  );
}
