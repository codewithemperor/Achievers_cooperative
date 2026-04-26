"use client";

import { useEffect, useState } from "react";
import { fetchMemberApi } from "./member-api";

export function useMemberData<T>(path: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [path]);

  return { data, loading, error };
}
