import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PasswordSetupEligibility =
  | { status: "signed_out" }
  | { status: "not_eligible" }
  | { status: "eligible"; userId: string };

// G8: chỉ người vừa chứng minh giữ hộp thư (session từ link/mã email, `amr` có `otp`) mới được
// đặt mật khẩu mà không cần mật khẩu cũ, và chỉ một lần. Provider phone đang tắt nên `otp` ở đây
// nghĩa là email. Cờ đọc qua `getUser()` (Auth server), không đọc từ JWT: JWT `otp` cũ chưa refresh
// không có cờ mới, nên đọc từ claim sẽ cho dùng lại session để đặt mật khẩu lần hai.
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
  return { status: "eligible", userId: userData.user.id };
}
