"use client";

import { useEffect, useState } from "react";
import { fetchMemberApi } from "@/lib/member-api";

const PROFILE_CACHE_KEY = "member_profile_cache_v1";

export interface CachedProfilePayload {
  id: string;
  email: string;
  member: {
    id: string;
    fullName: string;
    phoneNumber: string;
    membershipNumber: string;
    status: string;
    joinedAt: string;
    homeAddress?: string;
    stateOfOrigin?: string;
    dateOfBirth?: string;
    occupation?: string;
    maritalStatus?: string;
    identificationNumber?: string;
    identificationType?: string;
    avatarUrl?: string | null;
  } | null;
}

function readCachedProfile() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CachedProfilePayload;
  } catch {
    window.localStorage.removeItem(PROFILE_CACHE_KEY);
    return null;
  }
}

function writeCachedProfile(data: CachedProfilePayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
}

export function useProfileData(fallback: CachedProfilePayload) {
  const [data, setData] = useState<CachedProfilePayload>(() => readCachedProfile() || fallback);
  const [loading, setLoading] = useState(() => readCachedProfile() === null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile(force = false) {
    const cached = readCachedProfile();
    if (cached && !force) {
      setData(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await fetchMemberApi<CachedProfilePayload>("/auth/me");
      setData(result);
      setError(null);
      writeCachedProfile(result);
    } catch (err: any) {
      setError(err?.message || "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile(false);
  }, []);

  return {
    data,
    loading,
    error,
    refetch: async () => {
      await loadProfile(true);
    },
  };
}
