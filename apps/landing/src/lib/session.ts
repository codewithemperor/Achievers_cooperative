"use client";

export interface SessionData {
  token: string;
  userId: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER" | "SUPER_ADMIN" | "AUDITOR";
  profileImageUrl?: string;
}

const SESSION_KEY = "cms_session";
const COOKIE_NAME = "cms_session";

function encodeSession(data: SessionData) {
  return encodeURIComponent(JSON.stringify(data));
}

function decodeSession(raw: string | null | undefined): SessionData | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as SessionData;
  } catch {
    return null;
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const parts = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));
  return parts?.split("=").slice(1).join("=") ?? null;
}

export function setSession(data: SessionData): void {
  if (typeof window === "undefined") {
    return;
  }

  const encoded = encodeSession(data);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=86400; samesite=lax`;
}

export function getSession(): SessionData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const local = window.localStorage.getItem(SESSION_KEY);
  if (local) {
    try {
      return JSON.parse(local) as SessionData;
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }

  const fromCookie = decodeSession(readCookie(COOKIE_NAME));
  if (fromCookie) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(fromCookie));
  }

  return fromCookie;
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
}

export function isAuthenticated(): boolean {
  const session = getSession();
  if (!session?.token) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(session.token.split(".")[1] ?? ""));
    return typeof payload.exp === "number" ? payload.exp * 1000 > Date.now() : true;
  } catch {
    return false;
  }
}
