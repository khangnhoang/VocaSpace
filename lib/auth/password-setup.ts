import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PasswordSetupEligibility =
  | { status: "signed_out" }
  | { status: "not_eligible" }
  | { status: "eligible"; userId: string };

// G8: chỉ người vừa chứng minh giữ hộp thư (session từ link/mã email, `amr` có `otp`) mới được
// đặt mật khẩu mà không cần mật khẩu cũ, và chỉ một lần. Provider phone đang tắt nên `otp` ở đây
// nghĩa là email. Marker nằm trong bảng app để GoTrue không ghi đè; cờ legacy vẫn đọc qua
// `getUser()` cho user từ code cũ. Không đọc marker từ JWT vì session `otp` cũ chưa refresh.
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
  const passwordAlreadySet = userData.user.app_metadata?.d7_password_set === true;

  if (!verifiedByEmailCode || passwordAlreadySet) return { status: "not_eligible" };

  const { data: setup, error: setupError } = await createServiceRoleClient()
    .from("user_password_setups")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (setupError) {
    console.error("getPasswordSetupEligibility marker read failed:", setupError.code);
    return { status: "not_eligible" };
  }
  if (setup) return { status: "not_eligible" };
  return { status: "eligible", userId: userData.user.id };
}
