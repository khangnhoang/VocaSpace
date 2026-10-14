import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// Nguồn duy nhất cho quy tắc "admin đang hoạt động" của các trang /admin (AD1) và các Server Action của màn hình admin (AD3).
// Không ném và không gọi notFound(): trả id của admin đang hoạt động, hoặc null cho mọi trường hợp còn lại
// (không có phiên, lỗi auth, lỗi đọc profile, không có dòng profile còn hoạt động, không phải admin) — fail closed (G1).
// getUser() xác thực token với Supabase Auth; getSession() chỉ đọc cookie nên không dùng được cho cổng này.
export async function getActiveAdminUserId(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .is("removed_at", null)
    .single();

  if (profileError || profile?.role !== "admin") return null;

  return user.id;
}

// Layout và từng page đều gọi helper này: layout có thể được Next giữ nguyên khi điều hướng client giữa
// các trang admin, nên chỉ kiểm tra ở layout thì admin bị thu quyền vẫn vào được trang kế tiếp (AC3).
// `cache()` chỉ gộp các lần gọi trong cùng một request server (layout + page), không nhớ giữa các lần điều hướng.
export const requireAdminPage = cache(async (): Promise<string> => {
  const adminUserId = await getActiveAdminUserId(await createClient());
  if (!adminUserId) notFound();
  return adminUserId;
});
