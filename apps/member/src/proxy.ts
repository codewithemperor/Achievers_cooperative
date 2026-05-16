import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "member_pwa_session";
const LOGIN_PATH = "/login";
const DASHBOARD_PATH = "/dashboard";

type CookieSession = {
  token?: string;
  role?: string;
};

function decodeSession(raw: string | undefined): CookieSession | null {
  if (!raw) return null;

  try {
    return JSON.parse(decodeURIComponent(raw)) as CookieSession;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string | undefined) {
  if (!token) return true;

  try {
    const [, payload] = token.split(".");
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 <= Date.now() : false;
  } catch {
    return false;
  }
}

function isAuthenticated(request: NextRequest) {
  const session = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  return session?.role === "MEMBER" && !isTokenExpired(session.token);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = isAuthenticated(request);

  if (pathname === LOGIN_PATH && authenticated) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
  }

  if (pathname !== LOGIN_PATH && !authenticated) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|logo.jpeg|sw.js|workbox-|icons|screenshots).*)",
  ],
};
