"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import api from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface MemberDetail {
  id: string;
  fullName: string;
  membershipNumber: string;
  phoneNumber: string;
  status: string;
  referrer?: { id: string; fullName: string; membershipNumber: string } | null;
  user: { email: string; role: string };
  wallet: {
    availableBalance: number;
    pendingBalance: number;
    currency: string;
    transactions: Array<{ id: string; type: string; amount: number; status: string }>;
  } | null;
  payments: Array<{ id: string; amount: number; status: string; netCreditAmount?: number | null }>;
  loanApplications: Array<{ id: string; amount: number; purpose: string; status: string; disbursedAt?: string | null }>;
  investments: Array<{ id: string; principal: number; status: string; product: { id: string; name: string } }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
      <h2 className="text-xl font-semibold text-[var(--color-dark)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const member = useApi<MemberDetail>(`/members/${params.id}`);
  const [resetting, setResetting] = useState(false);

  async function resetPassword() {
    try {
      setResetting(true);
      await api.post(`/members/${params.id}/reset-password`);
      showSuccessToast("Password reset OTP sent successfully.");
      await member.refetch();
    } catch (error: any) {
      showErrorToast(error?.response?.data?.message || "Unable to send reset OTP.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.data?.fullName || "Member detail"}
        subtitle="Full member profile with wallet, loans, investments, packages, and payment context."
        actions={
          <ConfirmActionButton
            confirmMessage="This will generate a fresh OTP and send it through the same activation flow used during registration."
            confirmTitle="Reset this member's password?"
            isDisabled={resetting}
            label="Reset Password"
            onConfirm={resetPassword}
            pendingLabel="Sending OTP..."
            tone="success"
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[var(--color-coop-muted)]">Membership number</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-dark)]">{member.data?.membershipNumber || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-coop-muted)]">Email</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-dark)]">{member.data?.user.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-coop-muted)]">Phone</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-dark)]">{member.data?.phoneNumber || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-coop-muted)]">Referrer Name</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-dark)]">
                {member.data?.referrer?.fullName || "No referrer assigned"}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-coop-muted)]">Status</p>
              <div className="mt-2">
                <StatusBadge
                  status={member.data?.status || "UNKNOWN"}
                  variant={member.data?.status === "ACTIVE" ? "success" : "warning"}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <DetailCard title="Wallet Summary">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] bg-[rgba(245,240,232,0.8)] p-4">
                <p className="text-sm text-[var(--color-coop-muted)]">Available</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">
                  {currency.format(member.data?.wallet?.availableBalance ?? 0)}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[rgba(245,240,232,0.8)] p-4">
                <p className="text-sm text-[var(--color-coop-muted)]">Pending</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-dark)]">
                  {currency.format(member.data?.wallet?.pendingBalance ?? 0)}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(member.data?.wallet?.transactions ?? []).map((transaction) => (
                <div key={transaction.id} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--color-dark)]">{transaction.type}</p>
                    <StatusBadge status={transaction.status} variant={transaction.status === "APPROVED" ? "success" : "warning"} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-coop-muted)]">{currency.format(transaction.amount)}</p>
                </div>
              ))}
            </div>
          </DetailCard>

          <div className="grid gap-5 md:grid-cols-2">
            <DetailCard title="Loans">
              <div className="grid gap-3 sm:grid-cols-2">
                {(member.data?.loanApplications ?? []).map((loan) => (
                  <div key={loan.id} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
                    <p className="font-semibold text-[var(--color-dark)]">{currency.format(loan.amount)}</p>
                    <p className="mt-1 text-sm">{loan.purpose}</p>
                    <div className="mt-2">
                      <StatusBadge
                        status={loan.disbursedAt ? "DISBURSED" : loan.status}
                        variant={loan.disbursedAt ? "success" : loan.status === "REJECTED" ? "danger" : loan.status === "APPROVED" ? "success" : "warning"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </DetailCard>

            <DetailCard title="Investments">
              <div className="grid gap-3 sm:grid-cols-2">
                {(member.data?.investments ?? []).map((investment) => (
                  <div key={investment.id} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
                    <p className="font-semibold text-[var(--color-dark)]">{investment.product.name}</p>
                    <p className="mt-1 text-sm">{currency.format(investment.principal)}</p>
                    <div className="mt-2">
                      <StatusBadge status={investment.status} variant="info" />
                    </div>
                  </div>
                ))}
              </div>
            </DetailCard>

            <DetailCard title="Packages">
              <div className="rounded-[1.25rem] bg-[rgba(245,240,232,0.6)] p-4 text-sm text-[var(--color-coop-muted)]">
                Package subscriptions now live on dedicated package detail pages, while this member view keeps the broader financial summary.
              </div>
            </DetailCard>

            <DetailCard title="Payment History">
              <div className="grid gap-3 sm:grid-cols-2">
                {(member.data?.payments ?? []).map((payment) => (
                  <div key={payment.id} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--color-dark)]">{currency.format(payment.amount)}</p>
                      <StatusBadge
                        status={payment.status}
                        variant={payment.status === "APPROVED" ? "success" : payment.status === "REJECTED" ? "danger" : "warning"}
                      />
                    </div>
                    {typeof payment.netCreditAmount === "number" ? (
                      <p className="mt-2 text-sm text-[var(--color-coop-muted)]">
                        Net credit: {currency.format(payment.netCreditAmount)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </DetailCard>
          </div>
        </section>
      </div>
    </div>
  );
}
