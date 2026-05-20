"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { parseDate } from "@internationalized/date";
import { useForm, useWatch } from "react-hook-form";
import { CalendarDays, CreditCard, Users, WalletCards } from "lucide-react";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { DateRangePicker } from "@/components/ui/form-input";
import type { DateRange } from "@/components/ui/form-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardMetricCard } from "@/components/admin/dashboard-card";
import { useApi } from "@/hooks/useApi";
import { getCurrentMonthRange, toIsoBoundary } from "@/lib/date-range";

interface WeeklySummaryResponse {
  members: number;
  expectedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  prepaidAmount: number;
  payments: number;
}

interface WeeklyMemberRow {
  member: {
    id: string;
    fullName: string;
    membershipNumber: string;
    phoneNumber?: string | null;
    joinedAt?: string | null;
    walletBalance: number;
  };
  expectedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  prepaidAmount: number;
  latestPaymentAt?: string | null;
  status: string;
}

interface WeeklyMembersResponse {
  items: WeeklyMemberRow[];
}

interface WeeklyTransactionRow {
  id: string;
  amount: number;
  mode: string;
  paidAt: string;
  member?: {
    id: string;
    fullName: string;
    membershipNumber: string;
    phoneNumber?: string | null;
  };
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
    cycle?: {
      dueDate: string;
      status: string;
    } | null;
  }>;
}

interface WeeklyTransactionsResponse {
  items: WeeklyTransactionRow[];
}

interface FilterValues {
  transactionDateRange: DateRange;
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
  return "warning";
}

export default function AdminWeeklyDeductionsPage() {
  const [tab, setTab] = useState<"members" | "transactions">("members");
  const currentMonthRange = useMemo(() => getCurrentMonthRange(), []);
  const { control } = useForm<FilterValues>({
    defaultValues: {
      transactionDateRange: {
        start: parseDate(currentMonthRange.from),
        end: parseDate(currentMonthRange.to),
      },
    },
  });
  const selectedDateRange = useWatch({
    control,
    name: "transactionDateRange",
  });
  const startDate = selectedDateRange?.start?.toString() ?? currentMonthRange.from;
  const endDate = selectedDateRange?.end?.toString() ?? currentMonthRange.to;
  const rangeQuery = `from=${encodeURIComponent(toIsoBoundary(startDate, "start"))}&to=${encodeURIComponent(toIsoBoundary(endDate, "end"))}`;

  const summary = useApi<WeeklySummaryResponse>("/weekly-deductions/admin/summary", {
    label: "weekly deduction summary",
  });
  const members = useApi<WeeklyMembersResponse>("/weekly-deductions/admin/members", {
    label: "weekly deduction members",
  });
  const transactions = useApi<WeeklyTransactionsResponse>(
    `/weekly-deductions/admin/transactions?${rangeQuery}`,
    { label: "weekly deduction transactions" },
  );

  const memberRows = members.data?.items ?? [];
  const transactionRows = transactions.data?.items ?? [];
  const monthlyPaid = transactionRows.reduce(
    (sum, item) => sum + Number(item.amount ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Deductions"
        subtitle="Monitor member weekly association dues, outstanding cycles, prepaid balances, and payment history."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          title="Expected Amount"
          value={currency.format(summary.data?.expectedAmount ?? 0)}
          description="Total generated weekly cycles for active members."
          href="/admin/weekly-deductions"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="green"
        />
        <DashboardMetricCard
          title="Amount Paid"
          value={currency.format(summary.data?.paidAmount ?? 0)}
          description="Total settled weekly dues across all generated cycles."
          href="/admin/weekly-deductions"
          icon={<CreditCard className="h-5 w-5" />}
          tone="neutral"
        />
        <DashboardMetricCard
          title="Outstanding"
          value={currency.format(summary.data?.outstandingAmount ?? 0)}
          description="Due weekly amounts not yet settled."
          href="/admin/weekly-deductions"
          icon={<WalletCards className="h-5 w-5" />}
          tone="red"
        />
        <DashboardMetricCard
          title="Members"
          value={summary.data?.members ?? 0}
          description={`Prepaid balance is ${currency.format(summary.data?.prepaidAmount ?? 0)}.`}
          href="/admin/weekly-deductions"
          icon={<Users className="h-5 w-5" />}
          tone="blue"
        />
      </div>

      <AdminTabs
        items={[
          { id: "members", label: "Members" },
          { id: "transactions", label: "Transactions" },
        ]}
        meta={
          tab === "members"
            ? `${memberRows.length} active member(s)`
            : `${currency.format(monthlyPaid)} paid in selected period`
        }
        onChange={setTab}
        value={tab}
      />

      {tab === "members" ? (
        <DataTable
          columns={[
            {
              key: "member",
              header: "Member",
              render: (item) => (
                <Link
                  className="font-semibold text-text-900 hover:text-[var(--primary-700)] dark:text-text-50"
                  href={`/admin/weekly-deductions/${item.member.id}`}
                >
                  {item.member.fullName}
                  <span className="mt-1 block text-xs font-medium text-text-400">
                    {item.member.membershipNumber}
                  </span>
                </Link>
              ),
              sortValue: (item) => item.member.fullName,
            },
            {
              key: "expectedAmount",
              header: "Expected",
              render: (item) => currency.format(item.expectedAmount),
              sortValue: (item) => item.expectedAmount,
            },
            {
              key: "paidAmount",
              header: "Paid",
              render: (item) => currency.format(item.paidAmount),
              sortValue: (item) => item.paidAmount,
            },
            {
              key: "outstandingAmount",
              header: "Outstanding",
              render: (item) => (
                <span
                  className={
                    item.outstandingAmount > 0
                      ? "font-semibold text-red-600 dark:text-red-300"
                      : "font-semibold text-[var(--primary-700)] dark:text-[var(--primary-300)]"
                  }
                >
                  {currency.format(item.outstandingAmount)}
                </span>
              ),
              sortValue: (item) => item.outstandingAmount,
            },
            {
              key: "prepaidAmount",
              header: "Prepaid",
              render: (item) => currency.format(item.prepaidAmount),
              sortValue: (item) => item.prepaidAmount,
            },
            {
              key: "latestPaymentAt",
              header: "Latest Payment",
              render: (item) => formatDate(item.latestPaymentAt),
              sortValue: (item) =>
                item.latestPaymentAt ? new Date(item.latestPaymentAt) : null,
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
          data={memberRows}
          emptyDescription={members.error || "No weekly deduction member records found."}
          getRowKey={(item) => item.member.id}
          loading={members.loading || summary.loading}
          onRowClick={(item) => {
            window.location.href = `/admin/weekly-deductions/${item.member.id}`;
          }}
          searchableText={(item) =>
            `${item.member.fullName} ${item.member.membershipNumber} ${item.member.phoneNumber ?? ""} ${item.status}`
          }
          searchPlaceholder="Search weekly members..."
        />
      ) : (
        <DataTable
          columns={[
            {
              key: "member",
              header: "Member",
              render: (item) => (
                <div>
                  <p className="font-semibold text-text-900 dark:text-text-50">
                    {item.member?.fullName ?? "Unknown member"}
                  </p>
                  <p className="text-xs text-text-400">
                    {item.member?.membershipNumber ?? "-"}
                  </p>
                </div>
              ),
              sortValue: (item) => item.member?.fullName,
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
              key: "cycles",
              header: "Cycles",
              render: (item) =>
                item.allocations.length
                  ? item.allocations
                      .map((allocation) => formatDate(allocation.cycle?.dueDate))
                      .join(", ")
                  : "-",
            },
            {
              key: "paidAt",
              header: "Paid At",
              render: (item) => formatDateTime(item.paidAt),
              sortValue: (item) => new Date(item.paidAt),
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
          data={transactionRows}
          emptyDescription={transactions.error || "No weekly deduction transactions found for this period."}
          getRowKey={(item) => item.id}
          loading={transactions.loading}
          searchableText={(item) =>
            `${item.member?.fullName ?? ""} ${item.member?.membershipNumber ?? ""} ${item.mode} ${item.transaction?.reference ?? ""}`
          }
          searchPlaceholder="Search weekly transactions..."
          toolbar={
            <DateRangePicker
              className="w-full"
              control={control}
              label=""
              name="transactionDateRange"
            />
          }
        />
      )}
    </div>
  );
}
