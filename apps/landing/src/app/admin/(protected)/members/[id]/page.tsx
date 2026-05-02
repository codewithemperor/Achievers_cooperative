"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
    transactions: Array<{ id: string; type: string; amount: number; status: string; reference?: string | null }>;
  } | null;
  payments: Array<{ id: string; amount: number; status: string; netCreditAmount?: number | null }>;
  loanApplications: Array<{
    id: string;
    amount: number;
    remainingBalance: number;
    purpose: string;
    status: string;
    disbursedAt?: string | null;
    guarantorOne?: { fullName: string } | null;
    guarantorTwo?: { fullName: string } | null;
  }>;
  investments: Array<{ id: string; principal: number; status: string; product: { id: string; name: string } }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const statusOptions = ["ACTIVE", "INACTIVE", "SUSPENDED", "WITHDRAWN"];

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-[var(--primary-900)/8] bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-[var(--text-900)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function statusVariant(status?: string) {
  if (status === "ACTIVE" || status === "APPROVED") return "success";
  if (status === "INACTIVE" || status === "PENDING") return "warning";
  if (status === "SUSPENDED" || status === "WITHDRAWN" || status === "REJECTED") return "danger";
  return "info";
}

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const member = useApi<MemberDetail>(`/members/${params.id}`);
  const [resetting, setResetting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("ACTIVE");

  async function resetPassword() {
    try {
      setResetting(true);
      const response = await api.post(`/members/${params.id}/reset-password`);
      showSuccessToast(`Password reset to ${response.data.maskedResetTo ?? "the member phone number"}.`);
      await member.refetch();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to reset password.");
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
      showErrorToast(error?.response?.data?.message || "Unable to update member status.");
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
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--primary-900)/12] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-900)]"
                  onClick={() => setSelectedStatus(member.data?.status || "ACTIVE")}
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
                  Edit status
                </button>
              }
            >
              {({ close }) => (
                <div className="space-y-4">
                  <div className="rounded-[1.25rem] bg-[var(--background-50)/72] p-4 text-sm text-[var(--text-900)]">
                    Current status: <span className="font-semibold">{(member.data?.status || "UNKNOWN").replaceAll("_", " ")}</span>
                  </div>
                  <select
                    className="min-h-12 w-full rounded-2xl border border-[var(--primary-900)/12] px-4 text-sm text-[var(--text-900)] outline-none"
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

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <DetailCard title="Personal Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-[var(--text-400)]">Membership number</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.membershipNumber || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Join date</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">
                  {member.data?.joinedAt ? new Date(member.data.joinedAt).toLocaleDateString("en-NG") : "-"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-[var(--text-400)]">Email</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.user.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Phone</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.phoneNumber || "-"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-[var(--text-400)]">Home address</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.homeAddress || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">State of origin</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.stateOfOrigin || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Date of birth</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">
                  {member.data?.dateOfBirth ? new Date(member.data.dateOfBirth).toLocaleDateString("en-NG") : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Occupation</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.occupation || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Marital status</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.maritalStatus.replaceAll("_", " ") || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Referrer</p>
                <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.referrer?.fullName || "No referrer assigned"}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-400)]">Status</p>
                <div className="mt-2">
                  <StatusBadge status={member.data?.status || "UNKNOWN"} variant={statusVariant(member.data?.status) as any} />
                </div>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Identification">
            <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-[var(--text-400)]">Identification type</p>
                  <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.identificationType.replaceAll("_", " ") || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-400)]">Identification number</p>
                  <p className="mt-1 font-semibold text-[var(--text-900)]">{member.data?.identificationNumber || "-"}</p>
                </div>
              </div>
              <div>
                {member.data?.identificationPicture ? (
                  <AdminModal
                    title="Identification Document"
                    trigger={
                      <img
                        alt="Identification document"
                        className="h-40 w-full cursor-zoom-in rounded-[1.5rem] border border-[var(--primary-900)/8] object-cover"
                        src={member.data.identificationPicture}
                      />
                    }
                  >
                    <img
                      alt="Identification document"
                      className="max-h-[75vh] w-full rounded-[1.5rem] object-contain"
                      src={member.data.identificationPicture}
                    />
                  </AdminModal>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--primary-900)/16] text-sm text-[var(--text-400)]">
                    No ID image
                  </div>
                )}
              </div>
            </div>
          </DetailCard>
        </div>

        <div className="space-y-6">
          <DetailCard title="Account Summary">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] bg-[rgba(245,240,232,0.8)] p-4">
                <p className="text-sm text-[var(--text-400)]">Available balance</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-900)]">
                  {currency.format(member.data?.wallet?.availableBalance ?? 0)}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[rgba(245,240,232,0.8)] p-4">
                <p className="text-sm text-[var(--text-400)]">Pending deductions</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-900)]">
                  {currency.format(member.data?.wallet?.pendingBalance ?? 0)}
                </p>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Recent Transactions">
            <div className="space-y-3">
              {(member.data?.wallet?.transactions ?? []).slice(0, 8).map((transaction) => (
                <div key={transaction.id} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text-900)]">{transaction.type.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-[var(--text-400)]">{transaction.reference || "No reference"}</p>
                    </div>
                    <StatusBadge status={transaction.status} variant={statusVariant(transaction.status) as any} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-400)]">{currency.format(transaction.amount)}</p>
                </div>
              ))}
            </div>
          </DetailCard>

          <div className="grid gap-6 md:grid-cols-2">
            <DetailCard title="Loans">
              <div className="space-y-3">
                {(member.data?.loanApplications ?? []).map((loan) => (
                  <div key={loan.id} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
                    <p className="font-semibold text-[var(--text-900)]">{currency.format(loan.amount)}</p>
                    <p className="mt-1 text-sm">{loan.purpose}</p>
                    <p className="mt-1 text-xs text-[var(--text-400)]">
                      Remaining: {currency.format(loan.remainingBalance)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-400)]">
                      Guarantors: {loan.guarantorOne?.fullName || "None"} / {loan.guarantorTwo?.fullName || "None"}
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={loan.disbursedAt ? "DISBURSED" : loan.status} variant={statusVariant(loan.disbursedAt ? "APPROVED" : loan.status) as any} />
                    </div>
                  </div>
                ))}
              </div>
            </DetailCard>

            <DetailCard title="Investments">
              <div className="space-y-3">
                {(member.data?.investments ?? []).map((investment) => (
                  <div key={investment.id} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
                    <p className="font-semibold text-[var(--text-900)]">{investment.product.name}</p>
                    <p className="mt-1 text-sm">{currency.format(investment.principal)}</p>
                    <div className="mt-2">
                      <StatusBadge status={investment.status} variant="info" />
                    </div>
                  </div>
                ))}
              </div>
            </DetailCard>
          </div>
        </div>
      </div>
    </div>
  );
}
