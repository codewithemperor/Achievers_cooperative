"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CreditCard,
  FileDown,
  Lock,
  Pencil,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm, useWatch } from "react-hook-form";
import { AdminModal } from "@/components/ui/admin-modal";
import { AdminTabs } from "@/components/ui/admin-tabs";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import {
  NumberInput,
  DateRangePicker,
  TextInput,
  TextareaInput,
} from "@/components/ui/form-input";
import type { DateRange } from "@/components/ui/form-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { TransactionReceiptModal } from "@/components/admin/transaction-receipt-modal";
import {
  DashboardMetricCard,
  DashboardPanel,
} from "@/components/admin/dashboard-card";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { getCurrentMonthRange, toIsoBoundary } from "@/lib/date-range";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface MemberTransactionsResponse {
  total?: number;
  summary?: {
    total: number;
    pending: number;
    approvedCredits: number;
    approvedDebits: number;
  };
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    category?: string | null;
    description?: string | null;
    editable: boolean;
    lockReason?: string | null;
    createdAt: string;
    wallet: {
      member: {
        fullName: string;
        membershipNumber: string;
      };
    };
  }>;
}

interface TreasurySummary {
  balance: number;
  physicalTreasuryCash: number;
  memberWalletLiability: number;
  associationAvailableBalance: number;
  totalIncome: number;
  totalExpense: number;
  memberWalletHoldings: number;
  combinedHoldings: number;
  reconciliation?: {
    isBalanced: boolean;
    physicalTreasuryCashFromLedger: number;
    memberWalletLiabilityFromLedger: number;
    associationAvailableFromLedger: number;
  };
}

interface TreasuryLedgerResponse {
  items: Array<{
    id: string;
    reference?: string | null;
    sourceType: string;
    sourceId?: string | null;
    amount: number;
    description: string;
    actor?: { email: string; role: string } | null;
    createdAt: string;
    lines: Array<{
      id: string;
      account: string;
      direction: string;
      amount: number;
      member?: { fullName: string; membershipNumber: string } | null;
    }>;
  }>;
}

interface TreasuryEntryValues {
  type: "INCOME" | "EXPENSE";
  amount: number | undefined;
  category: string;
  description: string;
  reference: string;
}

interface TransactionFiltersForm {
  transactionDateRange: DateRange;
}

interface ReportFiltersForm {
  reportDateRange: DateRange;
}

interface EditTransactionValues {
  amount: number | undefined;
  category: string;
  description: string;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function variantForStatus(status: string) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
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

function isCreditTransaction(type: string) {
  return ["FUNDING", "CREDIT", "REFUND", "INVESTMENT_MATURITY"].some((key) =>
    type.toUpperCase().includes(key),
  );
}

function daysBetweenInclusive(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function isWithinDateRange(createdAt: string, from: string, to: string) {
  const value = new Date(createdAt).getTime();
  return (
    value >= new Date(toIsoBoundary(from, "start")).getTime() &&
    value <= new Date(toIsoBoundary(to, "end")).getTime()
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function TransactionEditForm({
  item,
  onSubmit,
  onSuccess,
}: {
  item: MemberTransactionsResponse["items"][number];
  onSubmit: (values: EditTransactionValues) => Promise<void>;
  onSuccess?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<EditTransactionValues>({
    defaultValues: {
      amount: item.amount,
      category: item.category || "",
      description: item.description || "",
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await onSubmit(values);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <div className="grid gap-4">
        <NumberInput
          className="rounded-2xl"
          control={control}
          label="Amount"
          name="amount"
          min={0}
        />
        <TextInput
          className="rounded-2xl"
          control={control}
          label="Category"
          name="category"
          placeholder="Manual adjustment"
        />
        <TextareaInput
          className="rounded-2xl"
          control={control}
          label="Description"
          name="description"
          placeholder="Why this transaction is being edited"
          rows={4}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <button
          className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
          disabled={submitting}
          onClick={() => void submit()}
          type="button"
        >
          {submitting ? "Saving..." : "Save changes"}
        </button>
      </div>
    </>
  );
}

export default function TransactionsPage() {
  const [tab, setTab] = useState<"member" | "treasury">("treasury");
  const [selectedTransaction, setSelectedTransaction] = useState<
    MemberTransactionsResponse["items"][number] | null
  >(null);
  const [selectedLedger, setSelectedLedger] = useState<
    TreasuryLedgerResponse["items"][number] | null
  >(null);
  const currentMonthRange = useMemo(() => getCurrentMonthRange(), []);
  const { control: filtersControl } = useForm<TransactionFiltersForm>({
    defaultValues: {
      transactionDateRange: {
        start: parseDate(currentMonthRange.from),
        end: parseDate(currentMonthRange.to),
      },
    },
  });
  const { control: reportControl } = useForm<ReportFiltersForm>({
    defaultValues: {
      reportDateRange: {
        start: parseDate(currentMonthRange.from),
        end: parseDate(currentMonthRange.to),
      },
    },
  });
  const [reportType, setReportType] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const selectedReportRange = useWatch({
    control: reportControl,
    name: "reportDateRange",
  });
  const selectedDateRange = useWatch({
    control: filtersControl,
    name: "transactionDateRange",
  });
  const startDate =
    selectedDateRange?.start?.toString() ?? currentMonthRange.from;
  const endDate = selectedDateRange?.end?.toString() ?? currentMonthRange.to;
  const rangeQuery = `from=${encodeURIComponent(
    toIsoBoundary(startDate, "start"),
  )}&to=${encodeURIComponent(toIsoBoundary(endDate, "end"))}`;
  const allMemberTransactions =
    useApi<MemberTransactionsResponse>("/transactions");
  const memberTransactions =
    useApi<MemberTransactionsResponse>(`/transactions?${rangeQuery}`);
  const wallet = useApi<TreasurySummary>("/wallet/cooperative");
  const treasuryEntries = useApi<TreasuryLedgerResponse>(
    `/wallet/cooperative/ledger?${rangeQuery}`,
  );
  const allTreasuryEntries = useApi<TreasuryLedgerResponse>(
    "/wallet/cooperative/ledger",
  );
  const [creatingEntry, setCreatingEntry] = useState(false);
  const { control, handleSubmit, reset, setValue, watch } =
    useForm<TreasuryEntryValues>({
      defaultValues: {
        type: "INCOME",
        amount: undefined,
        category: "",
        description: "",
        reference: "",
      },
    });

  const treasuryRows = useMemo(
    () => treasuryEntries.data?.items ?? [],
    [treasuryEntries.data],
  );
  const allTreasuryRows = useMemo(
    () => allTreasuryEntries.data?.items ?? [],
    [allTreasuryEntries.data],
  );
  const transactionRows = useMemo(
    () => memberTransactions.data?.items ?? [],
    [memberTransactions.data],
  );

  const reportRows = useMemo(() => {
    const from = selectedReportRange?.start?.toString() ?? currentMonthRange.from;
    const to = selectedReportRange?.end?.toString() ?? currentMonthRange.to;
    return {
      from,
      to,
      member: (allMemberTransactions.data?.items ?? []).filter((item) =>
        isWithinDateRange(item.createdAt, from, to),
      ),
      treasury: allTreasuryRows.filter((item) =>
        isWithinDateRange(item.createdAt, from, to),
      ),
    };
  }, [
    allMemberTransactions.data,
    allTreasuryRows,
    currentMonthRange.from,
    currentMonthRange.to,
    selectedReportRange,
  ]);

  const memberSummary = useMemo(() => {
    if (allMemberTransactions.data?.summary) {
      return {
        total: allMemberTransactions.data.summary.total,
        pending: allMemberTransactions.data.summary.pending,
        totalCredits: allMemberTransactions.data.summary.approvedCredits,
        totalDebits: allMemberTransactions.data.summary.approvedDebits,
      };
    }

    const globalTransactionRows = allMemberTransactions.data?.items ?? [];
    const approvedRows = globalTransactionRows.filter(
      (item) => item.status === "APPROVED",
    );
    const totalCredits = approvedRows
      .filter((item) => isCreditTransaction(item.type))
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalDebits = approvedRows
      .filter((item) => !isCreditTransaction(item.type))
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

    return {
      total: globalTransactionRows.length,
      pending: globalTransactionRows.filter((item) => item.status === "PENDING")
        .length,
      totalCredits,
      totalDebits,
    };
  }, [allMemberTransactions.data]);

  const dateRangeToolbar = (
    <DateRangePicker
      className="w-full"
      control={filtersControl}
      label=""
      name="transactionDateRange"
    />
  );

  const ledgerDerivedTreasurySummary = useMemo(() => {
    const signedAccountTotal = (account: string) =>
      allTreasuryRows.reduce((sum, entry) => {
        const entryTotal = entry.lines
          .filter((line) => line.account === account)
          .reduce((lineSum, line) => {
            const amount = Number(line.amount ?? 0);
            return lineSum + (line.direction === "DEBIT" ? amount : -amount);
          }, 0);
        return sum + entryTotal;
      }, 0);

    const physicalTreasuryCash = signedAccountTotal(
      "PHYSICAL_TREASURY_CASH",
    );
    const memberWalletLiability = -signedAccountTotal(
      "MEMBER_WALLET_LIABILITY",
    );
    const associationAvailableBalance = -signedAccountTotal(
      "ASSOCIATION_AVAILABLE",
    );

    return {
      associationAvailableBalance,
      memberWalletLiability,
      physicalTreasuryCash,
    };
  }, [allTreasuryRows]);

  const treasurySummary = {
    physicalTreasuryCash:
      wallet.data?.physicalTreasuryCash ||
      wallet.data?.combinedHoldings ||
      ledgerDerivedTreasurySummary.physicalTreasuryCash,
    memberWalletLiability:
      wallet.data?.memberWalletLiability ||
      wallet.data?.memberWalletHoldings ||
      ledgerDerivedTreasurySummary.memberWalletLiability,
    associationAvailableBalance:
      wallet.data?.associationAvailableBalance ||
      wallet.data?.balance ||
      ledgerDerivedTreasurySummary.associationAvailableBalance,
    netTreasuryFlow:
      (wallet.data?.totalIncome ?? 0) - (wallet.data?.totalExpense ?? 0),
  };

  function generateTransactionReport() {
    const days = daysBetweenInclusive(reportRows.from, reportRows.to);
    if (days < 1) {
      showErrorToast("Choose a valid report period.");
      return;
    }
    if (days > 366) {
      showErrorToast("Report period cannot be more than one year.");
      return;
    }
    if (reportType === "yearly" && days < 360) {
      showErrorToast("A yearly report must cover a full one-year period.");
      return;
    }

    const approved = reportRows.member.filter(
      (item) => item.status === "APPROVED",
    );
    const approvedCredits = approved
      .filter((item) => isCreditTransaction(item.type))
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const approvedDebits = approved
      .filter((item) => !isCreditTransaction(item.type))
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const pending = reportRows.member.filter(
      (item) => item.status === "PENDING",
    ).length;
    const treasuryTotal = reportRows.treasury.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
    const typeBuckets = reportRows.member.reduce<Record<string, number>>(
      (acc, item) => {
        const key = item.type.replaceAll("_", " ");
        acc[key] = (acc[key] ?? 0) + Number(item.amount ?? 0);
        return acc;
      },
      {},
    );
    const statusBuckets = reportRows.member.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const html = `<!doctype html>
<html>
<head>
  <title>Transaction Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #17201a; padding: 32px; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    h2 { margin-top: 28px; font-size: 16px; }
    .muted { color: #667085; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px; }
    .card { border: 1px solid #d0d5dd; border-radius: 12px; padding: 14px; }
    .label { color: #667085; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .value { margin-top: 8px; font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th, td { border-bottom: 1px solid #eaecf0; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; font-size: 11px; text-transform: uppercase; color: #667085; }
    @media print { button { display: none; } body { padding: 12px; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="float:right;padding:10px 14px;border-radius:999px;border:0;background:#166534;color:white;font-weight:700;">Download / Save as PDF</button>
  <h1>Achievers Cooperative Transaction Report</h1>
  <p class="muted">${escapeHtml(reportType === "yearly" ? "Yearly" : "Monthly")} report: ${escapeHtml(reportRows.from)} to ${escapeHtml(reportRows.to)}</p>
  <div class="grid">
    <div class="card"><div class="label">Member Transactions</div><div class="value">${reportRows.member.length}</div></div>
    <div class="card"><div class="label">Pending</div><div class="value">${pending}</div></div>
    <div class="card"><div class="label">Approved Credits</div><div class="value">${currency.format(approvedCredits)}</div></div>
    <div class="card"><div class="label">Approved Debits</div><div class="value">${currency.format(approvedDebits)}</div></div>
    <div class="card"><div class="label">Treasury Entries</div><div class="value">${reportRows.treasury.length}</div></div>
    <div class="card"><div class="label">Treasury Movement</div><div class="value">${currency.format(treasuryTotal)}</div></div>
    <div class="card"><div class="label">Treasury Cash</div><div class="value">${currency.format(treasurySummary.physicalTreasuryCash)}</div></div>
    <div class="card"><div class="label">Association Available</div><div class="value">${currency.format(treasurySummary.associationAvailableBalance)}</div></div>
  </div>
  <h2>Transaction Type Summary</h2>
  <table><thead><tr><th>Type</th><th>Total Amount</th></tr></thead><tbody>
    ${Object.entries(typeBuckets)
      .map(([type, amount]) => `<tr><td>${escapeHtml(type)}</td><td>${currency.format(amount)}</td></tr>`)
      .join("") || "<tr><td colspan='2'>No member transactions in this period.</td></tr>"}
  </tbody></table>
  <h2>Status Summary</h2>
  <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>
    ${Object.entries(statusBuckets)
      .map(([status, count]) => `<tr><td>${escapeHtml(status)}</td><td>${count}</td></tr>`)
      .join("") || "<tr><td colspan='2'>No statuses in this period.</td></tr>"}
  </tbody></table>
  <h2>Recent Member Transactions</h2>
  <table><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Status</th><th>Amount</th></tr></thead><tbody>
    ${reportRows.member
      .slice(0, 50)
      .map(
        (item) =>
          `<tr><td>${escapeHtml(formatDateTime(item.createdAt))}</td><td>${escapeHtml(item.wallet.member.fullName)}</td><td>${escapeHtml(item.type.replaceAll("_", " "))}</td><td>${escapeHtml(item.status)}</td><td>${currency.format(item.amount)}</td></tr>`,
      )
      .join("") || "<tr><td colspan='5'>No member transactions in this period.</td></tr>"}
  </tbody></table>
  <h2>Recent Treasury Ledger</h2>
  <table><thead><tr><th>Date</th><th>Source</th><th>Description</th><th>Amount</th></tr></thead><tbody>
    ${reportRows.treasury
      .slice(0, 50)
      .map(
        (item) =>
          `<tr><td>${escapeHtml(formatDateTime(item.createdAt))}</td><td>${escapeHtml(item.sourceType)}</td><td>${escapeHtml(item.description)}</td><td>${currency.format(item.amount)}</td></tr>`,
      )
      .join("") || "<tr><td colspan='4'>No treasury entries in this period.</td></tr>"}
  </tbody></table>
</body>
</html>`;

    const win = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!win) {
      showErrorToast("Please allow popups to generate the report.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
  }

  async function updateTransaction(id: string, values: EditTransactionValues) {
    try {
      await api.patch(`/transactions/${id}`, values);
      showSuccessToast("Transaction updated successfully.");
      await memberTransactions.refetch();
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to update transaction.",
      );
      throw error;
    }
  }

  const createTreasuryEntry = (close?: () => void) =>
    handleSubmit(async (values) => {
      try {
        setCreatingEntry(true);
        await api.post("/wallet/cooperative/entries", {
          type: values.type,
          amount: Number(values.amount),
          category: values.category,
          description: values.description,
          reference: values.reference || undefined,
        });
        showSuccessToast("Treasury entry added successfully.");
        reset();
        await Promise.all([wallet.refetch(), treasuryEntries.refetch()]);
        close?.();
      } catch (error: any) {
        showErrorToast(
          error?.response?.data?.message || "Unable to add treasury entry.",
        );
      } finally {
        setCreatingEntry(false);
      }
    });

  const summaryCards =
    tab === "member" ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          description="All member wallet transactions recorded."
          href="/admin/transactions"
          icon={<CreditCard className="h-5 w-5" />}
          title="Member Transactions"
          tone="green"
          value={memberSummary.total}
        />
        <DashboardMetricCard
          description="Transactions still waiting for settlement or review."
          href="/admin/transactions"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Pending"
          tone={memberSummary.pending ? "amber" : "neutral"}
          value={memberSummary.pending}
        />
        <DashboardMetricCard
          description="All approved wallet credits recorded."
          href="/admin/transactions"
          icon={<TrendingUp className="h-5 w-5" />}
          title="Approved Credits"
          value={currency.format(memberSummary.totalCredits)}
        />
        <DashboardMetricCard
          description="All approved wallet debits recorded."
          href="/admin/transactions"
          icon={<TrendingDown className="h-5 w-5" />}
          title="Approved Debits"
          value={currency.format(memberSummary.totalDebits)}
        />
      </div>
    ) : (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {wallet.loading && allTreasuryEntries.loading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-[2rem]" />
        ))
      ) : (
        <>
          <DashboardMetricCard
            description="Physical money expected inside the association bank account."
            href="/admin/transactions"
            icon={<CreditCard className="h-5 w-5" />}
            title="Treasury Cash"
            tone="green"
            value={currency.format(treasurySummary.physicalTreasuryCash)}
          />
          <DashboardMetricCard
            description="Member-owned wallet funds held by the association."
            href="/admin/transactions"
            icon={<CreditCard className="h-5 w-5" />}
            title="Member Wallet Liability"
            value={currency.format(treasurySummary.memberWalletLiability)}
          />
          <DashboardMetricCard
            description="Cooperative-owned funds available for loans and spending."
            href="/admin/transactions"
            icon={<TrendingUp className="h-5 w-5" />}
            title="Association Available"
            value={currency.format(treasurySummary.associationAvailableBalance)}
          />
          <DashboardMetricCard
            description="Total treasury income minus total treasury expense."
            href="/admin/transactions"
            icon={<TrendingDown className="h-5 w-5" />}
            title="Net Treasury Flow"
            tone={
              treasurySummary.netTreasuryFlow < 0
                ? "red"
                : "neutral"
            }
            value={currency.format(treasurySummary.netTreasuryFlow)}
          />
        </>
      )}
    </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Review member wallet activity, auto-generated deductions, and treasury entries in one admin workspace."
        actions={
          <div className="flex flex-wrap gap-2">
            <AdminModal
              description="Choose a monthly range or a one-year period. The report opens in a print-ready PDF view."
              title="Generate Transaction Report"
              trigger={
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--background-200)] bg-white px-5 py-3 text-sm font-semibold text-text-800 transition hover:bg-[var(--background-50)] dark:border-[var(--background-700)] dark:bg-[var(--background-900)] dark:text-text-100"
                  type="button"
                >
                  <FileDown className="h-4 w-4" />
                  Generate report
                </button>
              }
            >
              {() => (
                <>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-background-100 p-1 dark:bg-background-900">
                      {[
                        ["monthly", "Monthly"],
                        ["yearly", "Yearly"],
                      ].map(([id, label]) => (
                        <button
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            reportType === id
                              ? "bg-white text-text-900 shadow-sm dark:bg-background-800 dark:text-text-50"
                              : "text-text-500"
                          }`}
                          key={id}
                          onClick={() => setReportType(id as "monthly" | "yearly")}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <DateRangePicker
                      control={reportControl}
                      label=""
                      name="reportDateRange"
                    />
                    <p className="text-xs leading-5 text-text-500 dark:text-text-300">
                      Monthly reports can cover one month or a range such as
                      December to February. Yearly reports can start from any
                      month, such as September to August, but cannot exceed one
                      year.
                    </p>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                      onClick={generateTransactionReport}
                      type="button"
                    >
                      Download PDF
                    </button>
                  </div>
                </>
              )}
            </AdminModal>
            <AdminModal
              description="Create a treasury income or expense entry and watch the summary cards update immediately."
              title="Add Treasury Entry"
              trigger={
                <button
                  className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white"
                  type="button"
                >
                  Add transaction
                </button>
              }
            >
              {({ close }) => (
                <>
                  <div className="grid gap-4">
                    <select
                      className="min-h-12 rounded-2xl border border-[var(--primary-900)/12] bg-white px-4 text-sm text-text-900 outline-none"
                      onChange={(event) =>
                        setValue(
                          "type",
                          event.target.value as "INCOME" | "EXPENSE",
                        )
                      }
                      value={watch("type")}
                    >
                      <option value="INCOME">Income</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                    <NumberInput
                      className="rounded-2xl"
                      control={control}
                      label="Amount"
                      name={"amount" as never}
                      min={0}
                    />
                    <TextInput
                      className="rounded-2xl"
                      control={control}
                      label="Category"
                      name={"category" as never}
                      placeholder="Operations"
                    />
                    <TextareaInput
                      className="rounded-2xl"
                      control={control}
                      label="Description"
                      name={"description" as never}
                      placeholder="Describe this entry"
                      rows={4}
                    />
                    <TextInput
                      className="rounded-2xl"
                      control={control}
                      label="Reference"
                      name={"reference" as never}
                      placeholder="Optional reference"
                    />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      className="rounded-full bg-[var(--primary-700)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
                      disabled={creatingEntry}
                      onClick={() => void createTreasuryEntry(close)()}
                      type="button"
                    >
                      {creatingEntry ? "Saving..." : "Create entry"}
                    </button>
                  </div>
                </>
              )}
            </AdminModal>
          </div>
        }
      />

      <AdminTabs
        items={[
          { id: "treasury", label: "Treasury Ledger" },
          { id: "member", label: "Member Transactions" },
        ]}
        onChange={setTab}
        value={tab}
      />

      {summaryCards}

      <DashboardPanel
        title="How Stats Are Calculated"
        subtitle={
          tab === "treasury"
            ? "Treasury cards use the cooperative wallet summary and ledger reconciliation."
            : "Member transaction cards use the full transaction API summary. Table rows use the selected period."
        }
      >
        <AdminModal
          description="A detailed explanation of the active transaction statistics."
          title={
            tab === "treasury"
              ? "Treasury Stats Calculation"
              : "Member Transaction Stats Calculation"
          }
          trigger={
            <button
              className="text-sm font-semibold text-[var(--primary-700)] underline-offset-4 hover:underline dark:text-[var(--primary-300)]"
              type="button"
            >
              View calculation details
            </button>
          }
        >
          {tab === "treasury" ? (
            <div className="grid gap-3 text-sm text-text-500 dark:text-text-300 md:grid-cols-2">
              <p>
                <span className="font-semibold text-text-900 dark:text-text-50">
                  Treasury Cash:
                </span>{" "}
                physical money expected inside the association bank account.
              </p>
              <p>
                <span className="font-semibold text-text-900 dark:text-text-50">
                  Member Wallet Liability:
                </span>{" "}
                member-owned wallet funds still held by the association.
              </p>
              <p>
                <span className="font-semibold text-text-900 dark:text-text-50">
                  Association Available:
                </span>{" "}
                cooperative-owned funds available for loans and expenses.
              </p>
              <p>
                <span className="font-semibold text-text-900 dark:text-text-50">
                  Net Treasury Flow:
                </span>{" "}
                total treasury income minus total treasury expense.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 text-sm text-text-500 dark:text-text-300 md:grid-cols-2">
              <p>
                <span className="font-semibold text-text-900 dark:text-text-50">
                  Member Transactions:
                </span>{" "}
                total transaction records returned by the full API summary.
              </p>
              <p>
                <span className="font-semibold text-text-900 dark:text-text-50">
                  Pending:
                </span>{" "}
                transactions still waiting for approval, settlement, or review.
              </p>
              <p>
                <span className="font-semibold text-text-900 dark:text-text-50">
                  Approved Credits:
                </span>{" "}
                all approved funding, credit, refund, and maturity transactions.
              </p>
              <p>
                <span className="font-semibold text-text-900 dark:text-text-50">
                  Approved Debits:
                </span>{" "}
                all approved deductions, withdrawals, and other debit transactions.
              </p>
            </div>
          )}
        </AdminModal>
      </DashboardPanel>

      {tab === "member" ? (
        <DataTable
          columns={[
            {
              key: "member",
              header: "Member",
              render: (item) => (
                <div>
                  <p className="font-semibold text-text-900">
                    {item.wallet.member.fullName}
                  </p>
                  <p className="text-xs text-text-400">
                    {item.wallet.member.membershipNumber}
                  </p>
                </div>
              ),
            },
            {
              key: "type",
              header: "Type",
              render: (item) => (
                <div>
                  <p className="font-semibold text-text-900">
                    {item.type.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-text-400">
                    {item.category || "No category"}
                  </p>
                </div>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              render: (item) => currency.format(item.amount),
            },
            {
              key: "createdAt",
              header: "Date",
              render: (item) => formatDateTime(item.createdAt),
              sortValue: (item) => new Date(item.createdAt),
            },
            {
              key: "status",
              header: "Status",
              render: (item) => (
                <StatusBadge
                  status={item.status}
                  variant={variantForStatus(item.status) as any}
                />
              ),
            },
            {
              key: "edit",
              header: "Actions",
              align: "right",
              isAction: true,
              render: (item) =>
                item.editable ? (
                  <div onClick={(event) => event.stopPropagation()}>
                    <AdminModal
                      description="Only manual/admin-created transactions can be edited. Changes are written to the audit trail."
                      title="Edit Transaction"
                      trigger={
                        <button
                          className="inline-flex items-center gap-2 font-semibold text-[var(--primary-700)]"
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      }
                    >
                      {({ close }) => (
                        <TransactionEditForm
                          item={item}
                          onSubmit={(values) =>
                            updateTransaction(item.id, values)
                          }
                          onSuccess={close}
                        />
                      )}
                    </AdminModal>
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-2 text-sm text-text-400"
                    title={
                      item.lockReason || "This transaction cannot be edited."
                    }
                  >
                    <Lock className="h-4 w-4" />
                    Locked
                  </div>
                ),
            },
          ]}
          data={memberTransactions.data?.items ?? []}
          emptyDescription={
            memberTransactions.error || "No member transactions found."
          }
          loading={memberTransactions.loading}
          onRowClick={(item) => setSelectedTransaction(item)}
          searchableText={(item) =>
            `${item.wallet.member.fullName} ${item.wallet.member.membershipNumber} ${item.type} ${item.status} ${item.reference ?? ""} ${item.createdAt}`
          }
          searchPlaceholder="Search member transactions..."
          toolbar={dateRangeToolbar}
        />
      ) : (
        <>
          <DataTable
            columns={[
              {
                key: "sourceType",
                header: "Source",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-text-900">
                      {item.sourceType.replaceAll("_", " ")}
                    </p>
                  </div>
                ),
              },
              {
                key: "direction",
                header: "Movement",
                render: (item) => (
                  <span className="font-semibold text-text-900">
                    {item.lines
                      .map((line) => `${line.direction} ${line.account.replaceAll("_", " ")}`)
                      .join(" / ")}
                  </span>
                ),
              },
              {
                key: "description",
                header: "Description",
                render: (item) => item.description,
              },
              {
                key: "amount",
                header: "Amount",
                render: (item) => currency.format(item.amount),
              },
              {
                key: "createdAt",
                header: "Created At",
                render: (item) =>
                  new Date(item.createdAt).toLocaleDateString("en-NG"),
              },
            ]}
            data={treasuryRows}
            emptyDescription={
              treasuryEntries.error || "No treasury ledger entries found."
            }
            loading={treasuryEntries.loading}
            onRowClick={(item) => setSelectedLedger(item)}
            searchableText={(item) =>
              `${item.sourceType} ${item.reference ?? ""} ${item.description} ${item.lines.map((line) => line.account).join(" ")}`
            }
            searchPlaceholder="Search treasury ledger..."
            toolbar={dateRangeToolbar}
          />
        </>
      )}
      {selectedTransaction ? (
        <TransactionReceiptModal
          amount={selectedTransaction.amount}
          date={selectedTransaction.createdAt}
          fields={[
            {
              label: "Member",
              value: selectedTransaction.wallet.member.fullName,
            },
            {
              label: "Membership No.",
              value: selectedTransaction.wallet.member.membershipNumber,
            },
            {
              label: "Type",
              value: selectedTransaction.type.replaceAll("_", " "),
            },
            { label: "Category", value: selectedTransaction.category || "-" },
            {
              label: "Description",
              value: selectedTransaction.description || "-",
            },
            { label: "Reference", value: selectedTransaction.reference || "-" },
            {
              label: "Edit State",
              value: selectedTransaction.editable
                ? "Editable"
                : selectedTransaction.lockReason || "Locked",
            },
          ]}
          onClose={() => setSelectedTransaction(null)}
          reference={selectedTransaction.reference || selectedTransaction.id}
          status={selectedTransaction.status}
          timeline={[
            {
              date: selectedTransaction.createdAt,
              label: "Transaction created",
              status: selectedTransaction.status,
            },
          ]}
          title="Member Transaction Receipt"
        />
      ) : null}
      {selectedLedger ? (
        <TransactionReceiptModal
          amount={selectedLedger.amount}
          date={selectedLedger.createdAt}
          fields={[
            { label: "Source", value: selectedLedger.sourceType },
            { label: "Source ID", value: selectedLedger.sourceId || "-" },
            { label: "Description", value: selectedLedger.description },
            { label: "Actor", value: selectedLedger.actor?.email || "System" },
            {
              label: "Ledger Lines",
              value: selectedLedger.lines
                .map(
                  (line) =>
                    `${line.direction} ${line.account.replaceAll("_", " ")} ${currency.format(line.amount)}${
                      line.member ? ` (${line.member.fullName})` : ""
                    }`,
                )
                .join(" | "),
            },
          ]}
          onClose={() => setSelectedLedger(null)}
          reference={selectedLedger.reference || selectedLedger.id}
          status="POSTED"
          timeline={[
            {
              label: "Ledger entry posted",
              date: selectedLedger.createdAt,
              status: "POSTED",
            },
          ]}
          title="Treasury Ledger Receipt"
        />
      ) : null}
    </div>
  );
}
