import type { ReactNode } from "react";
import { Skeleton } from "@heroui/react";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  emptyTitle = "No records yet",
  emptyDescription = "Records will appear here when data becomes available.",
  loading = false,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-[1.5rem] border border-primary-900/10 bg-white shadow-[0_20px_45px_var(--primary-900)/6]">
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-4">
              {Array.from({ length: Math.min(columns.length, 4) }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-10 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-primary-900/18 bg-white/70 px-6 py-12 text-center">
        <h3 className="text-lg font-semibold text-[var(--text-900)]">{emptyTitle}</h3>
        <p className="mt-2 text-sm text-[var(--text-400)]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-primary-900/10 bg-white shadow-[0_20px_45px_var(--primary-900)/6]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-background-100/55 text-[var(--text-900)]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-semibold">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={index}
                className={index % 2 === 0 ? "bg-white" : "bg-background-50/45"}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-top text-[var(--text-400)]">
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
