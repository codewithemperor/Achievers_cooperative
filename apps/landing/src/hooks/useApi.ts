"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@heroui/react";
import api from "@/lib/api";
import {
  ADMIN_DATA_TTL_MS,
  ADMIN_REFRESH_EVENT,
  useAdminDataStore,
} from "@/lib/admin-data-store";

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  lastFetchedAt: number | null;
  refetch: (options?: boolean | RefetchOptions) => Promise<void>;
}

interface UseApiOptions {
  label?: string;
  limit?: number;
  toastOnManualRefresh?: boolean;
  toastOnBackgroundRefresh?: boolean;
  pullToRefresh?: boolean;
}

interface RefetchOptions {
  force?: boolean;
  silent?: boolean;
  reason?: "manual" | "interval" | "pull" | "mount";
}

function withDefaultLimit(url: string, limit = 1000) {
  if (/[?&](limit|take|pageSize)=/i.test(url)) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}limit=${limit}`;
}

function labelFromUrl(url: string) {
  const clean = url.split("?")[0]?.split("/").filter(Boolean).pop();
  return clean?.replaceAll("-", " ") || "data";
}

function normalizeRefetchOptions(
  options?: boolean | RefetchOptions,
): Required<RefetchOptions> {
  if (typeof options === "boolean") {
    return {
      force: options,
      silent: false,
      reason: options ? "manual" : "mount",
    };
  }

  return {
    force: options?.force ?? true,
    silent: options?.silent ?? false,
    reason: options?.reason ?? "manual",
  };
}

function titleCaseLabel(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function useApi<T>(url: string, options: UseApiOptions = {}): UseApiState<T> {
  const requestUrl = useMemo(
    () => withDefaultLimit(url, options.limit),
    [url, options.limit],
  );
  const label = options.label ?? labelFromUrl(url);
  const getCached = useAdminDataStore((state) => state.getCached);
  const setCached = useAdminDataStore((state) => state.setCached);
  const beginRequest = useAdminDataStore((state) => state.beginRequest);
  const endRequest = useAdminDataStore((state) => state.endRequest);
  const activeRequests = useAdminDataStore((state) => state.activeRequests);
  const cached = getCached<T>(requestUrl);
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const dataRef = useRef<T | null>(cached?.data ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(
    cached?.fetchedAt ?? null,
  );

  const applyData = useCallback((nextData: T | null) => {
    dataRef.current = nextData;
    setData(nextData);
  }, []);

  const refetch = useCallback(async (refetchOptions?: boolean | RefetchOptions) => {
    const normalized = normalizeRefetchOptions(refetchOptions);
    const current = getCached<T>(requestUrl);
    const hasUsableCache =
      current && Date.now() - current.fetchedAt < ADMIN_DATA_TTL_MS;

    if (!normalized.force && hasUsableCache) {
      applyData(current.data);
      setLastFetchedAt(current.fetchedAt);
      setLoading(false);
      return;
    }

    if (current && dataRef.current === null) {
      applyData(current.data);
      setLastFetchedAt(current.fetchedAt);
    }

    const hasVisibleData = dataRef.current !== null || Boolean(current);
    const isManualRefresh =
      normalized.reason === "manual" || normalized.reason === "pull";
    const canToastForReason = isManualRefresh
      ? (options.toastOnManualRefresh ?? true)
      : (options.toastOnBackgroundRefresh ?? true);
    const shouldShowToast =
      !normalized.silent &&
      hasVisibleData &&
      canToastForReason;

    const runRequest = async () => {
      if (!hasVisibleData) setLoading(true);
      else setRefreshing(true);
      setError(null);
      beginRequest();
      try {
        const response = await api.get<T>(requestUrl);
        applyData(response.data);
        setCached(requestUrl, response.data);
        setLastFetchedAt(Date.now());
      } catch (err: any) {
        const message =
          err?.response?.data?.message || err?.message || "Request failed";
        setError(message);
        throw new Error(message);
      } finally {
        endRequest();
        setLoading(false);
        setRefreshing(false);
      }
    };

    if (shouldShowToast) {
      const readableLabel = titleCaseLabel(label);
      await toast.promise(runRequest(), {
        error: (err) => err.message || `Unable to update ${label}.`,
        loading: `Updating ${label}...`,
        success: `${readableLabel} updated successfully.`,
      });
      return;
    }

    await runRequest();
  }, [
    applyData,
    beginRequest,
    endRequest,
    getCached,
    label,
    options.toastOnBackgroundRefresh,
    options.toastOnManualRefresh,
    requestUrl,
    setCached,
  ]);

  useEffect(() => {
    void refetch({ force: false, reason: "mount" });
  }, [refetch]);

  useEffect(() => {
    const handleAdminRefresh = (event: Event) => {
      const refreshTask = refetch({
        force: true,
        reason: "manual",
        silent: true,
      });
      const collect = (
        event as CustomEvent<{
          collect?: (task: Promise<void>) => void;
        }>
      ).detail?.collect;
      collect?.(refreshTask);
      void refreshTask;
    };

    window.addEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
    return () => {
      window.removeEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
    };
  }, [refetch]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (activeRequests === 0) {
        void refetch({ force: true, reason: "interval" });
      }
    }, ADMIN_DATA_TTL_MS);

    return () => window.clearInterval(interval);
  }, [activeRequests, refetch]);

  useEffect(() => {
    if (options.pullToRefresh === false) return;

    let startY = 0;
    let tracking = false;

    const onTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 8) return;
      startY = event.touches[0]?.clientY ?? 0;
      tracking = true;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const endY = event.changedTouches[0]?.clientY ?? startY;
      if (endY - startY < 80 || window.scrollY > 8 || activeRequests > 0) return;
      void refetch({ force: true, reason: "pull" });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [activeRequests, options.pullToRefresh, refetch]);

  return {
    data,
    error,
    loading,
    refreshing,
    lastFetchedAt,
    refetch,
  };
}
