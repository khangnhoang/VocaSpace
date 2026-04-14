// ========================================================
// 1. CẤU TRÚC NỘI DUNG JSONB (Cho bảng Cards)
// ========================================================

export interface FrontContent {
  text: string;             // Từ vựng (VD: Abandon)
  phonetic?: string;        // Phiên âm (VD: /əˈbæn.dən/)
  part_of_speech?: string;  // Từ loại (VD: verb, noun, adj)
}

export interface BackContent {
  translation: string;         // Nghĩa tiếng Việt (VD: Từ bỏ)
  explanation?: string;        // Giải thích thêm
  example?: string;            // Câu ví dụ
  example_translation?: string;// Nghĩa câu ví dụ
  hint?: string;               // Mẹo nhớ
}

// ========================================================
// 2. ENUMS & LITERAL TYPES
// ========================================================

export type UserRole = 'admin' | 'teacher' | 'student';
export type ItemStatus = 'draft' | 'pending' | 'published';
export type CourseMemberRole = 'previewer' | 'editor' | 'co_owner' | 'owner';

// ========================================================
// 3. THỰC THỂ HỆ THỐNG (TABLES)
// ========================================================

// Bảng profiles
export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  dob: string | null;   // date
  gender: string | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

// Bảng teacher_profiles (Quan hệ 1-1 với Profile)
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

// ========================================================
// 4. CỤM BẢNG LUYỆN TẬP (TOEIC EXERCISES)
// ========================================================

export interface Exercise {
  id: string;
  topic_id: string;
  title: string;
  part_type: string;
  order_index: number;
  created_at: string;
}

export interface QuestionGroup {
  id: string;
  exercise_id: string;
  passage_text: string | null;
  audio_url: string | null;
  image_url: string | null;
  order_index: number;
}

export interface Question {
  id: string;
  group_id: string | null;
  exercise_id: string | null;
  content: string;
  explanation: string | null;
  order_index: number;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  content: string;
  label: string | null; // A, B, C, D
  is_correct: boolean;
}

// ========================================================
// 5. THEO DÕI HỌC TẬP (USER PROGRESS)
// ========================================================

export interface UserFlashcard {
  id: string;
  user_id: string;
  card_id: string;
  ease_factor: number;
  interval_days: number;
  next_review_date: string;
  created_at: string;
  updated_at: string;
}

// ========================================================
// 6. HELPER TYPES CHO INSERT (Omit auto-generated fields)
// ========================================================

export type CourseInsert = Omit<Course, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type ChapterInsert = Omit<Chapter, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type TopicInsert = Omit<Topic, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type CardInsert = Omit<Card, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type ExerciseInsert = Omit<Exercise, 'id' | 'created_at'>;