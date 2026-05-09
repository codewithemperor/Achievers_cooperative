"use client";

import { useParams } from "next/navigation";
import { RotateCcw, TrendingUp } from "lucide-react";
import { useState } from "react";
import { SummaryCard } from "@/components/summary-card";
import { TransactionCard } from "@/components/transaction-card";
import { apiCallWithAlert } from "@/lib/alert";
import api from "@/lib/member-api";
import { useMemberData } from "@/hooks/use-member-data";
import { formatMoney } from "@/lib/member-format";

interface InvestmentDetail {
  id: string;
  principal: number;
  interest: number;
  maturityAmount: number;
  maturityDate: string;
  status: string;
  cancellationRequests?: Array<{
    id: string;
    status: string;
    reason?: string | null;
    rejectionReason?: string | null;
    createdAt: string;
  }>;
  product: {
    name: string;
    annualRate: number;
    durationMonths: number;
  } | null;
}

const emptyInvestment: InvestmentDetail = {
  id: "",
  principal: 0,
  interest: 0,
  maturityAmount: 0,
  maturityDate: new Date().toISOString(),
  status: "PENDING",
  cancellationRequests: [],
  product: null,
};

export default function InvestmentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const investment = useMemberData<InvestmentDetail>(
    `/investments/my/${id}`,
    emptyInvestment,
  );
  const [submitting, setSubmitting] = useState(false);

  const pendingCancellation = investment.data.cancellationRequests?.find(
    (item) => item.status === "PENDING",
  );
  const approvedCancellation = investment.data.cancellationRequests?.find(
    (item) => item.status === "APPROVED",
  );
  const shouldShowCancelButton =
    investment.data.status === "APPROVED" && !approvedCancellation;

  async function requestCancellation() {
    const { default: Swal } = await import("sweetalert2");
    const confirmation = await Swal.fire({
      title: "Cancel this investment?",
      text: "Your request will be sent to an admin for approval before any refund is made.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Send request",
      cancelButtonText: "Keep investment",
      confirmButtonColor: "#dc2626",
    });

    if (!confirmation.isConfirmed) return;

    try {
      setSubmitting(true);
      const result = await apiCallWithAlert({
        title: "Cancel Investment",
        loadingText: "Submitting cancellation request...",
        apiCall: () => api.post(`/investments/${id}/cancel`, {}),
        successTitle: "Request Submitted",
        successText:
          "Your investment cancellation request has been submitted for admin approval.",
      });

      if (result) await investment.refetch();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SummaryCard
        eyebrow="My Investment"
        title={investment.data.product?.name || "Investment"}
        value={formatMoney(investment.data.maturityAmount)}
        caption={`Principal ${formatMoney(investment.data.principal)} + interest ${formatMoney(investment.data.interest)}`}
        icon={<TrendingUp className="h-5 w-5" />}
        gradient="from-[#16112e] via-[#110d26] to-[#0c081e]"
      />

      <section className="rounded-3xl border border-background-200 bg-white p-5 dark:border-background-200 dark:bg-background-100">
        <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
          Investment details
        </h2>
        <div className="mt-3 divide-y divide-background-200 dark:divide-background-200">
        {[
          ["Principal", formatMoney(investment.data.principal)],
          ["Expected interest", formatMoney(investment.data.interest)],
          ["Maturity value", formatMoney(investment.data.maturityAmount)],
          [
            "Rate",
            `${investment.data.product?.annualRate ?? 0}% p.a. for ${investment.data.product?.durationMonths ?? 0} months`,
          ],
          [
            "Maturity date",
            new Date(investment.data.maturityDate).toLocaleDateString("en-NG"),
          ],
          ["Status", investment.data.status.replaceAll("_", " ")],
        ].map(([label, value]) => (
          <div
            className="flex items-start justify-between gap-5 py-3"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-400">
              {label}
            </p>
            <p className="max-w-[62%] text-right text-sm font-semibold text-text-900 dark:text-text-50">
              {value}
            </p>
          </div>
        ))}
        </div>
      </section>

      {investment.data.cancellationRequests?.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-text-900 dark:text-text-50">
            Cancellation requests
          </h2>
          {investment.data.cancellationRequests.map((request) => (
            <TransactionCard
              key={request.id}
              type="INVESTMENT"
              title="Investment cancellation"
              subtitle={
                request.rejectionReason ||
                request.reason ||
                "Admin approval required"
              }
              amount={investment.data.principal}
              status={request.status}
              timestamp={request.createdAt}
            />
          ))}
        </section>
      ) : null}

      {shouldShowCancelButton ? (
        <button
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          disabled={Boolean(pendingCancellation) || submitting}
          onClick={() => void requestCancellation()}
          type="button"
        >
          <RotateCcw className="h-4 w-4" />
          {pendingCancellation ? "Cancellation pending" : "Cancel investment"}
        </button>
      ) : null}
    </div>
  );
}
