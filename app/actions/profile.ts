// app/actions/profile.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { 
  profileSchema, 
  passwordSchema, 
  UserProfileDTO, 
  DashboardOverviewResult, 
  EnrolledCourseDTO
} from "@/lib/schemas/profile";

// 🔥 ĐỊNH NGHĨA INTERFACE RÕ RÀNG ĐỂ LOẠI BỎ ANY
interface FSRSMetaData {
  state?: number;
  [key: string]: unknown;
}

// ============================================================================
// 1. API: KÉO DỮ LIỆU TỔNG QUAN DASHBOARD (Đã chuẩn hóa Type)
// ============================================================================
export async function getUserDashboardOverview(): Promise<DashboardOverviewResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Vui lòng đăng nhập" };

  try {
    const { data: enrollmentsData } = await supabase
      .from("enrollments")
      .select(`
        enrolled_at,
        course:courses (id, title, slug, description, thumbnail_url)
      `)
      .eq("user_id", user.id)
      .order("enrolled_at", { ascending: false });

    // 🔥 ÉP KIỂU VỀ DTO CHUẨN KHI BÓC TÁCH
    const enrolledCourses: EnrolledCourseDTO[] = enrollmentsData
      ?.map((e) => e.course as unknown as EnrolledCourseDTO)
      .filter(Boolean) || [];

    const { data: cardsData, error: cardsError } = await supabase
      .from("user_flashcards")
      .select("next_review_date, fsrs_meta")
      .eq("user_id", user.id);

    let totalCards = 0;
    let learningCards = 0; 
    let dueCards = 0;      

    if (!cardsError && cardsData) {
      totalCards = cardsData.length;
      const now = new Date();

      cardsData.forEach((card) => {
        if (card.next_review_date) {
          const dueDate = new Date(card.next_review_date);
          if (dueDate <= now) dueCards++;
        }

        if (card.fsrs_meta && typeof card.fsrs_meta === "object") {
          const metaObj = card.fsrs_meta as FSRSMetaData;
          if (metaObj.state === 1 || metaObj.state === 3) {
            learningCards++;
          }
        }
      });
    }

    return {
      success: true,
      enrolledCourses,
      deckStats: { total: totalCards, learning: learningCards, due: dueCards },
    };
  } catch (err) {
    return { error: "Lỗi hệ thống khi tải tổng quan học tập" };
  }
}

// ============================================================================
// 2. API: LẤY THÔNG TIN HỒ SƠ THẬT CỦA USER
// ============================================================================
export async function getUserProfile(): Promise<{ error?: string; data?: UserProfileDTO }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) return { error: "Vui lòng đăng nhập" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, phone, full_name, avatar_url, role, username, dob, gender")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return { error: "Không tìm thấy hồ sơ người dùng" };

  return { 
    data: {
      ...profile,
      email: profile.email || user.email || "",
      phone: profile.phone || user.phone || "",
    } 
  };
}

// ============================================================================
// 3. API: CẬP NHẬT THÔNG TIN HỒ SƠ
// ============================================================================
export async function updateUserProfile(rawData: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập" };

  // Kiểm tra Zod nghiêm ngặt
  const validated = profileSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: validated.data.full_name,
      username: validated.data.username,
      dob: validated.data.dob,
      gender: validated.data.gender,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "Tên người dùng (Username) đã tồn tại!" };
    return { error: "Lỗi hệ thống khi cập nhật hồ sơ." };
  }

  return { success: true };
}

// ============================================================================
// 4. API: TẢI LÊN ẢNH ĐẠI DIỆN (AVATAR) VÀO STORAGE BUCKET
// ============================================================================
export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập" };

  const file = formData.get("avatar") as File | null;
  if (!file) return { error: "Không tìm thấy file tải lên" };

  // Kiểm tra định dạng ảnh cơ bản
  if (!file.type.startsWith("image/")) {
    return { error: "Vui lòng tải lên định dạng hình ảnh hợp lệ" };
  }

  // Đặt tên file duy nhất chống ghi đè
  const fileExt = file.name.split(".").pop();
  const fileName = `${user.id}-${Date.now()}.${fileExt}`;

  // Tải lên bucket "avatars" (Đảm bảo bạn đã tạo public bucket này trên Supabase)
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, file, { upsert: true });

  if (uploadError) return { error: "Lỗi tải ảnh lên hệ thống" };

  // Lấy URL Public của ảnh vừa tải
  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  // Cập nhật URL vào bảng profiles
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ 
      avatar_url: publicUrl,
      updated_at: new Date().toISOString() 
    })
    .eq("id", user.id);

  if (updateError) return { error: "Lỗi đồng bộ ảnh đại diện vào hồ sơ" };

  return { success: true, avatarUrl: publicUrl };
}

// ============================================================================
// 5. API: ĐỔI MẬT KHẨU (KIỂM TRA CHÉO MẬT KHẨU CŨ)
// ============================================================================
export async function updateUserPassword(rawData: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "Vui lòng đăng nhập" };

  const validated = passwordSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  // THAO TÁC BẢO MẬT: Xác thực lại bằng mật khẩu hiện tại trước khi cho phép đổi
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: validated.data.currentPassword,
  });

  if (signInError) {
    return { error: "Mật khẩu hiện tại không chính xác!" };
  }

  // Thực hiện đổi sang mật khẩu mới
  const { error: updateError } = await supabase.auth.updateUser({
    password: validated.data.newPassword,
  });

  if (updateError) return { error: updateError.message };

  return { success: true };
}