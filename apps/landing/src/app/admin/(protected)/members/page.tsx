"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Autocomplete, ListBox } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminModal } from "@/components/ui/admin-modal";
import { SelectInput, TextInput } from "@/components/ui/form-input";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface MembersResponse {
  items: Array<{
    id: string;
    fullName: string;
    membershipNumber: string;
    phoneNumber: string;
    homeAddress: string;
    stateOfOrigin: string;
    occupation: string;
    identificationType: string;
    status: string;
    referrer?: {
      id: string;
      fullName: string;
      membershipNumber: string;
    } | null;
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
    phoneNumber: string;
  }>;
}

interface MemberFormValues {
  email: string;
  fullName: string;
  phoneNumber: string;
  homeAddress: string;
  stateOfOrigin: string;
  dateOfBirth: string;
  occupation: string;
  maritalStatus: string;
  identificationNumber: string;
  identificationPicture: string;
  identificationType: string;
  referrerId: string;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const statusOptions = [
  { id: "ALL", label: "All" },
  { id: "ACTIVE", label: "Active" },
  { id: "INACTIVE", label: "Inactive" },
  { id: "SUSPENDED", label: "Suspended" },
  { id: "WITHDRAWN", label: "Withdrawn" },
];

const maritalStatusOptions = [
  { id: "SINGLE", label: "Single" },
  { id: "MARRIED", label: "Married" },
  { id: "DIVORCED", label: "Divorced" },
  { id: "WIDOWED", label: "Widowed" },
];

const identificationTypeOptions = [
  { id: "VOTERS_CARD", label: "Voter's Card" },
  { id: "NIN", label: "NIN" },
  { id: "NATIONAL_PASSPORT", label: "National Passport" },
];

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "warning";
  if (status === "SUSPENDED" || status === "WITHDRAWN") return "danger";
  return "neutral";
}

export default function MembersPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const membersUrl = useMemo(
    () =>
      statusFilter === "ALL" ? "/members" : `/members?status=${statusFilter}`,
    [statusFilter],
  );
  const members = useApi<MembersResponse>(membersUrl);
  const memberSearch = useApi<MemberSearchResponse>("/members/search");
  const { control, handleSubmit, reset, setValue, watch } =
    useForm<MemberFormValues>({
      defaultValues: {
        email: "",
        fullName: "",
        phoneNumber: "",
        homeAddress: "",
        stateOfOrigin: "",
        dateOfBirth: "",
        occupation: "",
        maritalStatus: "SINGLE",
        identificationNumber: "",
        identificationPicture: "",
        identificationType: "NIN",
        referrerId: "",
      },
    });

  const selectedReferrerId = watch("referrerId");
  const identificationPicture = watch("identificationPicture");

  async function onUploadIdPicture(file?: File | null) {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("scope", "member-id");

    const response = await api.post("/uploads/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    setValue("identificationPicture", response.data.url);
  }

  const createMember = (close?: () => void) =>
    handleSubmit(async (values) => {
      try {
        setSubmitting(true);
        await api.post("/members", {
          ...values,
          referrerId: values.referrerId || undefined,
        });
        showSuccessToast(
          "Member created successfully. Default password is now the phone number.",
        );
        reset();
        await members.refetch();
        close?.();
      } catch (error: any) {
        showErrorToast(
          error?.response?.data?.message || "Unable to create member.",
        );
      } finally {
        setSubmitting(false);
      }
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        subtitle="Manage registration, status, identity details, and direct access to each member record."
        actions={
          <AdminModal
            description="Create a member account. Their initial password will be set to their 11-digit phone number."
            title="Add Member"
            trigger={
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white"
                type="button"
              >
                Add member
              </button>
            }
          >
            {({ close }) => (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput
                    className="rounded-2xl"
                    control={control}
                    label="Full name"
                    name="fullName"
                    placeholder="Member full name"
                  />
                  <TextInput
                    className="rounded-2xl"
                    control={control}
                    description="Must be exactly 11 digits and start with 0. This becomes the default password."
                    label="Phone number"
                    name="phoneNumber"
                    placeholder="08012345678"
                    type="tel"
                  />
                  <TextInput
                    className="rounded-2xl md:col-span-2"
                    control={control}
                    label="Email"
                    name="email"
                    placeholder="Email address"
                    type="email"
                  />
                  <TextInput
                    className="rounded-2xl md:col-span-2"
                    control={control}
                    label="Home address"
                    name="homeAddress"
                    placeholder="Full residential address"
                  />
                  <TextInput
                    className="rounded-2xl"
                    control={control}
                    label="State of origin"
                    name="stateOfOrigin"
                    placeholder="e.g. Oyo"
                  />
                  <TextInput
                    className="rounded-2xl"
                    control={control}
                    label="Occupation"
                    name="occupation"
                    placeholder="Occupation"
                  />
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-text-900"
                      htmlFor="member-dob"
                    >
                      Date of birth
                    </label>
                    <input
                      id="member-dob"
                      className="min-h-12 w-full rounded-2xl border border-[var(--primary-900)/12] px-4 text-sm outline-none"
                      onChange={(event) =>
                        setValue("dateOfBirth", event.target.value)
                      }
                      type="date"
                      value={watch("dateOfBirth")}
                    />
                  </div>
                  <SelectInput
                    className="rounded-2xl"
                    control={control}
                    label="Marital status"
                    name="maritalStatus"
                    options={maritalStatusOptions}
                  />
                  <SelectInput
                    className="rounded-2xl"
                    control={control}
                    label="Identification type"
                    name="identificationType"
                    options={identificationTypeOptions}
                  />
                  <TextInput
                    className="rounded-2xl"
                    control={control}
                    label="Identification number"
                    name="identificationNumber"
                    placeholder="NIN, passport, or voter card number"
                  />

                  <div className="space-y-2 md:col-span-2">
                    <label
                      className="text-sm font-medium text-text-900"
                      htmlFor="member-id-picture"
                    >
                      Identification picture
                    </label>
                    <input
                      id="member-id-picture"
                      accept="image/*"
                      className="block w-full rounded-2xl border border-[var(--primary-900)/12] px-4 py-3 text-sm"
                      onChange={(event) =>
                        void onUploadIdPicture(event.target.files?.[0])
                      }
                      type="file"
                    />
                    {identificationPicture ? (
                      <img
                        alt="Identification preview"
                        className="h-28 rounded-2xl border border-[var(--primary-900)/8] object-cover"
                        src={identificationPicture}
                      />
                    ) : (
                      <p className="text-xs text-text-400">
                        Upload a clear image of the identification document.
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <p className="mb-2 text-sm font-medium text-text-900">
                      Referrer
                    </p>
                    <Autocomplete
                      onSelectionChange={(key) =>
                        setValue("referrerId", key ? String(key) : "")
                      }
                      selectedKey={selectedReferrerId || null}
                    >
                      <Autocomplete.Trigger className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--primary-900)/12] bg-white px-3">
                        <Autocomplete.Value />
                        <Autocomplete.ClearButton className="text-sm text-text-400" />
                        <Autocomplete.Indicator />
                      </Autocomplete.Trigger>
                      <Autocomplete.Popover>
                        <ListBox className="max-h-64 overflow-auto p-2">
                          {(memberSearch.data?.items ?? []).map((member) => (
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
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                    disabled={submitting}
                    onClick={() => void createMember(close)()}
                    type="button"
                  >
                    {submitting ? "Creating..." : "Create member"}
                  </button>
                </div>
              </>
            )}
          </AdminModal>
        }
      />

      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => (
          <button
            key={option.id}
            className={
              statusFilter === option.id
                ? "rounded-full bg-[var(--text-900)] px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-text-900"
            }
            onClick={() => setStatusFilter(String(option.id))}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Member",
            render: (item) => (
              <div>
                <p className="font-semibold text-text-900">{item.fullName}</p>
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
            key: "identity",
            header: "Identity",
            render: (item) => (
              <div>
                <p className="font-medium text-text-900">
                  {item.identificationType.replaceAll("_", " ")}
                </p>
                <p className="text-xs text-text-400">{item.stateOfOrigin}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={statusVariant(item.status) as any}
              />
            ),
          },
          {
            key: "wallet",
            header: "Wallet",
            render: (item) =>
              currency.format(item.wallet?.availableBalance ?? 0),
          },
          {
            key: "view",
            header: "View",
            render: (item) => (
              <Link
                className="font-semibold text-[var(--primary-700)]"
                href={`/admin/members/${item.id}`}
              >
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
