import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface ServerSession {
  token: string;
  userId: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER" | "SUPER_ADMIN" | "AUDITOR";
  profileImageUrl?: string;
}

function decodeSession(raw?: string) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as ServerSession;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get("cms_session")?.value);

  if (!session?.token) {
    redirect("/admin/auth/login");
  }

  return session;
}

export async function requireAdminRole(session: ServerSession) {
  if (!["ADMIN", "SUPER_ADMIN", "AUDITOR"].includes(session.role)) {
    redirect("/admin/auth/login");
  }
}
