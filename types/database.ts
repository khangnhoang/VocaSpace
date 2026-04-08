// Mặt trước: Thường là từ vựng mục tiêu
export interface FrontContent {
  text: string;             // Từ vựng (VD: Abandon)
  phonetic?: string;        // Phiên âm (VD: /əˈbæn.dən/)
  part_of_speech?: string;  // Từ loại (VD: verb, noun, adj)
}

// Mặt sau: Nghĩa, giải thích và ví dụ
export interface BackContent {
  translation: string;         // Nghĩa tiếng Việt (VD: Từ bỏ)
  explanation?: string;        // Giải thích thêm (nếu có)
  example?: string;            // Câu ví dụ (VD: He abandoned his car.)
  example_translation?: string;// Nghĩa câu ví dụ
  hint?: string;               // Gợi ý mẹo nhớ
}

export type UserRole = 'admin' | 'teacher' | 'student';
export type ItemStatus = 'draft' | 'pending' | 'published';

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  username: string | null; 
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

// Bảng mở rộng cho Role là 'teacher' (Quan hệ 1-1 với Profile)
export interface TeacherProfile {
  id: string; // Trùng với Profile ID
  bio: string | null;
  experience_years: number | null;
  certifications: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  status: ItemStatus;
  order_index: number | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

export interface Topic {
  id: string;
  course_id: string;
  author_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  status: ItemStatus;
  order_index: number | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

export interface Card {
  id: string; // uuid
  topic_id: string; // uuid
  front_content: FrontContent; 
  back_content: BackContent;   
  audio_url: string | null;
  image_url: string | null;
  order_index: number | null;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
}

export type CourseInsert = Omit<Course, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type TopicInsert = Omit<Topic, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type CardInsert = Omit<Card, 'id' | 'created_at' | 'updated_at' | 'removed_at'>;
export type TeacherProfileInsert = Omit<TeacherProfile, 'created_at' | 'updated_at'>;