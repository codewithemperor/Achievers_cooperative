"use client";

import { getApiBaseUrl, getMemberToken } from "../lib/member-api";
import { useMemberData } from "../lib/use-member-data";

interface NotificationsPayload {
  unreadCount: number;
  items: Array<{
    id: string;
    title: string;
    message: string;
    readAt?: string | null;
    createdAt: string;
  }>;
}

export default function NotificationsPage() {
  const notifications = useMemberData<NotificationsPayload>("/notifications", { unreadCount: 0, items: [] });

  async function markAllRead() {
    await fetch(`${getApiBaseUrl()}/notifications/read-all`, {
      method: "POST",
      headers: {
        ...(getMemberToken() ? { Authorization: `Bearer ${getMemberToken()}` } : {}),
      },
    });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-ink)]">Notifications</h1>
          <p className="mt-1 text-sm text-[var(--brand-moss)]">Unread notifications: {notifications.data.unreadCount}</p>
        </div>
        <button className="rounded-full border border-[var(--brand-stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-ink)]" onClick={() => void markAllRead()} type="button">
          Mark all read
        </button>
      </section>

      <div className="space-y-3">
        {notifications.data.items.length ? (
          notifications.data.items.map((item) => (
            <div key={item.id} className={`rounded-[1.5rem] border bg-white p-4 ${item.readAt ? "border-[var(--brand-stroke)]" : "border-[var(--brand-green)]"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-[var(--brand-ink)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--brand-moss)]">{item.message}</p>
                </div>
                <p className="text-xs text-[var(--brand-moss)]">{new Date(item.createdAt).toLocaleDateString("en-NG")}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--brand-stroke)] bg-white p-6 text-sm text-[var(--brand-moss)]">
            You do not have any notifications yet.
          </div>
        )}
      </div>
    </div>
  );
}
