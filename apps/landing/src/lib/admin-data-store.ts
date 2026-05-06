"use client";

import { create } from "zustand";

type CacheRecord<T = unknown> = {
  data: T;
  fetchedAt: number;
};

interface AdminDataStore {
  cache: Record<string, CacheRecord>;
  activeRequests: number;
  getCached: <T>(key: string) => CacheRecord<T> | null;
  setCached: <T>(key: string, data: T) => void;
  beginRequest: () => void;
  endRequest: () => void;
  clear: (key?: string) => void;
}

export const ADMIN_DATA_TTL_MS = 5 * 60 * 1000;

export const useAdminDataStore = create<AdminDataStore>((set, get) => ({
  cache: {},
  activeRequests: 0,
  getCached: <T>(key: string) =>
    (get().cache[key] as CacheRecord<T> | undefined) ?? null,
  setCached: (key, data) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { data, fetchedAt: Date.now() },
      },
    })),
  beginRequest: () =>
    set((state) => ({ activeRequests: state.activeRequests + 1 })),
  endRequest: () =>
    set((state) => ({
      activeRequests: Math.max(0, state.activeRequests - 1),
    })),
  clear: (key) =>
    set((state) => {
      if (!key) return { cache: {} };
      const next = { ...state.cache };
      delete next[key];
      return { cache: next };
    }),
}));
