// File: app/(teacher)/courses/_components/types.ts

export type CourseStatus = 'draft' | 'pending' | 'published';
export type CourseMemberRole = 'previewer' | 'editor' | 'co_owner' | 'owner';

export interface TeacherCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  status: CourseStatus;
  order_index: number;
  my_role: CourseMemberRole; // Quyền của người đang xem khóa học này
}