"use client";

import { useEffect, useState } from "react";
import { fetchMemberApi } from "@/lib/member-api";
import { MEMBER_DATA_TTL_MS, useMemberDataStore } from "@/lib/member-data-store";

type PersistedRecord<T> = {
  data: T;
  fetchedAt: number;
};

function storageKey(path: string) {
  return `member_data_cache_${encodeURIComponent(path)}`;
}

function readPersisted<T>(path: string) {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(storageKey(path));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PersistedRecord<T>;
  } catch {
    window.localStorage.removeItem(storageKey(path));
    return null;
  }
}

function writePersisted<T>(path: string, data: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey(path),
    JSON.stringify({ data, fetchedAt: Date.now() }),
  );
}

export function useMemberData<T>(path: string, fallback: T) {
  const getCached = useMemberDataStore((state) => state.getCached);
  const setCached = useMemberDataStore((state) => state.setCached);
  const beginRequest = useMemberDataStore((state) => state.beginRequest);
  const endRequest = useMemberDataStore((state) => state.endRequest);
  const activeRequests = useMemberDataStore((state) => state.activeRequests);
  const cached = getCached<T>(path);
  const persisted =
    typeof window === "undefined" ? null : readPersisted<T>(path);
  const [data, setData] = useState<T>(cached?.data ?? persisted?.data ?? fallback);
  const [loading, setLoading] = useState(!cached && !persisted);
  const [refreshing, setRefreshing] = useState(Boolean(cached || persisted));
  const [hasCachedData, setHasCachedData] = useState(Boolean(cached || persisted));
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
        setRefreshing(false);
        setHasCachedData(true);
        return;
      }

      try {
        setLoading(!current && !readPersisted<T>(path));
        setRefreshing(Boolean(current || readPersisted<T>(path)));
        beginRequest();
        const result = await fetchMemberApi<T>(path);
        if (active) {
          setData(result);
          setCached(path, result);
          writePersisted(path, result);
          setHasCachedData(true);
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
          setRefreshing(false);
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
    refreshing,
    hasCachedData,
    error,
    refresh: async () => {
      setRefreshIndex((current) => current + 1);
    },
    refetch: async () => {
      setRefreshIndex((current) => current + 1);
    },
  };
}
