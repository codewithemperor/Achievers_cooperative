"use client";

import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface MemberTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
}

export function MemberTable<T>({
  columns,
  data,
  loading = false,
  emptyText = "No records found.",
}: MemberTableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--background-200)] bg-white dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
        <div className="divide-y divide-[var(--background-200)] dark:divide-[var(--background-800)]">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid gap-3 px-4 py-4 md:grid-cols-4">
              {Array.from({ length: Math.min(columns.length, 4) }).map(
                (__, cellIndex) => (
                  <div
                    key={cellIndex}
                    className="h-4 animate-pulse rounded bg-[var(--background-200)] dark:bg-[var(--background-700)]"
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-background-300 bg-[var(--background-50)] px-6 py-10 text-center text-sm text-text-400 dark:border-[var(--background-700)] dark:bg-[var(--background-900)]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--background-200)] bg-white dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--background-50)] dark:bg-[var(--background-800)]">
            <tr className="divide-x divide-[var(--background-200)] dark:divide-[var(--background-700)]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 font-semibold text-text-900 dark:text-text-50 ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--background-200)] dark:divide-[var(--background-800)]">
            {data.map((item, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-text-600 dark:text-[var(--text-300)] ${column.className ?? ""}`}
                  >
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
