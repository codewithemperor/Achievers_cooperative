import { Card, Chip } from "@heroui/react";

const mockNotifications = [
  {
    id: "1",
    title: "Wallet Funded",
    message:
      "Your wallet has been credited with ₦50,000 after successful payment verification.",
    time: "2 hours ago",
    read: false,
  },
  {
    id: "2",
    title: "Loan Application Update",
    message:
      "Your loan application for ₦100,000 has been approved. Funds will be disbursed shortly.",
    time: "1 day ago",
    read: false,
  },
  {
    id: "3",
    title: "Savings Contribution",
    message:
      "Your monthly savings contribution of ₦20,000 has been processed successfully.",
    time: "3 days ago",
    read: true,
  },
  {
    id: "4",
    title: "Welcome to Achievers",
    message:
      "Your account has been activated. You now have full access to all member services.",
    time: "1 week ago",
    read: true,
  },
];

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--brand-ink)]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Stay updated on your account activity
          </p>
        </div>
        <button className="text-xs font-medium text-[var(--brand-gold)] hover:underline">
          Mark all read
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {mockNotifications.map((notif) => (
          <Card
            key={notif.id}
            className={`border bg-white ${notif.read ? "border-slate-200" : "border-[var(--brand-gold)] bg-[var(--brand-mist)]"}`}
          >
            <Card.Content className="p-4">
              <div className="flex items-start gap-3">
                {!notif.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-gold)]" />
                )}
                <div className={!notif.read ? "" : "pl-5"}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[var(--brand-ink)]">
                      {notif.title}
                    </p>
                    <span className="text-[11px] text-slate-400">
                      {notif.time}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {notif.message}
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  );
}
