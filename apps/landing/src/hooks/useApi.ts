"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { ADMIN_DATA_TTL_MS, useAdminDataStore } from "@/lib/admin-data-store";

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useApi<T>(url: string): UseApiState<T> {
  const getCached = useAdminDataStore((state) => state.getCached);
  const setCached = useAdminDataStore((state) => state.setCached);
  const beginRequest = useAdminDataStore((state) => state.beginRequest);
  const endRequest = useAdminDataStore((state) => state.endRequest);
  const activeRequests = useAdminDataStore((state) => state.activeRequests);
  const cached = getCached<T>(url);
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);

  const refetch = useCallback(async (force = true) => {
    const current = getCached<T>(url);
    if (!force && current && Date.now() - current.fetchedAt < ADMIN_DATA_TTL_MS) {
      setData(current.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      beginRequest();
      const response = await api.get<T>(url);
      setData(response.data);
      setCached(url, response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Request failed");
    } finally {
      endRequest();
      setLoading(false);
    }
  }, [url, getCached, setCached, beginRequest, endRequest]);

  useEffect(() => {
    void refetch(false);
  }, [refetch]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (activeRequests === 0) {
        void refetch(true);
      }
    }, ADMIN_DATA_TTL_MS);

    return () => window.clearInterval(interval);
  }, [activeRequests, refetch]);

  return {
    data,
    error,
    loading,
    refetch,
  };
}
