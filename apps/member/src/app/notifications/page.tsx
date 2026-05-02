"use client";

import { useState } from "react";
import api from "@/lib/member-api";
import { useMemberData } from "@/hooks/use-member-data";
import { TransactionCard } from "@/components/transaction-card";

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
  const [markingAll, setMarkingAll] = useState(false);

  async function markAllRead() {
    try {
      setMarkingAll(true);
      await api.post("/notifications/read-all");
      await notifications.refetch();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">Notifications</h1>
            <p className="mt-1 text-sm text-[var(--text-400)]">Unread notifications: {notifications.data.unreadCount}</p>
          </div>
          <button
            className="rounded-full bg-[var(--primary-600)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={markingAll}
            onClick={() => void markAllRead()}
            type="button"
          >
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {notifications.data.items.length ? (
          notifications.data.items.map((item) => (
            <TransactionCard
              key={item.id}
              type="NOTICE"
              title={item.title}
              subtitle={item.message}
              amountLabel={item.readAt ? "Read" : "Unread"}
              status={item.readAt ? "CONFIRMED" : "PENDING"}
              timestamp={item.createdAt}
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--background-300)] px-5 py-10 text-center text-sm text-[var(--text-400)]">
            You do not have any notifications yet.
          </div>
        )}
      </section>
    </div>
  );
}
