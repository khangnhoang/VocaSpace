// lib/schemas/profile.ts
import { z } from "zod";
import { minUtf16Length } from "./utf16-length";
import { FlashcardDTO } from "./learn"; // Tái sử dụng triệt để DTO cốt lõi
import { GENDER_VALUES, type Gender } from "./gender";
import { wrongType } from "./issue-keys";

// Chuỗi rỗng hoặc chỉ có khoảng trắng nghĩa là "không nhập": lưu null để cột `date` không nhận "" (G4).
// Chuẩn hóa nằm trong schema mà server parse, không chỉ ở form, nên request tự chế cũng được xử lý giống UI.
const blankToNull = (value: string | null | undefined) =>
  value == null || value.trim() === "" ? null : value;

// 1. Schema kiểm tra dữ liệu cập nhật thông tin
// English localization U2 (H3): message là khóa trong namespace `validation`; form và `updateUserProfile` dịch theo ngôn ngữ đang dùng.
// Lỗi sai kiểu (ví dụ FormData thiếu trường, object tự chế) giữ đúng văn bản Zod cũ qua `wrongType`, riêng giới tính giữ message riêng.
export const profileSchema = z.object({
  full_name: z.string({ error: wrongType("string") }).check(minUtf16Length(2, "profile.fullNameMin")),
  // Username không bị trim khi có giá trị (giống luật đăng ký); chỉ giá trị rỗng/khoảng trắng thành null.
  username: z
    .string({ error: wrongType("string") })
    .nullish()
    .transform(blankToNull)
    .pipe(z.string().check(minUtf16Length(3, "profile.usernameMin")).nullable()),
  dob: z.string({ error: wrongType("string") }).nullish().transform(blankToNull),
  gender: z
    .string({ error: "profile.genderInvalid" })
    .nullish()
    .transform(blankToNull)
    .pipe(z.enum(GENDER_VALUES, { error: "profile.genderInvalid" }).nullable()),
  avatar_url: z.string({ error: wrongType("string") }).optional().nullable(),
}, { error: wrongType("object") });

// 2. Schema kiểm tra dữ liệu đổi mật khẩu
export const passwordSchema = z
  .object({
    currentPassword: z.string({ error: wrongType("string") }).check(minUtf16Length(6, "password.currentMin")),
    newPassword: z.string({ error: wrongType("string") }).check(minUtf16Length(6, "password.newMin")),
    confirmPassword: z.string({ error: wrongType("string") }),
  }, { error: wrongType("object") })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "password.mismatch",
    path: ["confirmPassword"],
  });

// Xuất type Form cho Hook Form
// Input khác output vì schema chuẩn hóa giá trị trống thành null; form giữ giá trị người dùng nhập (input).
export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileFormValues = z.output<typeof profileSchema>;
export type PasswordFormValues = z.infer<typeof passwordSchema>;

// ============================================================================
// CÁC ĐỊNH NGHĨA DTO (DATA TRANSFER OBJECT) CHO API TRẢ VỀ
// ============================================================================

export interface UserProfileDTO {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  username: string | null;
  dob: string | null;
  gender: Gender | null;
}

// DTO thẻ ôn tập chỉ chứa dữ liệu render và metadata hàng đợi của chính user.
export interface ReviewFlashcardDTO extends FlashcardDTO {
  user_flashcard_id?: string;
  ease_factor?: number;
  interval_days?: number;
}

// DTO định nghĩa cấu trúc trả về của API kéo danh sách ôn tập toàn cục
export interface FetchDeckReviewCardsResult {
  success?: boolean;
  error?: string;
  cards?: ReviewFlashcardDTO[];
  counts?: {
    learningLeft: number;
    dueLeft: number;
  };
}
