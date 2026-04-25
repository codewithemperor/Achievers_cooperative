"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Autocomplete, Button, ListBox } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminModal } from "@/components/ui/admin-modal";
import { TextInput } from "@/components/ui/form-input";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface MembersResponse {
  items: Array<{
    id: string;
    fullName: string;
    membershipNumber: string;
    phoneNumber: string;
    status: string;
    referrer?: { id: string; fullName: string; membershipNumber: string } | null;
    user: { email: string; role: string };
    wallet: { availableBalance: number; currency: string } | null;
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

export default function MembersPage() {
  const members = useApi<MembersResponse>("/members");
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const memberSearch = useApi<MemberSearchResponse>("/members/search");
  const { control, handleSubmit, reset, setValue, watch } = useForm<{
    email: string;
    fullName: string;
    phoneNumber: string;
    referrerId: string;
  }>({
    defaultValues: {
      email: "",
      fullName: "",
      phoneNumber: "",
      referrerId: "",
    },
  });

  const selectedReferrerId = watch("referrerId");

  const createMember = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      const response = await api.post("/members", {
        email: values.email,
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        referrerId: values.referrerId || undefined,
      });
      setActivationCode(response.data.activationCode ?? null);
      showSuccessToast("Member created successfully.");
      reset();
      await members.refetch();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to create member.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="Searchable member directory with wallet visibility and direct links into each member record."
        actions={
          <AdminModal
            description="Create a new member profile and optionally connect them to an existing referrer."
            title="Add Member"
            trigger={
              <button
                className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white"
                type="button"
              >
                Add member
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput className="rounded-2xl" control={control} label="Name" name="fullName" placeholder="Full name" />
              <TextInput className="rounded-2xl" control={control} label="Phone" name="phoneNumber" placeholder="Phone number" type="tel" />
              <TextInput className="rounded-2xl md:col-span-2" control={control} label="Email" name="email" placeholder="Email address" type="email" />
              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-medium text-[var(--color-dark)]">Referrer</p>
                <Autocomplete onSelectionChange={(key) => setValue("referrerId", key ? String(key) : "")} selectedKey={selectedReferrerId || null}>
                  <Autocomplete.Trigger className="flex min-h-12 items-center gap-3 rounded-2xl border border-[rgba(26,46,26,0.12)] bg-white px-3">
                    <Autocomplete.Value />
                    <Autocomplete.ClearButton className="text-sm text-[var(--color-coop-muted)]" />
                    <Autocomplete.Indicator />
                  </Autocomplete.Trigger>
                  <Autocomplete.Popover>
                    <ListBox className="max-h-64 overflow-auto p-2">
                      {(memberSearch.data?.items ?? []).map((member) => (
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
            </div>

            {activationCode ? (
              <div className="mt-4 rounded-[1.25rem] bg-[rgba(245,240,232,0.72)] p-4 text-sm text-[var(--color-dark)]">
                Activation code for the newly created member: <span className="font-semibold">{activationCode}</span>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <Button
                className="rounded-full bg-[var(--color-green)] px-5 py-3 text-sm font-semibold text-white"
                isDisabled={submitting}
                onPress={() => void createMember()}
              >
                {submitting ? "Creating..." : "Create member"}
              </Button>
            </div>
          </AdminModal>
        }
      />

      <DataTable
        columns={[
          {
            key: "name",
            header: "Member",
            render: (item) => (
              <div>
                <p className="font-semibold text-[var(--color-dark)]">{item.fullName}</p>
                <p className="text-xs">{item.membershipNumber}</p>
              </div>
            ),
          },
          {
            key: "contact",
            header: "Contact",
            render: (item) => (
              <div>
                <p>{item.user.email}</p>
                <p className="text-xs">{item.phoneNumber}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={item.status === "ACTIVE" ? "success" : item.status === "PENDING" ? "warning" : "danger"}
              />
            ),
          },
          {
            key: "wallet",
            header: "Wallet",
            render: (item) => currency.format(item.wallet?.availableBalance ?? 0),
          },
          {
            key: "view",
            header: "View",
            render: (item) => (
              <Link className="font-semibold text-[var(--color-green)]" href={`/admin/members/${item.id}`}>
                Open profile
              </Link>
            ),
          },
        ]}
        data={members.data?.items ?? []}
        emptyDescription={members.error || "No members found yet."}
        loading={members.loading}
      />
    </div>
  );
}
