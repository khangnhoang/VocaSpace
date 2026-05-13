// lib/schemas/profile.ts
import { z } from "zod";
import { FlashcardDTO } from "./learn"; // Tái sử dụng triệt để DTO cốt lõi

// 1. Schema kiểm tra dữ liệu cập nhật thông tin
export const profileSchema = z.object({
  full_name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
  username: z.string().min(3, "Username phải từ 3 ký tự trở lên").optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  avatar_url: z.string().optional().nullable(),
});

// 2. Schema kiểm tra dữ liệu đổi mật khẩu
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, "Mật khẩu hiện tại quá ngắn"),
    newPassword: z.string().min(6, "Mật khẩu mới phải từ 6 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

// Xuất type Form cho Hook Form
export type ProfileFormValues = z.infer<typeof profileSchema>;
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
  gender: "male" | "female" | "other" | null;
}

export interface EnrolledCourseDTO {
  id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
}

export interface DeckStatsDTO {
  total: number;
  learning: number;
  due: number;
}

export interface DashboardOverviewResult {
  success?: boolean;
  error?: string;
  enrolledCourses?: EnrolledCourseDTO[];
  deckStats?: DeckStatsDTO;
}

// ============================================================================
// 3. DTO CHO LUỒNG SHEET "HỌC TIẾP" (GLOBAL REVIEW) - TỐI ƯU HÓA DRY
// ============================================================================

/**
 * Thẻ ôn tập toàn cục kế thừa toàn bộ cấu trúc của FlashcardDTO.
 * Đảm bảo truyền thẳng vào <FlashcardStage currentCard={card} /> hợp lệ 100%.
 */
export interface ReviewFlashcardDTO extends FlashcardDTO {
  // Bổ sung topic_id trích xuất từ bảng cards để phục vụ luồng submitCardReview phòng thủ
  topic_id: string; 
  
  // Các trường dữ liệu động truy vấn từ bảng user_flashcards
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