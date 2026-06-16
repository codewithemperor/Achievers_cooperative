"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";

interface WeeklyCycle {
  id: string;
  dueDate: string;
  amount: number;
  amountPaid: number;
  outstandingAmount: number;
  status: string;
}

interface WeeklyPayment {
  id: string;
  amount: number;
  mode: string;
  paidAt: string;
  transaction?: {
    id: string;
    type: string;
    status: string;
    reference?: string | null;
    description?: string | null;
  } | null;
  allocations: Array<{
    id: string;
    amount: number;
    cycle?: WeeklyCycle | null;
  }>;
}

interface WeeklyMemberDetail {
  member: {
    id: string;
    fullName: string;
    membershipNumber: string;
    joinedAt: string;
    walletBalance: number;
  };
  weeklyAmount: number;
  outstandingAmount: number;
  prepaidAmount: number;
  totalPaid: number;
  paidThisMonth: number;
  expectedAmount: number;
  cycleCount: number;
  paidCycleCount: number;
  outstandingCycleCount: number;
  nextDueAt?: string | null;
  latestPaymentAt?: string | null;
  cycles: WeeklyCycle[];
  payments: WeeklyPayment[];
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusVariant(status: string) {
  if (["PAID", "PREPAID", "APPROVED"].includes(status)) return "success";
  if (["OUTSTANDING", "OVERDUE"].includes(status)) return "danger";
  if (status === "PARTIAL") return "warning";
  return "neutral";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle py-3 last:border-b-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-text-strong">
        {value}
      </span>
    </div>
  );
}

function currentMonthBounds() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
  };
}

export default function AdminWeeklyDeductionMemberPage() {
  const params = useParams<{ memberId: string }>();
  const [tab, setTab] = useState<"cycles" | "payments">("cycles");
  const detail = useApi<WeeklyMemberDetail>(
    `/weekly-deductions/admin/members/${params.memberId}`,
    { label: "weekly deduction member detail" },
  );
  const cycles = useMemo(() => {
    const bounds = currentMonthBounds();
    return (detail.data?.cycles ?? [])
      .filter((cycle) => {
        const dueTime = new Date(cycle.dueDate).getTime();
        const isCurrentMonth = dueTime >= bounds.from && dueTime <= bounds.to;
        const isOutstanding = cycle.outstandingAmount > 0 && dueTime <= bounds.today;
        return isCurrentMonth || isOutstanding;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [detail.data?.cycles]);
  const payments = detail.data?.payments ?? [];
  const member = detail.data?.member;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-primary-900/10 px-4 py-2 text-sm font-semibold text-text-700 transition hover:bg-background-100 dark:border-[var(--background-700)] dark:text-text-200"
            href="/admin/weekly-deductions"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
        title={member?.fullName ?? "Weekly deduction member"}
        subtitle={
          member
            ? `${member.membershipNumber} • Joined ${formatDate(member.joinedAt)}`
            : "Review generated weekly cycles and payment allocation history."
        }
      />

      <section className="rounded-3xl border border-border-subtle bg-surface-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Member due summary
            </p>
            <h2 className="mt-1 text-lg font-semibold text-text-strong">
              Weekly association deduction
            </h2>
          </div>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
            {currency.format(detail.data?.weeklyAmount ?? 0)} weekly
          </span>
        </div>
        <div className="mt-3">
          <DetailRow label="Expected" value={currency.format(detail.data?.expectedAmount ?? 0)} />
          <DetailRow label="Total paid" value={currency.format(detail.data?.totalPaid ?? 0)} />
          <DetailRow label="Outstanding" value={currency.format(detail.data?.outstandingAmount ?? 0)} />
          <DetailRow label="Prepaid" value={currency.format(detail.data?.prepaidAmount ?? 0)} />
          <DetailRow label="Paid this month" value={currency.format(detail.data?.paidThisMonth ?? 0)} />
          <DetailRow label="Wallet balance" value={currency.format(member?.walletBalance ?? 0)} />
          <DetailRow label="Next due" value={formatDate(detail.data?.nextDueAt)} />
        </div>
      </section>

      <AdminTabs
        items={[
          { id: "cycles", label: "Cycles" },
          { id: "payments", label: "Payments" },
        ]}
        meta={
          tab === "cycles"
            ? `${detail.data?.outstandingCycleCount ?? 0} outstanding cycle(s)`
            : `${payments.length} payment record(s)`
        }
        onChange={setTab}
        value={tab}
      />

      {tab === "cycles" ? (
        <DataTable
          columns={[
            {
              key: "dueDate",
              header: "Due Date",
              render: (item) => formatDate(item.dueDate),
              sortValue: (item) => new Date(item.dueDate),
            },
            {
              key: "amount",
              header: "Expected",
              render: (item) => currency.format(item.amount),
              sortValue: (item) => item.amount,
            },
            {
              key: "amountPaid",
              header: "Paid",
              render: (item) => currency.format(item.amountPaid),
              sortValue: (item) => item.amountPaid,
            },
            {
              key: "outstandingAmount",
              header: "Outstanding",
              render: (item) => currency.format(item.outstandingAmount),
              sortValue: (item) => item.outstandingAmount,
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
          ]}
          data={cycles}
          emptyDescription={detail.error || "No weekly cycles found for this member."}
          getRowKey={(item) => item.id}
          loading={detail.loading}
          searchableText={(item) => `${item.dueDate} ${item.status} ${item.amount}`}
          searchPlaceholder="Search cycles..."
        />
      ) : (
        <DataTable
          columns={[
            {
              key: "paidAt",
              header: "Paid At",
              render: (item) => formatDateTime(item.paidAt),
              sortValue: (item) => new Date(item.paidAt),
            },
            {
              key: "amount",
              header: "Amount",
              render: (item) => currency.format(item.amount),
              sortValue: (item) => item.amount,
            },
            {
              key: "mode",
              header: "Mode",
              render: (item) => item.mode.replaceAll("_", " ").toLowerCase(),
              sortValue: (item) => item.mode,
            },
            {
              key: "reference",
              header: "Reference",
              render: (item) => item.transaction?.reference ?? "-",
            },
            {
              key: "allocations",
              header: "Applied To",
              render: (item) =>
                item.allocations.length
                  ? item.allocations
                      .map(
                        (allocation) =>
                          `${formatDate(allocation.cycle?.dueDate)} (${currency.format(allocation.amount)})`,
                      )
                      .join(", ")
                  : "-",
            },
            {
              key: "status",
              header: "Status",
              render: (item) => (
                <StatusBadge
                  status={item.transaction?.status ?? "POSTED"}
                  variant={statusVariant(item.transaction?.status ?? "PAID") as any}
                />
              ),
            },
          ]}
          data={payments}
          emptyDescription={detail.error || "No weekly payment records found for this member."}
          getRowKey={(item) => item.id}
          loading={detail.loading}
          searchableText={(item) =>
            `${item.mode} ${item.transaction?.reference ?? ""} ${item.transaction?.description ?? ""} ${item.paidAt}`
          }
          searchPlaceholder="Search payments..."
        />
      )}
    </div>
  );
}
