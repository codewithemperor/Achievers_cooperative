import type { PropsWithChildren } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminProtectedLayout({ children }: PropsWithChildren) {
  return <AdminShell>{children}</AdminShell>;
}
