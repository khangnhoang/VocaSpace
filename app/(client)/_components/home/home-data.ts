import { cache } from "react";
import { getPublicCourseCatalog } from "@/app/actions/public-course";
import { createClient } from "@/utils/supabase/server";

// Hero và khối "Khóa học nổi bật" cùng đọc catalog trong một request; cache để chỉ gọi RPC một lần (U1 G4).
export const getHomeCatalog = cache(() => getPublicCourseCatalog());

export type HomeViewer = {
  isSignedIn: boolean;
  isTeacher: boolean;
};

// Đọc role giống Header. Chỉ role `teacher` mới tạo được khóa học (createCourse), nên nút soạn khóa học dựa vào đúng role này.
export async function getHomeViewer(): Promise<HomeViewer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isSignedIn: false, isTeacher: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { isSignedIn: true, isTeacher: profile?.role === "teacher" };
}
