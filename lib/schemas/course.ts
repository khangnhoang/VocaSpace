// File: lib/schemas/course.ts
import { z } from "zod";
import type {
  CourseMemberRole as DatabaseCourseMemberRole,
  ItemStatus,
} from "@/types/database";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const COURSE_STATUSES = ["draft", "pending", "published"] as const satisfies readonly ItemStatus[];
const COURSE_MEMBER_ROLES = [
  "previewer",
  "editor",
  "co_owner",
  "owner",
] as const satisfies readonly DatabaseCourseMemberRole[];

export const courseStatusSchema = z.enum(COURSE_STATUSES);
export const courseMemberRoleSchema = z.enum(COURSE_MEMBER_ROLES);
export const courseIdSchema = z.uuid("ID khóa học không hợp lệ.");

export const courseSchema = z.object({
  title: z.string().trim().min(5, "Tên khóa học phải có ít nhất 5 ký tự"),
  slug: z.string()
    .trim()
    .min(3, "Đường dẫn ít nhất 3 ký tự")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Đường dẫn chỉ được chứa chữ cái thường, số và dấu gạch ngang (VD: toeic-800)"),
  description: z.string().trim().min(10, "Mô tả khóa học ít nhất 10 ký tự"),
  price: z.string()
    .trim()
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Giá tiền phải là một số hợp lệ lớn hơn hoặc bằng 0")
    .optional()
    .or(z.literal("")),
  thumbnail_file: z.any()
    .refine((file) => {
      if (!file) return true; // Cho phép bỏ trống ảnh
      return file.size <= MAX_FILE_SIZE;
    }, "Kích thước ảnh tối đa là 2MB.")
    .refine((file) => {
      if (!file) return true;
      return ACCEPTED_IMAGE_TYPES.includes(file.type);
    }, "Chỉ chấp nhận định dạng .jpg, .jpeg, .png và .webp")
    .optional()
    .nullable(),
});

export type CourseFormValues = z.infer<typeof courseSchema>;

export const courseCollaboratorInviteSchema = z.object({
  courseId: courseIdSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Định dạng email không hợp lệ.")),
  role: z.enum(["previewer", "editor", "co_owner"], {
    message: "Vai trò cộng tác viên không hợp lệ.",
  }),
});

export type CourseCollaboratorInviteInput = z.infer<
  typeof courseCollaboratorInviteSchema
>;

export const teacherCourseRecordSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  price: z.number().nullable(),
  status: courseStatusSchema.nullable(),
  order_index: z.number().nullable(),
  reject_message: z.string().nullable(),
  reviewed_at: z.string().nullable(),
});

export const teacherCourseRowSchema = z.object({
  role: courseMemberRoleSchema,
  courses: z.union([
    teacherCourseRecordSchema,
    z.array(teacherCourseRecordSchema),
  ]),
});

export const teacherCourseRowsSchema = z.array(teacherCourseRowSchema);

export const teacherCourseSchema = teacherCourseRecordSchema.extend({
  price: z.number(),
  status: courseStatusSchema,
  order_index: z.number(),
  my_role: courseMemberRoleSchema,
});

export type TeacherCourse = z.infer<typeof teacherCourseSchema>;
