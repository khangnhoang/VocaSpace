import { z } from "zod";

// 1. Lược đồ các thực thể phụ trợ (Dựa trên database.ts)
const profileSchema = z.object({
  id: z.string(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

const teacherProfileSchema = z.object({
  bio: z.string().nullable(),
  experience_years: z.number().nullable(),
  certifications: z.string().nullable(),
});

// Giảng viên = Profile + TeacherProfile
const instructorSchema = profileSchema.merge(teacherProfileSchema);

const topicSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  status: z.enum(["draft", "pending", "published"]),
  order_index: z.number(),
  // Phân loại icon dựa theo logic thực tế (vd: video, vocabulary, exercise)
  topic_type: z.enum(["video", "vocabulary", "exercise"]).optional(),
  is_free_preview: z.boolean().optional().default(false),
});

const chapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  order_index: z.number(),
  topics: z.array(topicSchema), // Mảng lồng nhau (1 chương có nhiều bài học)
});

// 2. Lược đồ Thống kê (At a Glance)
const courseStatsSchema = z.object({
  total_chapters: z.number(),
  total_topics: z.number(),
  total_cards: z.number(),
  total_exercises: z.number(),
  total_enrollments: z.number(),
});

// 3. LƯỢC ĐỒ CHÍNH: COURSE DETAIL SCHEMA
export const courseDetailSchema = z.object({
  // Thông tin cốt lõi khóa học
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  price: z.number(),
  original_price: z.number().nullable().optional(), // Giá gốc gạch chéo
  badges: z.array(z.string()).optional(), // vd: ["Best Seller", "Mới"]

  // Trạng thái user hiện tại
  is_enrolled: z.boolean().default(false),

  // Thống kê
  stats: courseStatsSchema,

  // Đội ngũ
  owner: instructorSchema,
  collaborators: z.array(instructorSchema),

  // Đề cương (Syllabus)
  syllabus: z.array(chapterSchema),
});

// ============================================================================
// 4. TRÍCH XUẤT DTO (SSOT)
// ============================================================================
// Đây chính là DTO mà chúng ta lấy ra từ Zod Schema. Bạn export nó để dùng cho toàn bộ Frontend.
export type CourseDetailDTO = z.infer<typeof courseDetailSchema>;
