"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Skeleton } from "@heroui/react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T, index: number) => ReactNode;
  sortValue?: (item: T) => string | number | Date | null | undefined;
  width?: string;
  align?: "left" | "right" | "center";
  isAction?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  getRowKey?: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  searchableText?: (item: T) => string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  emptyTitle = "No records yet",
  emptyDescription = "Records will appear here when data becomes available.",
  loading = false,
  getRowKey,
  onRowClick,
  searchableText,
  searchPlaceholder = "Search table...",
  toolbar,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const visibleData = useMemo(() => {
    const lowered = search.trim().toLowerCase();
    const filtered = lowered
      ? data.filter((item) =>
          (searchableText?.(item) ?? JSON.stringify(item))
            .toLowerCase()
            .includes(lowered),
        )
      : data;

    const column = columns.find((item) => item.key === sortKey);
    if (!column || column.isAction) return filtered;

    return [...filtered].sort((a, b) => {
      const left = column.sortValue
        ? column.sortValue(a)
        : (a as Record<string, unknown>)[column.key];
      const right = column.sortValue
        ? column.sortValue(b)
        : (b as Record<string, unknown>)[column.key];
      const leftValue = left instanceof Date ? left.getTime() : left ?? "";
      const rightValue = right instanceof Date ? right.getTime() : right ?? "";
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue));
      return sortDirection === "asc" ? result : -result;
    });
  }, [columns, data, search, searchableText, sortDirection, sortKey]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-primary-900/10 bg-white shadow-sm">
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-4">
              {Array.from({ length: Math.min(columns.length, 4) }).map(
                (__, cellIndex) => (
                  <Skeleton key={cellIndex} className="h-10 rounded-xl" />
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
      <div className="rounded-2xl border border-dashed border-primary-900/18 bg-white/70 px-6 py-12 text-center">
        <h3 className="text-lg font-semibold text-text-900">{emptyTitle}</h3>
        <p className="mt-2 text-sm text-text-400">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary-900/10 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-primary-900/8 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-400" />
          <input
            className="min-h-11 w-full rounded-2xl border border-primary-900/10 bg-background-50 pl-9 pr-4 text-sm text-text-900 outline-none transition focus:border-primary-500 focus:bg-white"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            value={search}
          />
        </div>
        {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
      </div>
      <div className="overflow-x-auto overflow-y-visible">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-background-100/70 text-text-900">
            <tr>
              <th className="w-14 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-500">
                S/N
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-500 ${
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left"
                  } ${column.width ?? ""}`}
                >
                  <button
                    className={`inline-flex max-w-36 items-center gap-1 whitespace-normal text-left leading-tight ${
                      column.align === "right" ? "justify-end" : ""
                    } ${
                      column.isAction ? "cursor-default" : "cursor-pointer"
                    }`}
                    disabled={column.isAction}
                    onClick={() => {
                      if (column.isAction) return;
                      if (sortKey === column.key) {
                        setSortDirection((current) =>
                          current === "asc" ? "desc" : "asc",
                        );
                        return;
                      }
                      setSortKey(column.key);
                      setSortDirection("asc");
                    }}
                    type="button"
                  >
                    <span className="whitespace-normal">{column.header}</span>
                    {sortKey === column.key ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3 w-3 shrink-0" />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((item, index) => (
              <tr
                key={getRowKey?.(item, index) ?? index}
                className={`border-t border-primary-900/6 transition hover:bg-background-50 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                onClick={() => onRowClick?.(item)}
              >
                <td className="px-4 py-3.5 align-top text-xs font-semibold text-text-400">
                  {index + 1}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3.5 align-top text-text-500 ${
                      column.align === "right"
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    {column.render(item, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleData.length ? (
          <div className="px-6 py-10 text-center text-sm text-text-400">
            No matching records found.
          </div>
        ) : null}
      </div>
    </div>
  );
}
