"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  CreditCard,
  Landmark,
  Pencil,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { useApi } from "@/hooks/useApi";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { AdminModal } from "@/components/ui/admin-modal";
import api from "@/lib/api";
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

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const statusOptions = ["ACTIVE", "INACTIVE", "SUSPENDED", "WITHDRAWN"];

function formatShortDate(value?: string | null) {
  if (!value) return "No date recorded";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  amount?: string;
  status?: string;
  tone?: "green" | "amber" | "blue" | "red" | "neutral";
}) {
  const tones = {
    green: "bg-[var(--primary-50)] text-[var(--primary-700)]",
    amber: "bg-[#fff7e6] text-[#9a5b00]",
    blue: "bg-[#eef4ff] text-[#175cd3]",
    red: "bg-[#fff1f0] text-[#b42318]",
    neutral: "bg-background-100 text-text-700",
  };

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-primary-900/10 bg-white p-4 dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-900 dark:text-text-50">
              {title}
            </p>
            <p className="mt-1 text-sm text-text-400">{subtitle}</p>
          </div>
          {status ? (
            <StatusBadge status={status} variant={statusVariant(status) as any} />
          ) : null}
        </div>
        {amount ? (
          <p className="mt-3 text-sm font-medium text-text-700 dark:text-text-200">
            {amount}
          </p>
        ) : null}
      </div>
    </div>
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
  const [resetting, setResetting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("ACTIVE");
  const savingsTotal = (member.data?.savingsAccounts ?? []).reduce(
    (sum, account) => sum + Number(account.balance ?? 0),
    0,
  );

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
            <AdminModal
              description="Select the new membership status for this member."
              title="Update Member Status"
              trigger={
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-text-900"
                  onClick={() =>
                    setSelectedStatus(member.data?.status || "ACTIVE")
                  }
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
                  Edit status
                </button>
              }
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
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="Spendable wallet balance currently held by this member."
          href={`/admin/members/${params.id}`}
          icon={<WalletCards className="h-5 w-5" />}
          title="Wallet Balance"
          tone="green"
          value={currency.format(member.data?.wallet?.availableBalance ?? 0)}
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
            <div className="space-y-3">
              {(member.data?.loanApplications ?? []).length ? (
                member.data?.loanApplications.map((loan) => (
                  <FinancialRecordCard
                    amount={`${currency.format(loan.amount)} requested, ${currency.format(loan.remainingBalance)} remaining`}
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
            <div className="space-y-3">
              {(member.data?.investments ?? []).length ? (
                member.data?.investments.map((investment) => (
                  <FinancialRecordCard
                    amount={currency.format(investment.principal)}
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
            <div className="space-y-3">
              {(member.data?.packageSubscriptions ?? []).length ? (
                member.data?.packageSubscriptions?.map((subscription) => (
                  <FinancialRecordCard
                    amount={`${currency.format(subscription.amountPaid)} paid, ${currency.format(subscription.amountRemaining)} remaining`}
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
    </div>
  );
}
