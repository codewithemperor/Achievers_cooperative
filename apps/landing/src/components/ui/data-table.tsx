"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  statusAccessor?: (item: T) => string | null | undefined;
  toolbar?: ReactNode;
}

const pendingStatuses = new Set(["PENDING", "PENDING_APPROVAL", "OVERDUE"]);

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
  statusAccessor,
  toolbar,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const hasStatusColumn = columns.some((column) => column.key === "status");
  const getStatus = (item: T) =>
    statusAccessor?.(item) ??
    ((item as Record<string, unknown>).status as string | undefined);

  const statuses = useMemo(() => {
    if (!hasStatusColumn) return [];
    const unique = Array.from(
      new Set(
        data
          .map((item) => getStatus(item))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    return unique.sort((a, b) => {
      const leftPending = pendingStatuses.has(a.toUpperCase()) ? 0 : 1;
      const rightPending = pendingStatuses.has(b.toUpperCase()) ? 0 : 1;
      if (leftPending !== rightPending) return leftPending - rightPending;
      return a.localeCompare(b);
    });
  }, [data, hasStatusColumn, statusAccessor]);

  const visibleData = useMemo(() => {
    const lowered = search.trim().toLowerCase();
    const searchFiltered = lowered
      ? data.filter((item) =>
          (searchableText?.(item) ?? JSON.stringify(item))
            .toLowerCase()
            .includes(lowered),
        )
      : data;
    const filtered =
      statusFilter === "ALL"
        ? searchFiltered
        : searchFiltered.filter(
            (item) => getStatus(item)?.toUpperCase() === statusFilter,
          );

    const column = columns.find((item) => item.key === sortKey);
    const pendingFirst = (items: T[]) =>
      [...items].sort((a, b) => {
        const left = getStatus(a)?.toUpperCase() ?? "";
        const right = getStatus(b)?.toUpperCase() ?? "";
        const leftRank = pendingStatuses.has(left) ? 0 : 1;
        const rightRank = pendingStatuses.has(right) ? 0 : 1;
        return leftRank - rightRank;
      });

    if (!column || column.isAction) return pendingFirst(filtered);

    return pendingFirst(filtered).sort((a, b) => {
      const leftStatus = getStatus(a)?.toUpperCase() ?? "";
      const rightStatus = getStatus(b)?.toUpperCase() ?? "";
      const leftRank = pendingStatuses.has(leftStatus) ? 0 : 1;
      const rightRank = pendingStatuses.has(rightStatus) ? 0 : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;

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
  }, [
    columns,
    data,
    search,
    searchableText,
    sortDirection,
    sortKey,
    statusAccessor,
    statusFilter,
  ]);
  const totalPages = Math.max(1, Math.ceil(visibleData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedData = useMemo(
    () =>
      visibleData.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, visibleData],
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-primary-900/10 bg-white shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
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
      <div className="rounded-2xl border border-dashed border-primary-900/18 bg-white/70 px-6 py-12 text-center dark:border-[var(--background-700)] dark:bg-[var(--background-900)]">
        <h3 className="text-lg font-semibold text-text-900">{emptyTitle}</h3>
        <p className="mt-2 text-sm text-text-400">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary-900/10 bg-white shadow-sm dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
      <div className="flex flex-col gap-3 border-b border-primary-900/8 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-[var(--background-800)]">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-400" />
          <input
            className="min-h-11 w-full rounded-2xl border border-primary-900/10 bg-background-50 pl-9 pr-4 text-sm text-text-900 outline-none transition focus:border-primary-500 focus:bg-white dark:border-[var(--background-700)] dark:bg-[var(--background-800)] dark:text-text-50 dark:focus:bg-[var(--background-800)]"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            value={search}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {hasStatusColumn && statuses.length ? (
            <select
              className="min-h-11 rounded-2xl border border-primary-900/10 bg-background-50 px-3 text-sm font-semibold text-text-700 outline-none transition focus:border-primary-500 focus:bg-white dark:border-[var(--background-700)] dark:bg-[var(--background-800)] dark:text-text-100"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="ALL">All status</option>
              {statuses.map((status) => (
                <option key={status} value={status.toUpperCase()}>
                  {status.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className="min-h-11 rounded-2xl border border-primary-900/10 bg-background-50 px-3 text-sm font-semibold text-text-700 outline-none transition focus:border-primary-500 focus:bg-white dark:border-[var(--background-700)] dark:bg-[var(--background-800)] dark:text-text-100"
            onChange={(event) => setPageSize(Number(event.target.value))}
            value={pageSize}
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
          {toolbar}
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-visible">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-background-100/70 text-text-900 dark:bg-[var(--background-800)]">
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
            {pagedData.map((item, index) => (
              <tr
                key={getRowKey?.(item, index) ?? index}
                className={`border-t border-primary-900/6 transition hover:bg-background-50 dark:border-[var(--background-800)] dark:hover:bg-[var(--background-800)] ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                onClick={() => onRowClick?.(item)}
              >
                <td className="px-4 py-3.5 align-top text-xs font-semibold text-text-400">
                  {(currentPage - 1) * pageSize + index + 1}
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
      <div className="flex flex-col gap-3 border-t border-primary-900/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-[var(--background-800)]">
        <p className="text-xs font-medium text-text-400">
          Showing {visibleData.length ? (currentPage - 1) * pageSize + 1 : 0}-
          {Math.min(currentPage * pageSize, visibleData.length)} of{" "}
          {visibleData.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-primary-900/10 px-3 py-1.5 text-sm font-semibold text-text-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[var(--background-700)] dark:text-text-200"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            Previous
          </button>
          <span className="text-xs font-semibold text-text-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="rounded-xl border border-primary-900/10 px-3 py-1.5 text-sm font-semibold text-text-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[var(--background-700)] dark:text-text-200"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
