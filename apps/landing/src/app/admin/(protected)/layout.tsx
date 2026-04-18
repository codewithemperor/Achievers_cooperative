import type { PropsWithChildren } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminRole, requireAuth } from "../proxy";

export default async function AdminProtectedLayout({ children }: PropsWithChildren) {
  const session = await requireAuth();
  await requireAdminRole(session);

  return <AdminShell>{children}</AdminShell>;
}
