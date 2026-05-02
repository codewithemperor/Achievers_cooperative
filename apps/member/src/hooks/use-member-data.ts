"use client";

import { useEffect, useState } from "react";
import { fetchMemberApi } from "@/lib/member-api";

export function useMemberData<T>(path: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        setLoading(true);
        const result = await fetchMemberApi<T>(path);
        if (active) {
          setData(result);
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Unable to load data");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [path, refreshIndex]);

  return {
    data,
    loading,
    error,
    refetch: async () => {
      setRefreshIndex((current) => current + 1);
    },
  };
}
