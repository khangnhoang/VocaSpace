// app/actions/profile.ts
"use server";

import { createClient } from "@/utils/supabase/server";
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, email, phone, full_name, avatar_url, role, username, dob, gender",
    )
    .eq("id", user.id)
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
export async function updateUserProfile(rawData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    if (error.code === "23505")
      return { error: "Tên người dùng (Username) đã tồn tại!" };
    return { error: "Lỗi hệ thống khi cập nhật hồ sơ." };
  }

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
    return { error: "Mật khẩu hiện tại không chính xác!" };
  }

  // Thực hiện đổi sang mật khẩu mới
  const { error: updateError } = await supabase.auth.updateUser({
    password: validated.data.newPassword,
  });

  if (updateError) return { error: updateError.message };

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
