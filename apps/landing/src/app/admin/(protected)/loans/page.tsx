"use client";

import { useState } from "react";
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
    tenorMonths: number;
    purpose: string;
    status: string;
    disbursedAt?: string | null;
    member: { fullName: string };
  }>;
}

interface MemberSearchResponse {
  items: Array<{
    id: string;
    fullName: string;
    membershipNumber: string;
    email: string;
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function LoansPage() {
  const loans = useApi<LoansResponse>("/loans");
  const members = useApi<MemberSearchResponse>("/members/search");
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, reset, setValue, watch } = useForm<{
    memberId: string;
    amount: number | undefined;
    tenorMonths: number | undefined;
    purpose: string;
  }>({
    defaultValues: {
      memberId: "",
      amount: undefined,
      tenorMonths: undefined,
      purpose: "",
    },
  });

  const selectedMemberId = watch("memberId");

  const createLoan = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await api.post("/loans", {
        memberId: values.memberId,
        amount: Number(values.amount),
        tenorMonths: Number(values.tenorMonths),
        purpose: values.purpose,
      });
      showSuccessToast("Loan request created successfully.");
      reset();
      await loans.refetch();
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
        subtitle="Monitor applications, approvals, and disbursements with direct access to each loan record."
        actions={
          <AdminModal
            description="Create a loan request directly for an existing member from the admin workspace."
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-medium text-[var(--color-dark)]">Member</p>
                <Autocomplete onSelectionChange={(key) => setValue("memberId", key ? String(key) : "")} selectedKey={selectedMemberId || null}>
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
                                {member.membershipNumber} · {member.email}
                              </p>
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                    </ListBox>
                  </Autocomplete.Popover>
                </Autocomplete>
              </div>
              <NumberInput className="rounded-2xl" control={control} label="Amount" name="amount" placeholder="Amount" min={1000} />
              <NumberInput className="rounded-2xl" control={control} label="Tenor Months" name="tenorMonths" placeholder="Tenor months" min={1} />
              <TextareaInput className="rounded-2xl md:col-span-2" control={control} label="Purpose" name="purpose" placeholder="Purpose" rows={5} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white" isDisabled={submitting} onPress={() => void createLoan()}>
                {submitting ? "Creating..." : "Create loan"}
              </Button>
            </div>
          </AdminModal>
        }
      />
      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.member.fullName}</span>,
          },
          {
            key: "amount",
            header: "Amount",
            render: (item) => currency.format(item.amount),
          },
          {
            key: "tenor",
            header: "Tenor",
            render: (item) => `${item.tenorMonths} months`,
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.disbursedAt ? "DISBURSED" : item.status}
                variant={item.disbursedAt ? "success" : item.status === "REJECTED" ? "danger" : item.status === "APPROVED" ? "success" : "warning"}
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
