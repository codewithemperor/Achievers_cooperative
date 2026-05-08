"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AutocompleteInput } from "@/components/form-input";
import type { AutocompleteOption } from "@/components/form-input";
import { MemberModal } from "@/components/member-modal";
import { apiCallWithAlert, MySwal } from "@/lib/alert";
import api, { fetchMemberApi } from "@/lib/member-api";
import { TransactionCard } from "@/components/transaction-card";
import { useMemberData } from "@/hooks/use-member-data";

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

interface NigerianBank {
  name: string;
  code: string;
}

type BankOption = AutocompleteOption & {
  bankCode: string;
  bankName: string;
};

function errorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return Array.isArray(message) ? message.join("\n") : String(message);
}

function maskAccountNumber(num: string) {
  if (!num || num.length < 4) return num;
  return `**** ${num.slice(-4)}`;
}

export default function AccountBankAccountPage() {
  const bankAccounts = useMemberData<BankAccount[]>("/bank-accounts", []);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [banks, setBanks] = useState<NigerianBank[]>([]);
  const [bankForm, setBankForm] = useState({
    bankKey: "",
    bankCode: "",
    accountNumber: "",
    accountName: "",
  });
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankVerifying, setBankVerifying] = useState(false);
  const bankOptions = useMemo<BankOption[]>(
    () =>
      banks.map((bank, index) => ({
        id: `${bank.code}-${bank.name}-${index}`,
        bankCode: bank.code,
        bankName: bank.name,
        label: bank.name,
        sub: bank.code,
      })),
    [banks],
  );

  async function openBankModal() {
    setBankForm({
      bankKey: "",
      bankCode: "",
      accountNumber: "",
      accountName: "",
    });
    setIsBankModalOpen(true);
    setBanksLoading(true);
    try {
      const data = await fetchMemberApi<NigerianBank[]>("/bank-accounts/banks");
      setBanks(data);
    } catch (error: any) {
      await MySwal.fire({
        title: "Unable to load banks",
        text: errorMessage(error, "Please try loading the bank list again."),
        icon: "error",
        confirmButtonText: "Okay",
      });
    } finally {
      setBanksLoading(false);
    }
  }

  async function verifyBankAccount() {
    if (!bankForm.bankCode || bankForm.accountNumber.length !== 10) return;
    setBankVerifying(true);
    try {
      const { data } = await api.post<{ accountName: string }>(
        "/bank-accounts/verify",
        {
          bankCode: bankForm.bankCode,
          accountNumber: bankForm.accountNumber,
        },
      );
      setBankForm((prev) => ({ ...prev, accountName: data.accountName }));
    } catch (error: any) {
      await MySwal.fire({
        title: "Unable to verify account",
        text: errorMessage(
          error,
          "Please confirm the bank and account number, then try again.",
        ),
        icon: "error",
        confirmButtonText: "Okay",
      });
    } finally {
      setBankVerifying(false);
    }
  }

  async function saveBankAccount() {
    const selectedBank = bankOptions.find((b) => b.id === bankForm.bankKey);
    if (!selectedBank || !bankForm.accountName) return;

    const result = await apiCallWithAlert({
      title: "Add Bank Account",
      loadingText: "Saving bank account...",
      apiCall: () =>
        api.post("/bank-accounts", {
          bankName: selectedBank.bankName,
          bankCode: bankForm.bankCode,
          accountNumber: bankForm.accountNumber,
          accountName: bankForm.accountName,
          isDefault: bankAccounts.data.length === 0,
        }),
      successTitle: "Bank Account Added",
      successText: `${selectedBank.bankName} (${maskAccountNumber(bankForm.accountNumber)}) has been saved.`,
    });

    if (result) {
      setIsBankModalOpen(false);
      await bankAccounts.refetch();
    }
  }

  async function deleteBankAccount(id: string, bankName: string) {
    const result = await MySwal.fire({
      title: "Delete bank account?",
      text: `Remove ${bankName} from your saved accounts?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;

    const removed = await apiCallWithAlert({
      title: "Delete Bank Account",
      loadingText: "Removing bank account...",
      apiCall: () => api.delete(`/bank-accounts/${id}`),
      successTitle: "Bank Account Removed",
      successText: `${bankName} has been deleted.`,
    });

    if (removed) {
      await bankAccounts.refetch();
    }
  }

  async function setDefaultBankAccount(id: string) {
    const updated = await apiCallWithAlert({
      title: "Set Default Bank",
      loadingText: "Updating...",
      apiCall: () => api.patch(`/bank-accounts/${id}`, { isDefault: true }),
      successTitle: "Default Updated",
      successText: "Your default bank account has been updated.",
    });

    if (updated) {
      await bankAccounts.refetch();
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text-900 dark:text-text-50">
              Bank account
            </h1>
            <p className="mt-1 text-sm text-text-400">
              Manage the account used for loan disbursements and payouts.
            </p>
          </div>
          <button
            className="rounded-full bg-[var(--primary-600)] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void openBankModal()}
            type="button"
          >
            Add account
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {bankAccounts.data.length ? (
          bankAccounts.data.map((acct) => (
            <TransactionCard
              key={acct.id}
              type="BANK"
              title={acct.bankName}
              subtitle={`${acct.accountName} • ${maskAccountNumber(acct.accountNumber)}`}
              amountLabel={acct.isDefault ? "Default" : "Saved"}
              status={acct.isDefault ? "ACTIVE" : "CONFIRMED"}
              timestamp={new Date().toISOString()}
              extra={
                <div className="flex flex-wrap gap-2">
                  {!acct.isDefault ? (
                    <button
                      className="rounded-full border border-[var(--background-200)] px-3 py-1.5 text-xs font-semibold text-text-700 dark:text-[var(--text-200)]"
                      onClick={() => void setDefaultBankAccount(acct.id)}
                      type="button"
                    >
                      Set default
                    </button>
                  ) : null}
                  <button
                    className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300"
                    onClick={() =>
                      void deleteBankAccount(acct.id, acct.bankName)
                    }
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              }
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-background-300 px-5 py-10 text-center text-sm text-text-400">
            No bank accounts added yet.
          </div>
        )}
      </section>

      <MemberModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        title="Add Account Number"
        description="Select your bank, enter your account number, and verify the account name before saving."
      >
        <div className="grid gap-4">
          <AutocompleteInput
            label="Bank name"
            placeholder={
              banksLoading ? "Loading banks..." : "Search for your bank..."
            }
            options={bankOptions}
            selectedKey={bankForm.bankKey || null}
            onSelectionChange={(key) => {
              const selectedBank = bankOptions.find(
                (bank) => String(bank.id) === String(key),
              );
              setBankForm((prev) => ({
                ...prev,
                bankKey: key ? String(key) : "",
                bankCode: selectedBank?.bankCode ?? "",
                accountName: "",
              }));
            }}
            isDisabled={banksLoading}
            isRequired
            description={
              banksLoading
                ? "Loading the latest bank list..."
                : banks.length
                  ? `${banks.length} banks, fintechs, and microfinance institutions loaded.`
                  : "Open the list to load available banks."
            }
          />
          {banksLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-background-200 bg-background-50 px-4 py-3 text-sm text-text-500 dark:border-background-700 dark:bg-background-900 dark:text-text-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching all banks. This may take a moment.
            </div>
          ) : null}
          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-text-700 dark:text-text-200"
              htmlFor="bank-account-number"
            >
              Account number
            </label>
            <div className="flex gap-2">
              <input
                id="bank-account-number"
                className="min-h-12 flex-1 rounded-2xl border border-background-200 bg-white px-4 py-3 text-sm text-text-700 outline-none transition-colors focus:border-primary-400 dark:border-background-700 dark:bg-background-900 dark:text-text-300"
                maxLength={10}
                placeholder="10-digit account number"
                value={bankForm.accountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setBankForm((prev) => ({
                    ...prev,
                    accountNumber: val,
                    accountName: "",
                  }));
                }}
                type="tel"
              />
              <button
                className="shrink-0 rounded-2xl border border-background-200 bg-white px-4 py-3 text-sm font-semibold text-text-700 transition-colors hover:bg-background-100 dark:border-background-700 dark:bg-background-800 dark:text-text-300 disabled:opacity-60"
                disabled={
                  !bankForm.bankCode ||
                  bankForm.accountNumber.length !== 10 ||
                  bankVerifying
                }
                onClick={() => void verifyBankAccount()}
                type="button"
              >
                {bankVerifying ? "..." : "Verify"}
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-text-700 dark:text-text-200"
              htmlFor="bank-account-name"
            >
              Account name
            </label>
            <input
              id="bank-account-name"
              className="min-h-12 rounded-2xl border border-background-200 bg-background-50 px-4 py-3 text-sm text-text-700 outline-none dark:border-background-700 dark:bg-background-900 dark:text-text-300"
              readOnly
              placeholder="Account name will appear after verification"
              value={bankForm.accountName}
            />
          </div>
          <button
            className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={
              !bankForm.bankCode ||
              !bankForm.accountName ||
              bankForm.accountNumber.length !== 10
            }
            onClick={() => void saveBankAccount()}
            type="button"
          >
            Save bank account
          </button>
        </div>
      </MemberModal>
    </div>
  );
}
