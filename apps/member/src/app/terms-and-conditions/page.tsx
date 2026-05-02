import { redirect } from "next/navigation";

export default function TermsRedirectPage() {
  redirect("/account/terms-and-conditions");
}
