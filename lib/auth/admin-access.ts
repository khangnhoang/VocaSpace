import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Nguồn duy nhất cho quy tắc "admin đang hoạt động" của các trang /admin (AD1).
// Layout và từng page đều gọi helper này: layout có thể được Next giữ nguyên khi điều hướng client giữa
// các trang admin, nên chỉ kiểm tra ở layout thì admin bị thu quyền vẫn vào được trang kế tiếp (AC3).
// `cache()` chỉ gộp các lần gọi trong cùng một request server (layout + page), không nhớ giữa các lần điều hướng.
// Mọi lỗi (không có phiên, lỗi auth, lỗi đọc profile, không có dòng profile còn hoạt động) đều tính là "không phải admin" (G1).
export const requireAdminPage = cache(async (): Promise<string> => {
  const supabase = await createClient();

  // getUser() xác thực token với Supabase Auth; getSession() chỉ đọc cookie nên không dùng được cho cổng này.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) notFound();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .is("removed_at", null)
    .single();

  if (profileError || profile?.role !== "admin") notFound();

  return user.id;
});
