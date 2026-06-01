"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Autocomplete, ListBox } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminModal } from "@/components/ui/admin-modal";
import { ActionMenu } from "@/components/ui/action-menu";
import { SelectInput, TextInput } from "@/components/ui/form-input";
import { useApi } from "@/hooks/useApi";
import api, { uploadAdminImage } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { CheckCircle2, Clock3, Eye, Pencil, Users, Wallet } from "lucide-react";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";

interface MembersResponse {
  items: Array<{
    id: string;
    fullName: string;
    membershipNumber: string;
    phoneNumber: string;
    homeAddress: string;
    stateOfOrigin: string;
    occupation: string;
    address?: string | null;
    avatarUrl?: string | null;
    dateOfBirth: string;
    identificationNumber: string;
    identificationPicture: string;
    identificationType: string;
    maritalStatus: string;
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

type MemberRow = MembersResponse["items"][number];

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

const statusOptions = ["ACTIVE", "INACTIVE", "SUSPENDED", "WITHDRAWN"];

const memberFormDefaults: MemberFormValues = {
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
};

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "INACTIVE") return "warning";
  if (status === "SUSPENDED" || status === "WITHDRAWN") return "danger";
  return "neutral";
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function memberToFormValues(member: MemberRow): MemberFormValues {
  return {
    email: member.user.email,
    fullName: member.fullName,
    phoneNumber: member.phoneNumber,
    homeAddress: member.homeAddress ?? member.address ?? "",
    stateOfOrigin: member.stateOfOrigin ?? "",
    dateOfBirth: toDateInputValue(member.dateOfBirth),
    occupation: member.occupation ?? "",
    maritalStatus: member.maritalStatus ?? "SINGLE",
    identificationNumber: member.identificationNumber ?? "",
    identificationPicture: member.identificationPicture ?? "",
    identificationType: member.identificationType ?? "NIN",
    referrerId: member.referrer?.id ?? "",
  };
}

export default function MembersPage() {
  const [submitting, setSubmitting] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [statusMember, setStatusMember] = useState<MemberRow | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("ACTIVE");
  const members = useApi<MembersResponse>("/members");
  const memberSearch = useApi<MemberSearchResponse>("/members/search");
  const memberRows = members.data?.items ?? [];
  const activeMembers = memberRows.filter((item) => item.status === "ACTIVE");
  const pendingMembers = memberRows.filter((item) => item.status === "PENDING");
  const totalWalletBalance = memberRows.reduce(
    (sum, item) => sum + Number(item.wallet?.availableBalance ?? 0),
    0,
  );
  const { control, handleSubmit, reset, setValue, watch } =
    useForm<MemberFormValues>({
      defaultValues: memberFormDefaults,
    });

  const selectedReferrerId = watch("referrerId");
  const identificationPicture = watch("identificationPicture");
  const referrerOptions = (memberSearch.data?.items ?? []).filter(
    (member) => member.id !== editingMember?.id,
  );

  async function onUploadIdPicture(file?: File | null) {
    if (!file) return;

    try {
      const response = await uploadAdminImage(file, "member-id");
      setValue("identificationPicture", response.url);
      showSuccessToast("Image compressed and uploaded successfully.");
    } catch (error: any) {
      showErrorToast(error?.message || "Unable to upload identification image.");
    }
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

  const updateMember = (close?: () => void) =>
    handleSubmit(async (values) => {
      if (!editingMember) return;
      const { identificationNumber: _identificationNumber, ...payload } = values;

      try {
        setSubmitting(true);
        await api.patch(`/members/${editingMember.id}`, {
          ...payload,
          referrerId: payload.referrerId || "",
        });
        showSuccessToast("Member details updated successfully.");
        setEditingMember(null);
        reset(memberFormDefaults);
        await members.refetch();
        close?.();
      } catch (error: any) {
        showErrorToast(
          error?.response?.data?.message || "Unable to update member.",
        );
      } finally {
        setSubmitting(false);
      }
    });

  function openEditMember(member: MemberRow) {
    setEditingMember(member);
    reset(memberToFormValues(member));
  }

  function closeEditMember() {
    setEditingMember(null);
    reset(memberFormDefaults);
  }

  function openStatusMember(member: MemberRow) {
    setStatusMember(member);
    setSelectedStatus(member.status || "ACTIVE");
  }

  async function updateMemberStatus(close?: () => void) {
    if (!statusMember) return;

    try {
      setUpdatingStatus(true);
      await api.patch(`/members/${statusMember.id}/status`, {
        status: selectedStatus,
      });
      showSuccessToast(`Member status updated to ${selectedStatus.toLowerCase()}.`);
      setStatusMember(null);
      await members.refetch();
      close?.();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to update member status.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function resetMemberPassword(member: MemberRow) {
    try {
      const response = await api.post(`/members/${member.id}/reset-password`);
      showSuccessToast(
        `Password reset to ${response.data.maskedResetTo ?? "the member phone number"}.`,
      );
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to reset password.",
      );
    }
  }

  function memberActions(member: MemberRow) {
    return [
      {
        label: "Reset password",
        tone: "success" as const,
        confirmTitle: "Reset this member's password?",
        confirmMessage: `This will reset the password to ${member.phoneNumber}.`,
        onSelect: () => resetMemberPassword(member),
      },
      {
        label: "Edit status",
        onSelect: () => openStatusMember(member),
      },
      {
        label: "Edit member",
        onSelect: () => openEditMember(member),
      },
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        actions={
          <AdminModal
            description="Create a member account. Their initial password will be set to their 11-digit phone number."
            title="Add Member"
            trigger={
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white"
                onClick={() => {
                  setEditingMember(null);
                  reset(memberFormDefaults);
                }}
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
                          {referrerOptions.map((member) => (
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="All registered cooperative members."
          href="/admin/members"
          icon={<Users className="h-5 w-5" />}
          title="Total Members"
          tone="green"
          value={memberRows.length}
        />
        <DashboardMetricCard
          description="Members currently active in the cooperative."
          href="/admin/members"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Active Members"
          value={activeMembers.length}
        />
        <DashboardMetricCard
          description="Member records waiting for attention."
          href="/admin/members"
          icon={<Clock3 className="h-5 w-5" />}
          title="Pending Members"
          tone={pendingMembers.length ? "amber" : "neutral"}
          value={pendingMembers.length}
        />
        <DashboardMetricCard
          description="Total balance held in member wallets."
          href="/admin/members"
          icon={<Wallet className="h-5 w-5" />}
          title="Wallet Holdings"
          value={currency.format(totalWalletBalance)}
        />
      </div>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Member",
            render: (item) => (
              <div className="min-w-0">
                <p className="break-words font-semibold text-text-900">
                  {item.fullName}
                </p>
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
            key: "actions",
            header: "Actions",
            align: "right",
            isAction: true,
            render: (item) => (
              <div className="inline-flex items-center justify-end gap-2">
                <button
                  aria-label={`View ${item.fullName}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-900/12 bg-white text-text-700 transition hover:bg-background-100"
                  onClick={() => {
                    window.location.href = `/admin/members/${item.id}`;
                  }}
                  type="button"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <ActionMenu
                  ariaLabel={`Edit ${item.fullName}`}
                  icon={<Pencil className="h-4 w-4" />}
                  items={memberActions(item)}
                />
              </div>
            ),
          },
        ]}
        data={memberRows}
        emptyDescription={members.error || "No members found yet."}
        loading={members.loading}
      />

      <AdminModal
        description="Update this member's account and profile details."
        isOpen={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) closeEditMember();
        }}
        title={`Edit ${editingMember?.fullName ?? "Member"}`}
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
                description="Must be exactly 11 digits and start with 0."
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
                  htmlFor="edit-member-dob"
                >
                  Date of birth
                </label>
                <input
                  id="edit-member-dob"
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
                isDisabled
                description="Identification number cannot be changed from this form."
              />

              <div className="space-y-2 md:col-span-2">
                <label
                  className="text-sm font-medium text-text-900"
                  htmlFor="edit-member-id-picture"
                >
                  Identification picture
                </label>
                <input
                  id="edit-member-id-picture"
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
                      {referrerOptions.map((member) => (
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
                              {member.membershipNumber} Â· {member.phoneNumber}
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
                onClick={() => void updateMember(close)()}
                type="button"
              >
                {submitting ? "Saving..." : "Save member"}
              </button>
            </div>
          </>
        )}
      </AdminModal>

      <AdminModal
        description="Select the new membership status for this member."
        isOpen={Boolean(statusMember)}
        onOpenChange={(open) => {
          if (!open) setStatusMember(null);
        }}
        title={`Edit status${statusMember ? ` for ${statusMember.fullName}` : ""}`}
      >
        {({ close }) => (
          <div className="space-y-4">
            <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4 text-sm text-text-900">
              Current status:{" "}
              <span className="font-semibold">
                {(statusMember?.status || "UNKNOWN").replaceAll("_", " ")}
              </span>
            </div>
            <select
              className="min-h-12 w-full rounded-2xl border border-[var(--primary-900)/12] px-4 text-sm text-text-900 outline-none"
              onChange={(event) => setSelectedStatus(event.target.value)}
              value={selectedStatus}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white"
                disabled={updatingStatus}
                onClick={() => void updateMemberStatus(close)}
                type="button"
              >
                {updatingStatus ? "Saving..." : "Save status"}
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
