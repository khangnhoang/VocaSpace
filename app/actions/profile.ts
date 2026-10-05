// app/actions/profile.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { SAME_PASSWORD_MESSAGE, WEAK_PASSWORD_MESSAGE } from "@/lib/auth/password-update-messages";
import {
  profileSchema,
  passwordSchema,
  UserProfileDTO,
  FetchDeckReviewCardsResult,
  ReviewFlashcardDTO,
} from "@/lib/schemas/profile";

// 🔥 ĐỊNH NGHĨA INTERFACE RÕ RÀNG ĐỂ LOẠI BỎ ANY
interface FSRSMetaData {
  state?: number;
  [key: string]: unknown;
}

// ============================================================================
// 1. API: LẤY THÔNG TIN HỒ SƠ THẬT CỦA USER
// ============================================================================
export async function getUserProfile(): Promise<{
  error?: string;
  data?: UserProfileDTO;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Vui lòng đăng nhập" };

  // AUTH-019: user client không còn quyền đọc email/phone/dob/gender, kể cả dòng của chính mình.
  // Service role chỉ đọc đúng dòng của user đã xác thực ở trên và giữ bộ lọc `removed_at` của RLS.
  const { data: profile, error: profileError } = await createServiceRoleClient()
    .from("profiles")
    .select(
      "id, email, phone, full_name, avatar_url, role, username, dob, gender",
    )
    .eq("id", user.id)
    .is("removed_at", null)
    .single();

  if (profileError || !profile)
    return { error: "Không tìm thấy hồ sơ người dùng" };

  return {
    data: {
      ...profile,
      email: profile.email || user.email || "",
      phone: profile.phone || user.phone || "",
    },
  };
}

// ============================================================================
// 2. API: CẬP NHẬT THÔNG TIN HỒ SƠ
// ============================================================================
const PROFILE_SYSTEM_ERROR = "Lỗi hệ thống khi cập nhật hồ sơ.";
const USERNAME_TAKEN_ERROR = "Tên người dùng (Username) đã tồn tại!";
const USERNAME_ALREADY_SET_ERROR = "Username đã được thiết lập, vui lòng tải lại trang.";

export async function updateUserProfile(rawData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập" };

  // Kiểm tra Zod nghiêm ngặt trước mọi truy vấn DB
  const validated = profileSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }
  const { full_name, username, dob, gender } = validated.data;

  // Chỉ hành động sau khi đọc được dòng profile của chính user (RLS ẩn dòng đã removed_at).
  // Đọc lỗi hoặc không thấy dòng không được coi là "đã có username", nếu không username user yêu cầu sẽ bị bỏ lặng lẽ.
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  if (readError || !current) return { error: PROFILE_SYSTEM_ERROR };

  const fields = { full_name, dob, gender, updated_at: new Date().toISOString() };

  // Username chỉ đặt được một lần: một UPDATE có điều kiện `username is null` ghi cùng lúc mọi trường,
  // nên hai request đặt song song chỉ có một request ghi được và request thua không đổi trường nào.
  if (current.username === null && username !== null) {
    const { data: written, error } = await supabase
      .from("profiles")
      .update({ ...fields, username })
      .eq("id", user.id)
      .is("username", null)
      .select("id");

    if (error) {
      if (error.code === "23505") return { error: USERNAME_TAKEN_ERROR };
      return { error: PROFILE_SYSTEM_ERROR };
    }
    if (written?.length !== 1) return { error: USERNAME_ALREADY_SET_ERROR };
    return { success: true };
  }

  // Đã có username (hoặc không gửi username): không đưa `username` vào payload để request tự chế không đổi được nó.
  const { data: written, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", user.id)
    .select("id");

  if (error || written?.length !== 1) return { error: PROFILE_SYSTEM_ERROR };

  return { success: true };
}

// ============================================================================
// 3. API: TẢI LÊN ẢNH ĐẠI DIỆN (AVATAR) VÀO STORAGE BUCKET
// ============================================================================
export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(fileName);

  // Cập nhật URL vào bảng profiles
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) return { error: "Lỗi đồng bộ ảnh đại diện vào hồ sơ" };

  return { success: true, avatarUrl: publicUrl };
}

// ============================================================================
// 4. API: ĐỔI MẬT KHẨU (KIỂM TRA CHÉO MẬT KHẨU CŨ)
// ============================================================================
const CURRENT_PASSWORD_WRONG_MESSAGE = "Mật khẩu hiện tại không chính xác!";
const PASSWORD_REAUTH_MESSAGE = "Phiên đăng nhập đã cũ, bạn đăng nhập lại rồi thử nhé.";
const PASSWORD_UPDATE_FAILED_MESSAGE = "Chưa đổi được mật khẩu, vui lòng thử lại.";

export async function updateUserPassword(rawData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    return { error: CURRENT_PASSWORD_WRONG_MESSAGE };
  }

  // Gửi kèm current_password cho toggle "Require current password" (A2b). signInWithPassword ở trên
  // tạo session mới nên không chạm ngưỡng 24 giờ của "Secure password change".
  const { error: updateError } = await supabase.auth.updateUser({
    password: validated.data.newPassword,
    current_password: validated.data.currentPassword,
  });

  if (updateError) {
    console.error("updateUserPassword updateUser failed:", updateError.code ?? updateError.status);
    switch (updateError.code) {
      case "current_password_required":
      case "current_password_invalid":
        return { error: CURRENT_PASSWORD_WRONG_MESSAGE };
      case "same_password":
        return { error: SAME_PASSWORD_MESSAGE };
      case "weak_password":
        return { error: WEAK_PASSWORD_MESSAGE };
      case "reauthentication_needed":
        return { error: PASSWORD_REAUTH_MESSAGE };
      default:
        return { error: PASSWORD_UPDATE_FAILED_MESSAGE };
    }
  }

  return { success: true };
}

// Interface định nghĩa cấu trúc chính xác của row DB trả về từ truy vấn inner join
interface StrictReviewTopic {
  id: string;
  chapter_id: string | null;
  course_id: string;
  status: string | null;
  removed_at: string | null;
  chapter: {
    id: string;
    course_id: string;
    removed_at: string | null;
  } | null;
}

interface StrictDBCardContent {
  id: string;
  topic_id: string;
  removed_at: string | null;
  topic: StrictReviewTopic | null;
  front_content: {
    word: string;
    pos?: string;
    phonetic?: string;
  };
  back_content: {
    translation: string;
    example?: string;
    exampleTranslation?: string;
    explanation?: string;
    hint?: string;
  };
  audio_url: string | null;
  image_url: string | null;
}

interface StrictUserFlashcardRow {
  id: string;
  ease_factor: number | null;
  interval_days: number | null;
  next_review_date: string;
  card: StrictDBCardContent | null;
}

interface StrictReviewMetaRow {
  next_review_date: string;
  fsrs_meta: unknown;
  card: StrictDBCardContent | null;
}

function hasReviewableCardContext(card: StrictDBCardContent | null) {
  if (!card || card.removed_at !== null || !card.topic) return false;

  const { topic } = card;
  return (
    topic.id === card.topic_id &&
    topic.status === "published" &&
    topic.removed_at === null &&
    topic.chapter?.id === topic.chapter_id &&
    topic.chapter.removed_at === null &&
    topic.chapter.course_id === topic.course_id
  );
}

export async function getDeckReviewCards(): Promise<FetchDeckReviewCardsResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Vui lòng đăng nhập để tiếp tục ôn tập." };
  }

  try {
    const nowIso = new Date().toISOString();
    const nowObj = new Date();

    const { data: allMeta, error: metaError } = await supabase
      .from("user_flashcards")
      .select(
        `
        next_review_date,
        fsrs_meta,
        card:cards!inner (
          id, topic_id, removed_at,
          topic:topics!inner (
            id, chapter_id, course_id, status, removed_at,
            chapter:chapters!inner (id, course_id, removed_at)
          )
        )
      `,
      )
      .eq("user_id", user.id);

    if (metaError) {
      return { error: "Không thể tải ngữ liệu thẻ ôn tập lúc này." };
    }

    let learningLeft = 0;
    let dueLeft = 0;

    const reviewableMeta = (allMeta ?? []) as unknown as StrictReviewMetaRow[];
    reviewableMeta
      .filter((item) => hasReviewableCardContext(item.card))
      .forEach((item) => {
        if (item.next_review_date) {
          const dueDate = new Date(item.next_review_date);
          if (dueDate <= nowObj) dueLeft++;
        }

        if (item.fsrs_meta && typeof item.fsrs_meta === "object") {
          const metaObj = item.fsrs_meta as FSRSMetaData;
          if (metaObj.state === 1 || metaObj.state === 3) {
            learningLeft++;
          }
        }
      });

    // 2. Kéo ngữ liệu tối đa 50 thẻ đến hạn (Sử dụng alias an toàn tránh Ambiguous Column)
    const { data: rawCardsData, error: cardsError } = await supabase
      .from("user_flashcards")
      .select(
        `
        id,
        ease_factor,
        interval_days,
          next_review_date,
          card:cards!inner (
            id,
            topic_id,
            removed_at,
            front_content,
            back_content,
            audio_url,
            image_url,
            topic:topics!inner (
              id, chapter_id, course_id, status, removed_at,
              chapter:chapters!inner (id, course_id, removed_at)
            )
          )
      `,
      )
      .eq("user_id", user.id)
      .lte("next_review_date", nowIso)
      .is("card.removed_at", null)
      .order("next_review_date", { ascending: true })
      .limit(50);

    if (cardsError) {
      return { error: "Không thể tải ngữ liệu thẻ ôn tập lúc này." };
    }

    // Gán kiểu dữ liệu nghiêm ngặt loại bỏ hoàn toàn 'any' hoặc fallback đoán mò
    const typedRawData = (rawCardsData || []) as unknown as StrictUserFlashcardRow[];

    // 3. Mapping chuẩn xác tuyệt đối các key DB vào cấu trúc DTO
    const mappedCards: ReviewFlashcardDTO[] = typedRawData
      .filter((item) => hasReviewableCardContext(item.card))
      .map((item) => {
        const cObj = item.card!;
        const front = cObj.front_content;
        const back = cObj.back_content;

        return {
          id: cObj.id,
          front_content: {
            word: front.word || "",
            pos: front.pos || "",
            phonetic: front.phonetic || "",
          },
          back_content: {
            translation: back.translation || "",
            example: back.example || "",
            exampleTranslation: back.exampleTranslation || "",
            explanation: back.explanation || "",
            hint: back.hint || "",
          },
          audio_url: cObj.audio_url,
          image_url: cObj.image_url,
          user_flashcard_id: item.id,
          ease_factor: item.ease_factor ?? undefined,
          interval_days: item.interval_days ?? undefined,
        };
      });

    return {
      success: true,
      cards: mappedCards,
      counts: {
        learningLeft,
        dueLeft,
      },
    };
  } catch {
    return { error: "Hệ thống gặp sự cố khi tổng hợp hàng đợi ôn tập." };
  }
}
