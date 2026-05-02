import { redirect } from "next/navigation";

export default function ChangePasswordRedirectPage() {
  redirect("/account/change-password");
}
