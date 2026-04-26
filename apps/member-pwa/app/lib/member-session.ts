"use client";

export interface MemberSession {
  token: string;
  userId: string;
  email: string;
  name: string;
  role: "MEMBER" | "SUPER_ADMIN";
  profileImageUrl?: string;
}

const SESSION_KEY = "member_pwa_session";
const COOKIE_NAME = "member_pwa_session";

function encodeSession(data: MemberSession) {
  return encodeURIComponent(JSON.stringify(data));
}

function decodeSession(raw: string | null | undefined): MemberSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as MemberSession;
  } catch {
    return null;
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const part = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));
  return part?.split("=").slice(1).join("=") ?? null;
}

export function setMemberSession(data: MemberSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  document.cookie = `${COOKIE_NAME}=${encodeSession(data)}; path=/; max-age=86400; samesite=lax`;
}

export function getMemberSession() {
  if (typeof window === "undefined") return null;

  const local = window.localStorage.getItem(SESSION_KEY);
  if (local) {
    try {
      return JSON.parse(local) as MemberSession;
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

export function clearMemberSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
}

export function isMemberAuthenticated() {
  const session = getMemberSession();
  if (!session?.token) return false;

  try {
    const payload = JSON.parse(atob(session.token.split(".")[1] ?? ""));
    return typeof payload.exp === "number" ? payload.exp * 1000 > Date.now() : true;
  } catch {
    return false;
  }
}
