"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Tab,
  TabIndicator,
  TabList,
  TabListContainer,
  TabPanel,
  TabsRoot,
} from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { ActionMenu } from "@/components/ui/action-menu";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

interface PaymentsResponse {
  items: Array<{
    id: string;
    amount: number;
    status: string;
    receiptUrl: string;
    createdAt: string;
    member: { fullName: string; membershipNumber?: string };
  }>;
}

interface MemberTransactionsResponse {
  items: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    reference?: string | null;
    description?: string | null;
    createdAt: string;
    wallet?: {
      member?: {
        fullName: string;
        membershipNumber: string;
      };
    };
  }>;
}

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function PaymentsPage() {
  const payments = useApi<PaymentsResponse>("/payments");
  const transactions = useApi<MemberTransactionsResponse>("/transactions");
  const [selectedProof, setSelectedProof] =
    useState<PaymentsResponse["items"][number] | null>(null);

  const paymentTransactions = useMemo(
    () =>
      (transactions.data?.items ?? []).filter((item) => {
        const value = `${item.type} ${item.description || ""}`.toUpperCase();
        return value.includes("FUND") || value.includes("PAYMENT");
      }),
    [transactions.data],
  );

  async function approve(id: string) {
    try {
      await api.patch(`/payments/${id}/approve`);
      showSuccessToast("Payment approved successfully.");
      await Promise.all([payments.refetch(), transactions.refetch()]);
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to approve payment.",
      );
      throw error;
    }
  }

  async function reject(id: string) {
    try {
      await api.patch(`/payments/${id}/reject`, {
        reason: "Verification failed",
      });
      showSuccessToast("Payment rejected successfully.");
      await Promise.all([payments.refetch(), transactions.refetch()]);
    } catch (error: any) {
      showErrorToast(
        error?.response?.data?.message || "Unable to reject payment.",
      );
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Review uploaded transfer receipts and verification status before wallet credit is applied."
      />
      <TabsRoot defaultSelectedKey="requests">
        <TabListContainer className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary-900/10 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <TabList
            aria-label="Payment sections"
            className="relative flex w-full gap-1 rounded-xl bg-background-100 p-1 sm:w-auto"
          >
            <Tab
              className="relative z-10 flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-text-500 selected:text-text-900 sm:flex-none"
              id="requests"
            >
              Requests
            </Tab>
            <Tab
              className="relative z-10 flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-text-500 selected:text-text-900 sm:flex-none"
              id="transactions"
            >
              Transactions
            </Tab>
            <TabIndicator className="rounded-lg bg-white shadow-sm" />
          </TabList>
          <p className="px-2 text-xs font-medium text-text-400">
            {(payments.data?.items ?? []).filter((item) => item.status === "PENDING").length} pending request(s)
          </p>
        </TabListContainer>

        <TabPanel id="requests">
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-text-900">
                      {item.member.fullName}
                    </p>
                    <p className="text-xs text-text-400">
                      {item.member.membershipNumber || "-"}
                    </p>
                  </div>
                ),
                sortValue: (item) => item.member.fullName,
              },
              {
                key: "amount",
                header: "Amount",
                render: (item) => currency.format(item.amount),
                sortValue: (item) => item.amount,
              },
              {
                key: "status",
                header: "Status",
                render: (item) => (
                  <StatusBadge
                    status={item.status}
                    variant={
                      item.status === "APPROVED"
                        ? "success"
                        : item.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  />
                ),
                sortValue: (item) => item.status,
              },
              {
                key: "createdAt",
                header: "Requested",
                render: (item) =>
                  new Date(item.createdAt).toLocaleString("en-NG"),
                sortValue: (item) => new Date(item.createdAt),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                isAction: true,
                render: (item) => (
                  <ActionMenu
                    items={[
                      {
                        label: "View proof",
                        isDisabled: !item.receiptUrl,
                        onSelect: () => setSelectedProof(item),
                      },
                      {
                        label: "Approve",
                        tone: "success",
                        isDisabled: item.status !== "PENDING",
                        confirmTitle: "Approve payment?",
                        confirmMessage:
                          "Approve this payment proof and credit the member wallet.",
                        onSelect: () => approve(item.id),
                      },
                      {
                        label: "Reject",
                        tone: "danger",
                        isDisabled: item.status !== "PENDING",
                        confirmTitle: "Reject payment?",
                        confirmMessage:
                          "Reject this payment proof and keep the wallet balance unchanged.",
                        onSelect: () => reject(item.id),
                      },
                    ]}
                  />
                ),
              },
            ]}
            data={payments.data?.items ?? []}
            emptyDescription={
              payments.error || "No payment verifications are waiting."
            }
            getRowKey={(item) => item.id}
            loading={payments.loading}
            searchableText={(item) =>
              `${item.member.fullName} ${item.member.membershipNumber || ""} ${item.amount} ${item.status}`
            }
            searchPlaceholder="Search payment requests..."
          />
        </TabPanel>

        <TabPanel id="transactions">
          <DataTable
            columns={[
              {
                key: "member",
                header: "Member",
                render: (item) => (
                  <div>
                    <p className="font-semibold text-text-900">
                      {item.wallet?.member?.fullName || "Member"}
                    </p>
                    <p className="text-xs text-text-400">
                      {item.wallet?.member?.membershipNumber || "-"}
                    </p>
                  </div>
                ),
                sortValue: (item) => item.wallet?.member?.fullName || "",
              },
              {
                key: "reference",
                header: "Reference",
                render: (item) => item.reference || item.description || "-",
                sortValue: (item) => item.reference || item.description || "",
              },
              {
                key: "amount",
                header: "Amount",
                render: (item) => currency.format(item.amount),
                sortValue: (item) => item.amount,
              },
              {
                key: "status",
                header: "Status",
                render: (item) => (
                  <StatusBadge
                    status={item.status}
                    variant={
                      item.status === "APPROVED"
                        ? "success"
                        : item.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  />
                ),
                sortValue: (item) => item.status,
              },
              {
                key: "createdAt",
                header: "Date",
                render: (item) =>
                  new Date(item.createdAt).toLocaleString("en-NG"),
                sortValue: (item) => new Date(item.createdAt),
              },
            ]}
            data={paymentTransactions}
            emptyDescription={
              transactions.error || "No payment transactions found."
            }
            getRowKey={(item) => item.id}
            loading={transactions.loading}
            searchableText={(item) =>
              `${item.wallet?.member?.fullName || ""} ${item.wallet?.member?.membershipNumber || ""} ${item.reference || ""} ${item.description || ""} ${item.amount} ${item.status}`
            }
            searchPlaceholder="Search payment transactions..."
          />
        </TabPanel>
      </TabsRoot>

      {selectedProof?.receiptUrl ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <button
            aria-label="Close payment proof"
            className="absolute inset-0"
            onClick={() => setSelectedProof(null)}
            type="button"
          />
          <div className="relative z-[101] w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-text-900">
                Payment proof
              </h2>
              <button
                className="rounded-xl border border-primary-900/12 px-3 py-1.5 text-sm font-semibold text-text-900"
                onClick={() => setSelectedProof(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="overflow-hidden rounded-xl bg-background-50 p-3">
              <Image
                alt="Payment proof"
                className="max-h-[75vh] w-full rounded-lg object-contain"
                height={900}
                src={selectedProof.receiptUrl}
                unoptimized
                width={900}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
