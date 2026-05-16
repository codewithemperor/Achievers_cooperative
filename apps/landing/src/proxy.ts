import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "cms_session";
const LOGIN_PATH = "/admin/auth/login";
const ADMIN_HOME = "/admin";

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

function isAdminAuthenticated(request: NextRequest) {
  const session = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  return session?.role === "SUPER_ADMIN" && !isTokenExpired(session.token);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = isAdminAuthenticated(request);

  if (pathname === LOGIN_PATH && authenticated) {
    return NextResponse.redirect(new URL(ADMIN_HOME, request.url));
  }

  if (pathname.startsWith("/admin") && pathname !== LOGIN_PATH && !authenticated) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
