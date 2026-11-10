import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getPasswordSetupEligibility } from "@/lib/auth/password-setup";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetPasswordForm } from "./_components/SetPasswordForm";

export default async function SetPasswordPage() {
  const eligibility = await getPasswordSetupEligibility(await createClient());
  if (eligibility.status === "signed_out") redirect("/login");
  if (eligibility.status === "not_eligible") redirect("/");

  // Trang này phục vụ cả đăng ký mới, khôi phục mật khẩu và tài khoản do admin tạo, nên panel và lời dẫn trung tính (U3 quyết định 11).
  return (
    <div className="min-h-screen bg-slate-50">
      <AuthShell
        lastSignInMethod={null}
        fixedPanel={{
          variant: { kind: "settled" },
          copy: { title: "Chặng cuối.", text: "Đặt mật khẩu xong là bạn có thể đăng nhập bằng email và học tiếp." },
        }}
      >
        <SetPasswordForm />
      </AuthShell>
    </div>
  );
}
