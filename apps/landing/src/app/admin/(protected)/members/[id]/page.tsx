"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";

interface MemberDetail {
  id: string;
  fullName: string;
  membershipNumber: string;
  phoneNumber: string;
  status: string;
  user: { email: string; role: string };
  wallet: {
    availableBalance: number;
    pendingBalance: number;
    currency: string;
    transactions: Array<{ id: string; type: string; amount: number; status: string }>;
  } | null;
  payments: Array<{ id: string; amount: number; status: string; netCreditAmount?: number | null }>;
  loanApplications: Array<{ id: string; amount: number; purpose: string; status: string }>;
  investments: Array<{ id: string; principal: number; status: string; product: { name: string } }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const member = useApi<MemberDetail>(`/members/${params.id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.data?.fullName || "Member detail"}
        subtitle="Full member profile with wallet, loans, and investment context."
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
          <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--color-dark)]">Wallet Summary</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
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
            <div className="mt-4 space-y-3">
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
          </div>

          <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--color-dark)]">Loans</h2>
            <div className="mt-4 space-y-3">
              {(member.data?.loanApplications ?? []).map((loan) => (
                <div key={loan.id} className="rounded-[1.25rem] bg-[rgba(245,240,232,0.76)] p-4">
                  <p className="font-semibold text-[var(--color-dark)]">{currency.format(loan.amount)}</p>
                  <p className="mt-1 text-sm">{loan.purpose}</p>
                  <div className="mt-2">
                    <StatusBadge status={loan.status} variant={loan.status === "APPROVED" ? "success" : "warning"} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--color-dark)]">Investments</h2>
            <div className="mt-4 space-y-3">
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
          </div>

          <div className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white p-6">
            <h2 className="text-xl font-semibold text-[var(--color-dark)]">Payment History</h2>
            <div className="mt-4 space-y-3">
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
          </div>
        </section>
      </div>
    </div>
  );
}
