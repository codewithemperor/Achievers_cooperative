import { Card, Chip } from "@heroui/react";

const mockAuditLogs = [
  {
    id: "1",
    actor: "Super Admin",
    action: "APPROVE_FUNDING",
    entity: "Transaction",
    entityId: "TXN-001",
    target: "Adaeze Okonkwo - ₦50,000",
    date: "Apr 8, 2026 14:32",
  },
  {
    id: "2",
    actor: "Admin",
    action: "ACTIVATE_MEMBER",
    entity: "Member",
    entityId: "MEM-003",
    target: "Funke Adeyemi",
    date: "Apr 8, 2026 11:15",
  },
  {
    id: "3",
    actor: "Super Admin",
    action: "APPROVE_LOAN",
    entity: "LoanApplication",
    entityId: "LOAN-001",
    target: "Adaeze Okonkwo - ₦100,000",
    date: "Apr 7, 2026 16:45",
  },
  {
    id: "4",
    actor: "Admin",
    action: "REJECT_LOAN",
    entity: "LoanApplication",
    entityId: "LOAN-004",
    target: "Emeka Nwosu - ₦300,000",
    date: "Apr 6, 2026 09:20",
  },
  {
    id: "5",
    actor: "Super Admin",
    action: "DISBURSE_LOAN",
    entity: "LoanApplication",
    entityId: "LOAN-001",
    target: "Adaeze Okonkwo - ₦100,000",
    date: "Apr 5, 2026 14:00",
  },
  {
    id: "6",
    actor: "System",
    action: "MEMBER_REGISTERED",
    entity: "Member",
    entityId: "MEM-006",
    target: "Yusuf Abdullahi",
    date: "Apr 4, 2026 08:30",
  },
  {
    id: "7",
    actor: "Admin",
    action: "UPDATE_CONFIG",
    entity: "SystemConfig",
    entityId: "CHARGE_RATE",
    target: "Membership charge rate updated to 2%",
    date: "Apr 3, 2026 10:00",
  },
  {
    id: "8",
    actor: "Super Admin",
    action: "CREATE_INVESTMENT",
    entity: "InvestmentProduct",
    entityId: "INV-002",
    target: "Growth Fund - 18% p.a.",
    date: "Apr 2, 2026 15:30",
  },
];

const actionColor: Record<string, string> = {
  APPROVE_FUNDING: "success",
  ACTIVATE_MEMBER: "success",
  APPROVE_LOAN: "success",
  REJECT_LOAN: "danger",
  DISBURSE_LOAN: "success",
  MEMBER_REGISTERED: "default",
  UPDATE_CONFIG: "warning",
  CREATE_INVESTMENT: "default",
};

export default function AuditPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--brand-ink)]">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete trail of all system activities
        </p>
      </div>

      <Card className="border border-slate-200 bg-white">
        <Card.Content className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Timestamp
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Actor
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Action
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Details
                  </th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">
                    Entity
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockAuditLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {log.date}
                    </td>
                    <td className="px-5 py-3">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={log.actor === "System" ? "default" : "primary"}
                      >
                        {log.actor}
                      </Chip>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-medium text-[var(--brand-ink)]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{log.target}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {log.entity}/{log.entityId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-4 md:hidden">
            {mockAuditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium text-[var(--brand-ink)]">
                    {log.action}
                  </span>
                  <span className="text-[10px] text-slate-400">{log.date}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{log.target}</p>
                <div className="mt-2 flex gap-2 text-[10px]">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={log.actor === "System" ? "default" : "primary"}
                  >
                    {log.actor}
                  </Chip>
                  <span className="text-slate-400">
                    {log.entity}/{log.entityId}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
