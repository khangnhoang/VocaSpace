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

// ============================================================================
// 2. ENUMS & LITERAL TYPES
// ============================================================================

export type UserRole = 'admin' | 'teacher' | 'student';
export type ItemStatus = 'draft' | 'pending' | 'published';
export type CourseMemberRole = 'previewer' | 'editor' | 'co_owner' | 'owner';

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
  title: string;
  part_type: string;
  order_index: number;
  created_at: string;
  updated_at: string;          // 🔥 Thêm mới đồng bộ DB
  removed_at: string | null;   // 🔥 Thêm mới đồng bộ DB
}

export interface QuestionGroup {
  id: string;
  exercise_id: string;
  passage_text: string | null;
  audio_url: string | null;
  image_url: string | null;
  order_index: number;
  created_at: string;          // 🔥 Thêm mới đồng bộ DB
  updated_at: string;          // 🔥 Thêm mới đồng bộ DB
  removed_at: string | null;   // 🔥 Thêm mới đồng bộ DB
}

export interface Question {
  id: string;
  group_id: string | null;
  exercise_id: string | null;
  content: string;
  explanation: string | null;
  order_index: number;
  created_at: string;          // 🔥 Thêm mới đồng bộ DB
  updated_at: string;          // 🔥 Thêm mới đồng bộ DB
  removed_at: string | null;   // 🔥 Thêm mới đồng bộ DB
}

export interface QuestionOption {
  id: string;
  question_id: string;
  content: string;
  label: string | null;         // A, B, C, D
  is_correct: boolean;
  created_at: string;          // 🔥 Thêm mới đồng bộ DB
  updated_at: string;          // 🔥 Thêm mới đồng bộ DB
  removed_at: string | null;   // 🔥 Thêm mới đồng bộ DB
}

// ============================================================================
// 5. THEO DÕI HỌC TẬP VÀ TIẾN ĐỘ (USER PROGRESS TABLES)
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

// ============================================================================
// 6. HELPER TYPES HỖ TRỢ THAO TÁC INSERT (Loại bỏ các trường sinh tự động)
// ============================================================================

export type CourseInsert = Omit<Course, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type ChapterInsert = Omit<Chapter, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type TopicInsert = Omit<Topic, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type CardInsert = Omit<Card, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type ExerciseInsert = Omit<Exercise, 'id' | 'created_at' | 'updated_at' | 'removed_at'>; // 🔥 Cập nhật loại trừ bộ ba trường thời gian tự động
export type EnrollmentInsert = Omit<Enrollment, 'id' | 'enrolled_at'>;