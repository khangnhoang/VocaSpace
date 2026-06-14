// types/database.ts

// ============================================================================
// 1. CẤU TRÚC NỘI DUNG JSONB LÕI (Chuẩn hóa SSOT tuyệt đối theo DB & Zod)
// ============================================================================

export interface FrontContent {
  word: string;
  pos?: string | null;
  phonetic?: string | null;
}

export interface BackContent {
  translation: string;
  example?: string | null;
  exampleTranslation?: string | null;
  explanation?: string | null;
  hint?: string | null;
}

// Cấu trúc chuẩn xác của đối tượng thuật toán FSRS lưu trong DB
export interface FSRSMeta {
  due: string;
  reps: number;
  state: number;
  lapses: number;
  stability: number;
  difficulty: number;
  last_review?: string | null;
  elapsed_days: number;
  learning_steps: number;
  scheduled_days: number;
}

// Định nghĩa cấu trúc chuẩn của PayOS
export interface PayOSMetadata {
  payos_order_code: number;
  payos_payment_link_id: string;
  checkout_url: string;
  qr_code?: string;
}

// Định nghĩa cấu trúc chuẩn của Stripe (khi scale tương lai)
export interface StripeMetadata {
  stripe_payment_intent_id: string;
  stripe_client_secret: string;
  stripe_customer_id: string;
}

// 1. Lưu các trường chung mà cổng nào cũng có
export interface BasePayment {
  id: string;
  user_id: string;
  course_id: string;
  discount_id: string | null;
  amount_original: number;
  amount_discount: number;
  amount_final: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

// 2. Định nghĩa Type Payment bằng cơ chế Discriminated Union
export type Payment =
  | (BasePayment & { gateway: 'payos'; gateway_metadata: PayOSMetadata })
  | (BasePayment & { gateway: 'stripe'; gateway_metadata: StripeMetadata })
  | (BasePayment & { gateway: string; gateway_metadata: GenericMetadata }); // Fallback cho các cổng khác

// Dự phòng cho các cổng thanh toán chưa xác định rõ trong tương lai (Thay vì dùng any, ta dùng unknown)
export type GenericMetadata = Record<string, unknown>;

// ============================================================================
// 2. ENUMS & LITERAL TYPES
// ============================================================================

export type UserRole = 'admin' | 'teacher' | 'student';
export type ItemStatus = 'draft' | 'pending' | 'published';
export type CourseMemberRole = 'previewer' | 'editor' | 'co_owner' | 'owner';
export type DiscountType = 'fixed' | 'percentage';
export type PaymentStatus = 'creating' | 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

// ============================================================================
// 3. THỰC THỂ HỆ THỐNG CỐT LÕI (CORE TABLES)
// ============================================================================

// Bảng profiles
export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  dob: string | null;   // Định dạng YYYY-MM-DD
  gender: string | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

// Bảng teacher_profiles (Quan hệ 1-1 chia sẻ Khóa chính với Profile)
export interface TeacherProfile {
  id: string; 
  bio: string | null;
  experience_years: number | null;
  certifications: string | null;
  created_at: string;
  updated_at: string;
}

// Bảng courses
export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  status: ItemStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  reject_message: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

// Bảng chapters
export interface Chapter {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

// Bảng topics
export interface Topic {
  id: string;
  chapter_id: string | null;
  course_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ItemStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

// Bảng course_collaborators
export interface CourseCollaborator {
  id: string;
  course_id: string;
  user_id: string;
  role: CourseMemberRole;
  added_by: string | null;
  created_at: string;
}

// Bảng cards
export interface Card {
  id: string;
  topic_id: string;
  front_content: FrontContent; 
  back_content: BackContent;   
  audio_url: string | null;
  image_url: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

// Bảng enrollments
export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
}

// ============================================================================
// 4. CỤM BẢNG LUYỆN TẬP (TOEIC EXERCISES)
// ============================================================================

export interface Exercise {
  id: string;
  topic_id: string;
  course_id: string;
  title: string;
  part_type: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

export interface QuestionGroup {
  id: string;
  exercise_id: string;
  passage_text: string | null;
  audio_url: string | null;
  image_url: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

export interface Question {
  id: string;
  group_id: string | null;
  exercise_id: string;
  course_id: string;
  content: string;
  explanation: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  content: string;
  label: string | null;         // A, B, C, D
  is_correct: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

// ============================================================================
// 5. THEO DÕI HỌC TẬP VÀ TIẾN ĐỘ (USER PROGRESS TABLES) / THANH TOÁN
// ============================================================================

// Bảng user_flashcards
export interface UserFlashcard {
  id: string;
  user_id: string;
  card_id: string;
  ease_factor: number;
  interval_days: number;
  next_review_date: string;
  created_at: string;
  updated_at: string;
  fsrs_meta?: FSRSMeta | null; // Chuẩn hóa Type tường minh
}

// Bảng user_topic_progress
export interface UserTopicProgress {
  id: string;
  user_id: string;
  topic_id: string;
  is_flashcard_completed: boolean;
  is_exercise_completed: boolean;
  is_topic_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Bảng user_question_answers
export interface UserQuestionAnswer {
  id: string;
  user_id: string;
  question_id: string;
  selected_option_id: string;
  is_correct: boolean;
  created_at: string;
  updated_at: string;
}

export interface Discount {
  id: string;
  course_id: string;
  code: string;
  type: DiscountType;
  value: number;
  max_discount_amount: number | null;
  min_course_price: number;
  max_uses: number | null;
  uses_count: number;
  start_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  reserved_count: number;
}

// ============================================================================
// 6. HELPER TYPES HỖ TRỢ THAO TÁC INSERT (Loại bỏ các trường sinh tự động)
// ============================================================================

export type CourseInsert = Omit<
  Course,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'removed_at'
  | 'reject_message'
  | 'submitted_at'
  | 'reviewed_by'
  | 'reviewed_at'
>;
export type ChapterInsert = Omit<Chapter, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type TopicInsert = Omit<Topic, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type CardInsert = Omit<Card, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type ExerciseInsert = Omit<Exercise, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type QuestionInsert = Omit<Question, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type EnrollmentInsert = Omit<Enrollment, 'id' | 'enrolled_at'>;
export type DiscountInsert = Omit<Discount, 'id' | 'uses_count' | 'created_at' | 'updated_at' | 'removed_at'>;
export type BasePaymentInsert = Omit<BasePayment, 'id' | 'created_at' | 'updated_at'>;
export type PaymentInsert =
  | (BasePaymentInsert & { gateway: 'payos'; gateway_metadata: PayOSMetadata })
  | (BasePaymentInsert & { gateway: 'stripe'; gateway_metadata: StripeMetadata })
  | (BasePaymentInsert & { gateway: string; gateway_metadata: GenericMetadata });
