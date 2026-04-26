"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Autocomplete, Button, ListBox } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminModal } from "@/components/ui/admin-modal";
import { NumberInput, TextareaInput } from "@/components/ui/form-input";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface LoansResponse {
  items: Array<{
    id: string;
    amount: number;
    remainingBalance: number;
    tenorMonths: number;
    purpose: string;
    status: string;
    lifecycleStatus?: string;
    disbursedAt?: string | null;
    member: { fullName: string };
    guarantorOne?: { id: string; fullName: string; membershipNumber: string } | null;
    guarantorTwo?: { id: string; fullName: string; membershipNumber: string } | null;
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

const tabs = ["ALL", "PENDING", "APPROVED", "REJECTED"];

function variantForLoan(status: string) {
  if (status === "APPROVED" || status === "DISBURSED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export default function LoansPage() {
  const [activeTab, setActiveTab] = useState("ALL");
  const loansUrl = useMemo(
    () => (activeTab === "ALL" ? "/loans" : `/loans?status=${activeTab}`),
    [activeTab],
  );
  const loans = useApi<LoansResponse>(loansUrl);
  const members = useApi<MemberSearchResponse>("/members/search");
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, reset, setValue, watch } = useForm<{
    memberId: string;
    guarantorOneId: string;
    guarantorTwoId: string;
    amount: number | undefined;
    tenorMonths: number | undefined;
    purpose: string;
  }>({
    defaultValues: {
      memberId: "",
      guarantorOneId: "",
      guarantorTwoId: "",
      amount: undefined,
      tenorMonths: undefined,
      purpose: "",
    },
  });

  const selectedMemberId = watch("memberId");
  const selectedGuarantorOneId = watch("guarantorOneId");
  const selectedGuarantorTwoId = watch("guarantorTwoId");

  const createLoan = (close?: () => void) => handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await api.post("/loans", {
        memberId: values.memberId,
        guarantorOneId: values.guarantorOneId || undefined,
        guarantorTwoId: values.guarantorTwoId || undefined,
        amount: Number(values.amount),
        tenorMonths: Number(values.tenorMonths),
        purpose: values.purpose,
      });
      showSuccessToast("Loan request created successfully.");
      reset();
      await loans.refetch();
      close?.();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to create loan request.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        subtitle="Filter by status, track repayment balance, and capture optional guarantors during application."
        actions={
          <AdminModal
            description="Create a loan request directly for an existing member. Guarantors are optional but cannot duplicate the applicant or each other."
            title="New Loan Request"
            trigger={
              <button
                className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white"
                type="button"
              >
                New loan
              </button>
            }
          >
            {({ close }) => (
              <>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: "Member", field: "memberId", selectedKey: selectedMemberId },
                { label: "Guarantor 1", field: "guarantorOneId", selectedKey: selectedGuarantorOneId },
                { label: "Guarantor 2", field: "guarantorTwoId", selectedKey: selectedGuarantorTwoId },
              ].map((entry, index) => (
                <div className={index === 0 ? "md:col-span-2" : ""} key={entry.field}>
                  <p className="mb-2 text-sm font-medium text-[var(--color-dark)]">{entry.label}</p>
                  <Autocomplete onSelectionChange={(key) => setValue(entry.field as any, key ? String(key) : "")} selectedKey={entry.selectedKey || null}>
                    <Autocomplete.Trigger className="flex min-h-12 items-center gap-3 rounded-2xl border border-[rgba(26,46,26,0.12)] bg-white px-3">
                      <Autocomplete.Value />
                      <Autocomplete.ClearButton className="text-sm text-[var(--color-coop-muted)]" />
                      <Autocomplete.Indicator />
                    </Autocomplete.Trigger>
                    <Autocomplete.Popover>
                      <ListBox className="max-h-64 overflow-auto p-2">
                        {(members.data?.items ?? []).map((member) => (
                          <ListBox.Item id={member.id} key={member.id} textValue={member.fullName}>
                            <div className="py-1">
                              <p className="font-medium text-[var(--color-dark)]">{member.fullName}</p>
                              <p className="text-xs text-[var(--color-coop-muted)]">
                                {member.membershipNumber} · {member.phoneNumber}
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
              <NumberInput className="rounded-2xl" control={control} label="Amount" name="amount" placeholder="Amount" min={1000} />
              <NumberInput className="rounded-2xl" control={control} label="Tenor Months" name="tenorMonths" placeholder="Tenor months" min={1} />
              <TextareaInput className="rounded-2xl md:col-span-2" control={control} label="Purpose" name="purpose" placeholder="Purpose" rows={5} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white" isDisabled={submitting} onPress={() => void createLoan(close)()}>
                {submitting ? "Creating..." : "Create loan"}
              </Button>
            </div>
              </>
            )}
          </AdminModal>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={
              activeTab === tab
                ? "rounded-full bg-[var(--color-dark)] px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-[rgba(26,46,26,0.12)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-dark)]"
            }
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab === "ALL" ? "All" : tab.toLowerCase()}
          </button>
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.member.fullName}</span>,
          },
          {
            key: "amount",
            header: "Original",
            render: (item) => currency.format(item.amount),
          },
          {
            key: "remaining",
            header: "Remaining",
            render: (item) => currency.format(item.remainingBalance ?? item.amount),
          },
          {
            key: "guarantors",
            header: "Guarantors",
            render: (item) => (
              <div className="text-sm">
                <p>{item.guarantorOne?.fullName || "None"}</p>
                <p className="text-[var(--color-coop-muted)]">{item.guarantorTwo?.fullName || "None"}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
              render: (item) => (
              <StatusBadge
                status={item.lifecycleStatus || (item.disbursedAt ? "DISBURSED" : item.status)}
                variant={variantForLoan(item.lifecycleStatus || (item.disbursedAt ? "DISBURSED" : item.status)) as any}
              />
            ),
          },
          {
            key: "view",
            header: "View",
            render: (item) => (
              <Link className="font-semibold text-[var(--color-green)]" href={`/admin/loans/${item.id}`}>
                Loan detail
              </Link>
            ),
          },
        ]}
        data={loans.data?.items ?? []}
        emptyDescription={loans.error || "No loans are available yet."}
        loading={loans.loading}
      />
    </div>
  );
}
