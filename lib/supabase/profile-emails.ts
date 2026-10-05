import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Đọc email của các hồ sơ đang hoạt động bằng service role (AUTH-019: user client không còn quyền
 * SELECT cột `email`). Chỉ gọi sau khi action đã kiểm tra quyền và chỉ với các id mà bước đọc
 * có RLS vừa trả về; lọc `removed_at` để hồ sơ đã xoá mềm vẫn bị ẩn như policy hiện tại.
 * Trả `null` khi đọc lỗi để caller báo lỗi thay vì hiển thị thiếu email.
 */
export async function getActiveProfileEmails(
  userIds: readonly string[],
): Promise<Map<string, string | null> | null> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();

  const { data, error } = await createServiceRoleClient()
    .from("profiles")
    .select("id, email")
    .in("id", ids)
    .is("removed_at", null);

  if (error) {
    console.error("[PROFILE EMAIL READ ERROR]:", error);
    return null;
  }

  return new Map((data ?? []).map((row) => [row.id as string, (row.email as string | null) ?? null]));
}
