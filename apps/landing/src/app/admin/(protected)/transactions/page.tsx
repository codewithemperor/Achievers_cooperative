"use client";

import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import { getApiBaseUrl } from "@/lib/api";
import { getSession } from "@/lib/session";

interface TransactionsResponse {
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    wallet: { member: { fullName: string } };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function TransactionsPage() {
  const transactions = useApi<TransactionsResponse>("/transactions");

  function exportCsv() {
    const session = getSession();
    if (!session?.token) {
      return;
    }

    fetch(`${getApiBaseUrl()}/transactions/export`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "transactions.csv";
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Filterable transaction stream across wallets, loans, and investments."
        actions={
          <button className="rounded-full bg-[var(--color-green)] px-4 py-2 text-sm font-semibold text-white" onClick={exportCsv} type="button">
            Export CSV
          </button>
        }
      />

      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (item) => <span className="font-semibold text-[var(--color-dark)]">{item.wallet.member.fullName}</span>,
          },
          {
            key: "type",
            header: "Type",
            render: (item) => <StatusBadge status={item.type} variant="info" />,
          },
          {
            key: "amount",
            header: "Amount",
            render: (item) => currency.format(item.amount),
          },
          {
            key: "status",
            header: "Status",
            render: (item) => (
              <StatusBadge
                status={item.status}
                variant={item.status === "APPROVED" ? "success" : item.status === "PENDING" ? "warning" : "danger"}
              />
            ),
          },
        ]}
        data={transactions.data?.items ?? []}
        emptyDescription={transactions.error || "No transactions found."}
      />
    </div>
  );
}
