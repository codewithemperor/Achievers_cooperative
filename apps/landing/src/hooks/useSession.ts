"use client";

import { useEffect, useState } from "react";
import { getSession, isAuthenticated, type SessionData } from "@/lib/session";

export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nextSession = isAuthenticated() ? getSession() : null;
    setSession(nextSession);
    setReady(true);
  }, []);

  return {
    ready,
    session,
    isAuthenticated: !!session?.token,
  };
}
