"use client";

import { useEffect, useState } from "react";
import { fetchMemberApi } from "@/lib/member-api";
import { MEMBER_DATA_TTL_MS, useMemberDataStore } from "@/lib/member-data-store";

export function useMemberData<T>(path: string, fallback: T) {
  const getCached = useMemberDataStore((state) => state.getCached);
  const setCached = useMemberDataStore((state) => state.setCached);
  const beginRequest = useMemberDataStore((state) => state.beginRequest);
  const endRequest = useMemberDataStore((state) => state.endRequest);
  const activeRequests = useMemberDataStore((state) => state.activeRequests);
  const cached = getCached<T>(path);
  const [data, setData] = useState<T>(cached?.data ?? fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;

    async function run(force = false) {
      const current = getCached<T>(path);
      const freshEnough =
        current && Date.now() - current.fetchedAt < MEMBER_DATA_TTL_MS;

      if (!force && freshEnough) {
        setData(current.data);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        beginRequest();
        const result = await fetchMemberApi<T>(path);
        if (active) {
          setData(result);
          setCached(path, result);
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Unable to load data");
        }
      } finally {
        endRequest();
        if (active) {
          setLoading(false);
        }
      }
    }

    void run(refreshIndex > 0);
    return () => {
      active = false;
    };
  }, [path, refreshIndex, getCached, setCached, beginRequest, endRequest]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (activeRequests === 0) {
        setRefreshIndex((current) => current + 1);
      }
    }, MEMBER_DATA_TTL_MS);

    return () => window.clearInterval(interval);
  }, [activeRequests]);

  return {
    data,
    loading,
    error,
    refresh: async () => {
      setRefreshIndex((current) => current + 1);
    },
    refetch: async () => {
      setRefreshIndex((current) => current + 1);
    },
  };
}
