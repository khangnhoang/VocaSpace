import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PasswordSetupEligibility =
  | { status: "signed_out" }
  | { status: "not_eligible" }
  | { status: "eligible"; userId: string; sessionId: string | null };

// G8: chỉ người vừa chứng minh giữ hộp thư (session từ link/mã email, `amr` có `otp`) mới được
// đặt mật khẩu mà không cần mật khẩu cũ. Khi đã đặt, chỉ session khớp bằng chứng recovery mới được
// đặt lại. Provider phone đang tắt nên `otp` ở đây nghĩa là email. Marker chỉ nằm trong bảng app
// `user_password_setups` (cờ app_metadata legacy đã bỏ ở A5). Không đọc marker từ JWT vì session
// `otp` cũ chưa refresh.
export async function getPasswordSetupEligibility(
  supabase: SupabaseClient,
): Promise<PasswordSetupEligibility> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { status: "signed_out" };

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData) return { status: "not_eligible" };

  const amr = claimsData.claims.amr ?? [];
  const verifiedByEmailCode = amr.some((entry) =>
    typeof entry === "string" ? entry === "otp" : entry.method === "otp",
  );

  if (!verifiedByEmailCode) return { status: "not_eligible" };

  const { data: setup, error: setupError } = await createServiceRoleClient()
    .from("user_password_setups")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (setupError) {
    console.error("getPasswordSetupEligibility marker read failed:", setupError.code);
    return { status: "not_eligible" };
  }
  const sessionId = typeof claimsData.claims.session_id === "string"
    ? claimsData.claims.session_id : null;
  if (setup) {
    if (!sessionId) return { status: "not_eligible" };
    const { data: recovery, error: recoveryError } = await createServiceRoleClient()
      .from("user_password_recoveries")
      .select("session_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (recoveryError) {
      console.error("getPasswordSetupEligibility recovery read failed:", recoveryError.code);
      return { status: "not_eligible" };
    }
    if (recovery?.session_id !== sessionId) return { status: "not_eligible" };
  }
  return { status: "eligible", userId: userData.user.id, sessionId };
}

export async function recordPasswordRecovery(userId: string, sessionId: string): Promise<boolean> {
  const { error } = await createServiceRoleClient()
    .from("user_password_recoveries")
    .upsert({ user_id: userId, session_id: sessionId }, { onConflict: "user_id" });
  if (error) console.error("recordPasswordRecovery failed:", error.code);
  return !error;
}

export async function consumePasswordRecovery(userId: string, sessionId: string) {
  // Action cũ đã qua eligibility vẫn có thể hoàn tất; không xóa bằng chứng của session mới hơn.
  try {
    const { error } = await createServiceRoleClient()
      .from("user_password_recoveries")
      .delete()
      .eq("user_id", userId)
      .eq("session_id", sessionId);
    if (error) console.error("consumePasswordRecovery failed:", error.code);
  } catch {
    console.error("consumePasswordRecovery failed:", "unexpected_failure");
  }
}
