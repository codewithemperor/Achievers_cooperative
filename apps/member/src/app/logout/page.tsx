import { redirect } from "next/navigation";

export default function LogoutRedirectPage() {
  redirect("/profile");
}
