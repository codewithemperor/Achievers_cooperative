"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  CreditCard,
  Landmark,
  Pencil,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { useApi } from "@/hooks/useApi";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { AdminModal } from "@/components/ui/admin-modal";
import { ActionMenu } from "@/components/ui/action-menu";
import {
  AutocompleteInput,
  SelectInput,
  TextInput,
} from "@/components/ui/form-input";
import api, { uploadAdminImage } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface MemberDetail {
  id: string;
  fullName: string;
  membershipNumber: string;
  phoneNumber: string;
  address?: string | null;
  homeAddress: string;
  stateOfOrigin: string;
  dateOfBirth: string;
  occupation: string;
  maritalStatus: string;
  identificationNumber: string;
  identificationPicture: string;
  identificationType: string;
  status: string;
  joinedAt: string;
  avatarUrl?: string | null;
  referrer?: { id: string; fullName: string; membershipNumber: string } | null;
  user: { email: string; role: string };
  wallet: {
    availableBalance: number;
    pendingBalance: number;
    currency: string;
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      reference?: string | null;
      createdAt?: string;
    }>;
  } | null;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    netCreditAmount?: number | null;
  }>;
  savingsAccounts?: Array<{
    id: string;
    balance: number;
    contributionFrequency?: string;
  }>;
  loanApplications: Array<{
    id: string;
    amount: number;
    remainingBalance: number;
    purpose: string;
    status: string;
    submittedAt?: string | null;
    createdAt?: string | null;
    disbursedAt?: string | null;
    guarantorOne?: { fullName: string } | null;
    guarantorTwo?: { fullName: string } | null;
  }>;
  investments: Array<{
    id: string;
    principal: number;
    status: string;
    createdAt?: string | null;
    maturityDate?: string | null;
    product: { id: string; name: string };
  }>;
  packageSubscriptions?: Array<{
    id: string;
    amountPaid: number;
    amountRemaining: number;
    penaltyAccrued: number;
    status: string;
    createdAt?: string | null;
    completedAt?: string | null;
    package: { id: string; name: string; totalAmount: number };
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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const statusOptions = ["ACTIVE", "INACTIVE", "SUSPENDED", "WITHDRAWN"];
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

function formatShortDate(value?: string | null) {
  if (!value) return "No date recorded";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function memberToFormValues(member: MemberDetail): MemberFormValues {
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

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-primary-900/10 bg-white p-5 shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)] sm:p-6">
      <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FinancialRecordCard({
  icon,
  title,
  subtitle,
  amount,
  status,
  tone = "neutral",
  href,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  amount?: string;
  status?: string;
  tone?: "green" | "amber" | "blue" | "red" | "neutral";
  href?: string;
}) {
  const tones = {
    green: "bg-[var(--primary-50)] text-[var(--primary-700)]",
    amber: "bg-[#fff7e6] text-[#9a5b00]",
    blue: "bg-[#eef4ff] text-[#175cd3]",
    red: "bg-[#fff1f0] text-[#b42318]",
    neutral: "bg-background-100 text-text-700",
  };

  const content = (
    <div className="flex w-full min-w-0 items-start gap-3 rounded-2xl border border-primary-900/10 bg-white p-3 transition hover:border-primary-700/30 dark:border-[var(--background-800)] dark:bg-[var(--background-900)] sm:p-4">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-text-900 dark:text-text-50">
              {title}
            </p>
            <p className="mt-1 break-words text-xs text-text-400">{subtitle}</p>
          </div>
          {status ? (
            <StatusBadge status={status} variant={statusVariant(status) as any} />
          ) : null}
        </div>
        {amount ? (
          <p className="mt-3 break-words text-xs font-medium text-text-700 dark:text-text-200 sm:text-sm">
            {amount}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link className="block min-w-0" href={href}>
      {content}
    </Link>
  );
}

function statusVariant(status?: string) {
  if (status === "ACTIVE" || status === "APPROVED") return "success";
  if (status === "INACTIVE" || status === "PENDING") return "warning";
  if (status === "SUSPENDED" || status === "WITHDRAWN" || status === "REJECTED")
    return "danger";
  return "info";
}

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const member = useApi<MemberDetail>(`/members/${params.id}`);
  const memberSearch = useApi<MemberSearchResponse>("/members/search");
  const [resetting, setResetting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingMember, setUpdatingMember] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("ACTIVE");
  const { control, handleSubmit, reset, setValue, watch } =
    useForm<MemberFormValues>({
      defaultValues: memberFormDefaults,
    });
  const savingsTotal = (member.data?.savingsAccounts ?? []).reduce(
    (sum, account) => sum + Number(account.balance ?? 0),
    0,
  );
  const walletBalance = Number(member.data?.wallet?.availableBalance ?? 0);
  const walletHasDebt = walletBalance < 0;
  const identificationPicture = watch("identificationPicture");
  const referrerOptions = (memberSearch.data?.items ?? []).filter(
    (item) => item.id !== member.data?.id,
  ).map((item) => ({
    id: item.id,
    label: item.fullName,
    description: `${item.membershipNumber} - ${item.phoneNumber}`,
    searchText: `${item.fullName} ${item.membershipNumber} ${item.phoneNumber} ${item.email}`,
  }));

  function openEditMember() {
    if (!member.data) return;
    reset(memberToFormValues(member.data));
    setEditModalOpen(true);
  }

  function openStatusModal() {
    setSelectedStatus(member.data?.status || "ACTIVE");
    setStatusModalOpen(true);
  }

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

  async function resetPassword() {
    try {
      setResetting(true);
      const response = await api.post(`/members/${params.id}/reset-password`);
      showSuccessToast(
        `Password reset to ${response.data.maskedResetTo ?? "the member phone number"}.`,
      );
      await member.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to reset password.",
      );
    } finally {
      setResetting(false);
    }
  }

  async function updateStatus(status: string) {
    try {
      setUpdatingStatus(true);
      await api.patch(`/members/${params.id}/status`, { status });
      showSuccessToast(`Member status updated to ${status.toLowerCase()}.`);
      await member.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to update member status.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  const updateMember = (close?: () => void) =>
    handleSubmit(async (values) => {
      const { identificationNumber: _identificationNumber, ...payload } = values;

      try {
        setUpdatingMember(true);
        await api.patch(`/members/${params.id}`, {
          ...payload,
          referrerId: payload.referrerId || "",
        });
        showSuccessToast("Member details updated successfully.");
        await member.refetch();
        close?.();
      } catch (error: any) {
        showErrorToast(
          error?.response?.data?.message || "Unable to update member.",
        );
      } finally {
        setUpdatingMember(false);
      }
    });

  const detailActions = [
    {
      label: "Reset password",
      tone: "success" as const,
      confirmTitle: "Reset this member's password?",
      confirmMessage: `This will reset the password to ${member.data?.phoneNumber ?? "the member phone number"}.`,
      onSelect: resetPassword,
    },
    {
      label: "Edit status",
      onSelect: openStatusModal,
    },
    {
      label: "Edit member",
      onSelect: openEditMember,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.data?.fullName || "Member detail"}
        subtitle="View identity records, wallet history, status controls, and financial activity in one place."
        actions={
          <div className="flex flex-wrap gap-3">
            <ConfirmActionButton
              confirmMessage={`This will reset the password to ${member.data?.phoneNumber ?? "the member phone number"}.`}
              confirmTitle="Reset this member's password?"
              isDisabled={resetting}
              label="Reset Password"
              onConfirm={resetPassword}
              pendingLabel="Resetting..."
              tone="success"
            />
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-text-900"
              onClick={openStatusModal}
              type="button"
            >
              <Pencil className="h-4 w-4" />
              Edit status
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-text-900"
              onClick={openEditMember}
              type="button"
            >
              <Pencil className="h-4 w-4" />
              Edit member
            </button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description={
            walletHasDebt
              ? "Current exposed wallet debt for this member."
              : "Spendable wallet balance currently held by this member."
          }
          href={`/admin/members/${params.id}`}
          icon={<WalletCards className="h-5 w-5" />}
          title="Wallet Balance"
          tone={walletHasDebt ? "red" : "green"}
          value={currency.format(walletBalance)}
        />
        <DashboardMetricCard
          description="Pending wallet deductions still waiting for settlement."
          href={`/admin/members/${params.id}`}
          icon={<CreditCard className="h-5 w-5" />}
          title="Pending Deductions"
          tone={(member.data?.wallet?.pendingBalance ?? 0) > 0 ? "amber" : "neutral"}
          value={currency.format(member.data?.wallet?.pendingBalance ?? 0)}
        />
        <DashboardMetricCard
          description="Loan applications attached to this member profile."
          href={`/admin/members/${params.id}`}
          icon={<Landmark className="h-5 w-5" />}
          title="Loans"
          value={member.data?.loanApplications.length ?? 0}
        />
        <DashboardMetricCard
          description="Investment subscriptions attached to this member."
          href={`/admin/members/${params.id}`}
          icon={<TrendingUp className="h-5 w-5" />}
          title="Investments"
          value={member.data?.investments.length ?? 0}
        />
      </section>

      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <DetailCard title="Personal Information">
            <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl bg-background-50 p-4 dark:bg-background-100">
              <AdminModal
                title="Profile Picture"
                trigger={
                  <button
                    className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-primary-900/10 bg-white text-lg font-semibold text-primary-700"
                    type="button"
                  >
                    {member.data?.avatarUrl ? (
                      <img
                        alt={member.data.fullName}
                        className="h-full w-full object-cover"
                        src={member.data.avatarUrl}
                      />
                    ) : (
                      <span>
                        {(member.data?.fullName || "M")
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                    )}
                  </button>
                }
              >
                {member.data?.avatarUrl ? (
                  <img
                    alt={member.data.fullName}
                    className="max-h-[75vh] w-full rounded-2xl object-contain"
                    src={member.data.avatarUrl}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-primary-900/12 p-8 text-center text-sm text-text-400">
                    No profile picture uploaded.
                  </div>
                )}
              </AdminModal>
              <div className="min-w-0">
                <p className="break-words text-lg font-semibold text-text-900 dark:text-text-50">
                  {member.data?.fullName || "Member"}
                </p>
                <p className="mt-1 text-sm text-text-400">
                  {member.data?.membershipNumber || "-"}
                </p>
              </div>
              <div className="ml-auto md:hidden">
                <ActionMenu
                  ariaLabel="Edit member actions"
                  icon={<Pencil className="h-4 w-4" />}
                  items={detailActions}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Membership number", member.data?.membershipNumber],
                [
                  "Join date",
                  member.data?.joinedAt
                    ? new Date(member.data.joinedAt).toLocaleDateString("en-NG")
                    : "-",
                ],
                ["Email", member.data?.user.email],
                ["Phone", member.data?.phoneNumber],
                ["Home address", member.data?.homeAddress],
                ["State of origin", member.data?.stateOfOrigin],
                [
                  "Date of birth",
                  member.data?.dateOfBirth
                    ? new Date(member.data.dateOfBirth).toLocaleDateString(
                        "en-NG",
                      )
                    : "-",
                ],
                ["Occupation", member.data?.occupation],
                ["Savings amount", currency.format(savingsTotal)],
                [
                  "Marital status",
                  member.data?.maritalStatus?.replaceAll("_", " "),
                ],
                ["Referrer", member.data?.referrer?.fullName || "No referrer"],
              ].map(([label, value]) => (
                <div
                  className={
                    label === "Email" || label === "Home address"
                      ? "sm:col-span-2"
                      : ""
                  }
                  key={label}
                >
                  <p className="text-sm text-text-400">{label}</p>
                  <p className="mt-1 break-words font-semibold text-text-900 dark:text-text-50">
                    {value || "-"}
                  </p>
                </div>
              ))}
              <div>
                <p className="text-sm text-text-400">Status</p>
                <div className="mt-2">
                  <StatusBadge
                    status={member.data?.status || "UNKNOWN"}
                    variant={statusVariant(member.data?.status) as any}
                  />
                </div>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Identification">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-text-400">Identification type</p>
                <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                  {member.data?.identificationType.replaceAll("_", " ") || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-400">Identification number</p>
                <p className="mt-1 font-semibold text-text-900 dark:text-text-50">
                  {member.data?.identificationNumber || "-"}
                </p>
              </div>
              {member.data?.identificationPicture ? (
                <AdminModal
                  title="Identification Document"
                  trigger={
                    <img
                      alt="Identification document"
                      className="h-48 w-full cursor-zoom-in rounded-2xl border border-primary-900/10 object-cover"
                      src={member.data.identificationPicture}
                    />
                  }
                >
                  <img
                    alt="Identification document"
                    className="max-h-[75vh] w-full rounded-2xl object-contain"
                    src={member.data.identificationPicture}
                  />
                </AdminModal>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-primary-900/16 text-sm text-text-400">
                  No ID image
                </div>
              )}
            </div>
          </DetailCard>
        </div>

        <DetailCard title="Recent Transactions">
          <DataTable
            columns={[
              {
                key: "type",
                header: "Type",
                render: (transaction) => (
                  <div>
                    <p className="font-semibold text-text-900 dark:text-text-50">
                      {transaction.type.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-text-400">
                      {transaction.reference || "No reference"}
                    </p>
                  </div>
                ),
                sortValue: (transaction) => transaction.type,
              },
              {
                key: "amount",
                header: "Amount",
                render: (transaction) => currency.format(transaction.amount),
                sortValue: (transaction) => transaction.amount,
              },
              {
                key: "createdAt",
                header: "Date",
                render: (transaction) =>
                  transaction.createdAt
                    ? new Date(transaction.createdAt).toLocaleDateString(
                        "en-NG",
                      )
                    : "-",
                sortValue: (transaction) =>
                  transaction.createdAt ? new Date(transaction.createdAt) : "",
              },
              {
                key: "status",
                header: "Status",
                render: (transaction) => (
                  <StatusBadge
                    status={transaction.status}
                    variant={statusVariant(transaction.status) as any}
                  />
                ),
              },
            ]}
            data={member.data?.wallet?.transactions ?? []}
            emptyDescription="No wallet transactions found for this member."
            getRowKey={(transaction) => transaction.id}
            searchableText={(transaction) =>
              `${transaction.type} ${transaction.status} ${transaction.reference ?? ""}`
            }
            searchPlaceholder="Search transactions..."
          />
        </DetailCard>

        <div className="grid gap-6 lg:grid-cols-3">
          <DetailCard title="Loans">
            <div className="max-w-full space-y-3 overflow-hidden">
              {(member.data?.loanApplications ?? []).length ? (
                member.data?.loanApplications.map((loan) => (
                  <FinancialRecordCard
                    amount={`${currency.format(loan.amount)} requested, ${currency.format(loan.remainingBalance)} remaining`}
                    href={`/admin/loans/${loan.id}`}
                    icon={<Landmark className="h-5 w-5" />}
                    key={loan.id}
                    status={
                      loan.status === "COMPLETED" || loan.remainingBalance <= 0
                        ? "COMPLETED"
                        : loan.disbursedAt
                          ? loan.status === "DISBURSED"
                            ? "DISBURSED"
                            : loan.status
                          : loan.status
                    }
                    subtitle={`Submitted ${formatShortDate(loan.submittedAt ?? loan.createdAt ?? loan.disbursedAt)}`}
                    title={loan.purpose || "Loan application"}
                    tone={
                      loan.status === "REJECTED"
                        ? "red"
                        : loan.status === "PENDING"
                          ? "amber"
                          : "green"
                    }
                  />
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-primary-900/12 p-5 text-sm text-text-400">
                  No loans found for this member.
                </p>
              )}
            </div>
          </DetailCard>

          <DetailCard title="Investments">
            <div className="max-w-full space-y-3 overflow-hidden">
              {(member.data?.investments ?? []).length ? (
                member.data?.investments.map((investment) => (
                  <FinancialRecordCard
                    amount={currency.format(investment.principal)}
                    href={`/admin/investments/${investment.product.id}`}
                    icon={<TrendingUp className="h-5 w-5" />}
                    key={investment.id}
                    status={investment.status}
                    subtitle={`Created ${formatShortDate(investment.createdAt ?? investment.maturityDate)}`}
                    title={investment.product.name}
                    tone={
                      investment.status === "REJECTED"
                        ? "red"
                        : investment.status === "PENDING"
                          ? "amber"
                          : "blue"
                    }
                  />
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-primary-900/12 p-5 text-sm text-text-400">
                  No investments found for this member.
                </p>
              )}
            </div>
          </DetailCard>

          <DetailCard title="Packages">
            <div className="max-w-full space-y-3 overflow-hidden">
              {(member.data?.packageSubscriptions ?? []).length ? (
                member.data?.packageSubscriptions?.map((subscription) => (
                  <FinancialRecordCard
                    amount={`${currency.format(subscription.amountPaid)} paid, ${currency.format(subscription.amountRemaining)} remaining`}
                    href={`/admin/packages/subscriptions/${subscription.id}`}
                    icon={<CreditCard className="h-5 w-5" />}
                    key={subscription.id}
                    status={
                      subscription.status === "COMPLETED" ||
                      subscription.amountRemaining <= 0
                        ? "COMPLETED"
                        : subscription.status
                    }
                    subtitle={`Created ${formatShortDate(subscription.createdAt ?? subscription.completedAt)}`}
                    title={subscription.package.name}
                    tone={
                      subscription.status === "REJECTED"
                        ? "red"
                        : subscription.status === "PENDING"
                          ? "amber"
                          : "green"
                    }
                  />
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-primary-900/12 p-5 text-sm text-text-400">
                  No packages found for this member.
                </p>
              )}
            </div>
          </DetailCard>
        </div>
      </div>

      <AdminModal
        description="Update this member's account and profile details."
        isOpen={editModalOpen}
        onOpenChange={setEditModalOpen}
        title={`Edit ${member.data?.fullName ?? "Member"}`}
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
                  htmlFor="detail-member-dob"
                >
                  Date of birth
                </label>
                <input
                  id="detail-member-dob"
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
                  htmlFor="detail-member-id-picture"
                >
                  Identification picture
                </label>
                <input
                  id="detail-member-id-picture"
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

              <AutocompleteInput
                className="md:col-span-2"
                control={control}
                emptyLabel="No referrers found"
                label="Referrer"
                name="referrerId"
                options={referrerOptions}
                placeholder="Search referrer..."
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                disabled={updatingMember}
                onClick={() => void updateMember(close)()}
                type="button"
              >
                {updatingMember ? "Saving..." : "Save member"}
              </button>
            </div>
          </>
        )}
      </AdminModal>

      <AdminModal
        description="Select the new membership status for this member."
        isOpen={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        title="Update Member Status"
      >
        {({ close }) => (
          <div className="space-y-4">
            <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4 text-sm text-text-900">
              Current status:{" "}
              <span className="font-semibold">
                {(member.data?.status || "UNKNOWN").replaceAll("_", " ")}
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
                onClick={async () => {
                  await updateStatus(selectedStatus);
                  close();
                }}
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
