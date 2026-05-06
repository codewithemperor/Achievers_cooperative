import { redirect } from "next/navigation";

export default function ApprovalsRedirectPage() {
  redirect("/admin/withdrawals");
}
