import { Card, Chip } from "@heroui/react";
import { formatCurrency } from "@achievers/utils";

const mockWallets = [
  {
    id: "1",
    member: "Adaeze Okonkwo",
    memberNo: "ACH-000001",
    available: 150000,
    pending: 30000,
    currency: "NGN",
    transactions: 24,
  },
  {
    id: "2",
    member: "Chidi Eze",
    memberNo: "ACH-000002",
    available: 250000,
    pending: 0,
    currency: "NGN",
    transactions: 18,
  },
  {
    id: "3",
    member: "Emeka Nwosu",
    memberNo: "ACH-000004",
    available: 75000,
    pending: 0,
    currency: "NGN",
    transactions: 12,
  },
  {
    id: "4",
    member: "Yusuf Abdullahi",
    memberNo: "ACH-000006",
    available: 320000,
    pending: 50000,
    currency: "NGN",
    transactions: 31,
  },
  {
    id: "5",
    member: "Funke Adeyemi",
    memberNo: "ACH-000003",
    available: 0,
    pending: 0,
    currency: "NGN",
    transactions: 2,
  },
];

export default function WalletsPage() {
  const totalAvailable = mockWallets.reduce((sum, w) => sum + w.available, 0);
  const totalPending = mockWallets.reduce((sum, w) => sum + w.pending, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">
          Wallets
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of all member wallets
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="border border-slate-200 bg-white">
          <Card.Content className="p-5">
            <p className="text-sm text-slate-400">Total Available Balance</p>
            <p className="mt-1 text-2xl font-bold text-[var(--brand-ink)]">
              {formatCurrency(totalAvailable)}
            </p>
          </Card.Content>
        </Card>
        <Card className="border border-slate-200 bg-white">
          <Card.Content className="p-5">
            <p className="text-sm text-slate-400">Total Pending Balance</p>
            <p className="mt-1 text-2xl font-bold text-[var(--brand-gold)]">
              {formatCurrency(totalPending)}
            </p>
          </Card.Content>
        </Card>
      </div>

      <Card className="border border-slate-200 bg-white">
        <Card.Content className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Member
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Available
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Pending
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Transactions
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockWallets.map((wallet) => (
                  <tr
                    key={wallet.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-[var(--brand-ink)]">
                        {wallet.member}
                      </p>
                      <p className="text-xs text-slate-400">
                        {wallet.memberNo}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-semibold text-green-600">
                      {formatCurrency(wallet.available)}
                    </td>
                    <td className="px-5 py-3">
                      {wallet.pending > 0 ? (
                        <span className="font-medium text-[var(--brand-gold)]">
                          {formatCurrency(wallet.pending)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {wallet.transactions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-4 md:hidden">
            {mockWallets.map((wallet) => (
              <div
                key={wallet.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="text-sm font-medium text-[var(--brand-ink)]">
                  {wallet.member}
                </p>
                <p className="text-xs text-slate-400">{wallet.memberNo}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Available</p>
                    <p className="font-semibold text-green-600">
                      {formatCurrency(wallet.available)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Pending</p>
                    <p className="font-medium text-[var(--brand-gold)]">
                      {formatCurrency(wallet.pending)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
