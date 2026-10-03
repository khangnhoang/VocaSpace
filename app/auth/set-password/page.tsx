import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPasswordSetupEligibility } from "@/lib/auth/password-setup";
import { SetPasswordForm } from "./_components/SetPasswordForm";

export default async function SetPasswordPage() {
  const eligibility = await getPasswordSetupEligibility(await createClient());
  if (eligibility.status === "signed_out") redirect("/login");
  if (eligibility.status === "not_eligible") redirect("/");

  return <SetPasswordForm />;
}
