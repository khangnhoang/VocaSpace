import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { getPasswordSetupEligibility } from "@/lib/auth/password-setup";
import { AuthShell } from "@/components/auth/auth-shell";
import { settledPanel } from "@/components/auth/auth-panels";
import { ClientNamespaces } from "@/components/i18n/client-namespaces";
import { asTranslate } from "@/lib/i18n/translate";
import { SetPasswordForm } from "./_components/SetPasswordForm";

export default async function SetPasswordPage() {
  const eligibility = await getPasswordSetupEligibility(await createClient());
  if (eligibility.status === "signed_out") redirect("/login");
  if (eligibility.status === "not_eligible") redirect("/");

  // Trang này phục vụ cả đăng ký mới, khôi phục mật khẩu và tài khoản do admin tạo, nên panel và lời dẫn trung tính (U3 quyết định 11).
  const t = asTranslate(await getTranslations("auth"));
  return (
    <ClientNamespaces namespaces={["auth"]}>
      <div className="min-h-screen bg-slate-50">
        <AuthShell lastSignInMethod={null} fixedPanel={settledPanel(t)}>
          <SetPasswordForm />
        </AuthShell>
      </div>
    </ClientNamespaces>
  );
}
