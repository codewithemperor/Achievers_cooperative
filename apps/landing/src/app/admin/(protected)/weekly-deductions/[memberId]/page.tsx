"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CreditCard, WalletCards } from "lucide-react";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
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
  maximumFractionDigits: 0,
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

export default function AdminWeeklyDeductionMemberPage() {
  const params = useParams<{ memberId: string }>();
  const [tab, setTab] = useState<"cycles" | "payments">("cycles");
  const detail = useApi<WeeklyMemberDetail>(
    `/weekly-deductions/admin/members/${params.memberId}`,
    { label: "weekly deduction member detail" },
  );
  const cycles = useMemo(
    () => (detail.data?.cycles ?? []).slice().reverse(),
    [detail.data?.cycles],
  );
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          title="Outstanding"
          value={currency.format(detail.data?.outstandingAmount ?? 0)}
          description={`Next due date is ${formatDate(detail.data?.nextDueAt)}.`}
          href={`/admin/weekly-deductions/${params.memberId}`}
          icon={<WalletCards className="h-5 w-5" />}
          tone="red"
        />
        <DashboardMetricCard
          title="Total Paid"
          value={currency.format(detail.data?.totalPaid ?? 0)}
          description={`${detail.data?.paidCycleCount ?? 0} cycle(s) fully paid.`}
          href={`/admin/weekly-deductions/${params.memberId}`}
          icon={<CreditCard className="h-5 w-5" />}
          tone="green"
        />
        <DashboardMetricCard
          title="Prepaid"
          value={currency.format(detail.data?.prepaidAmount ?? 0)}
          description="Future weekly cycles already covered by upfront payments."
          href={`/admin/weekly-deductions/${params.memberId}`}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="blue"
        />
        <DashboardMetricCard
          title="Wallet Balance"
          value={currency.format(member?.walletBalance ?? 0)}
          description={`Weekly amount is ${currency.format(detail.data?.weeklyAmount ?? 0)}.`}
          href={`/admin/members/${member?.id ?? params.memberId}`}
          icon={<WalletCards className="h-5 w-5" />}
          tone="neutral"
        />
      </div>

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
