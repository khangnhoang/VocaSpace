import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it, vi } from "vitest";
import CoursesPage from "@/app/(teacher)/teacher/courses/page";
import NewCoursePage from "@/app/(teacher)/teacher/courses/new/page";
import CourseForm from "@/app/(teacher)/teacher/courses/_components/CourseForm";
import CourseList from "@/app/(teacher)/teacher/courses/_components/CourseList";
import {
  getTeacherCourseCreatePath,
  getTopicBuilderPath,
  getTopicBuilderTab,
} from "@/lib/course-authoring/routes";
import {
  courseSchema,
  type CourseFormValues,
} from "@/lib/schemas/course";
import type { TeacherCourse } from "@/lib/schemas/course";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/actions/course", () => ({
  createCourse: vi.fn(),
  getCoursesForTeacher: vi.fn(),
  getTeacherCoursePermissions: vi.fn(),
  updateCourse: vi.fn(),
  deleteCourse: vi.fn(),
}));

// Test plan:
// - Mục tiêu: kiểm tra các trust signals chính trong course authoring UI trước khi đổi route architecture.
// - Loại test: component static render/smoke và source copy contract cho Radix dialog portal.
// - Đối tượng: /teacher/courses/new page, CourseList, CourseForm, collaborator entry-point ownership, FormMessage subscription, ConfirmDialog details slot, course/chapter/topic delete identity.
// - Case thành công: /teacher/courses trỏ create CTA tới /teacher/courses/new; /teacher/courses/new render form tạo khóa học; rejected course có reason hợp lệ hiển thị.
// - Case thất bại: null/empty/stale reject_message không hiển thị warning; delete copy không nói xóa vĩnh viễn; CourseForm không tạo collaborator entry point giả.
// - Bảo mật/phân quyền: không áp dụng trực tiếp ở static render; Server Action vẫn được test riêng.
// - Ổn định/resilience: UI không được tạo false-success hoặc misleading destructive copy khi thiếu backend support.
// - Invariant cần giữ: người dạy chỉ thấy trạng thái đã được hệ thống hỗ trợ thật.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:ci -- --reporter=dot` (70 files / 597 tests).

const baseCourse: TeacherCourse = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "TOEIC Trust Course",
  slug: "toeic-trust-course",
  description: "Course authoring trust regression fixture",
  thumbnail_url: null,
  price: 0,
  status: "draft",
  order_index: 1,
  my_role: "owner",
  reject_message: null,
  reviewed_at: null,
};

function renderCourseList(coursesList: TeacherCourse[]) {
  return renderToStaticMarkup(
    <CourseList
      coursesList={coursesList}
      isLoadingData={false}
      isPending={false}
      courseToDelete={null}
      setCourseToDelete={() => {}}
      onEditCourse={() => {}}
    />,
  );
}

function CourseFormEditFixture() {
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: "TOEIC Trust Course",
      slug: "toeic-trust-course",
      description: "Course authoring trust regression fixture",
      price: "0",
      thumbnail_file: null,
    },
  });

  return (
    <CourseForm
      form={form}
      onSubmit={() => {}}
      isPending={false}
      previewUrl={null}
      setPreviewUrl={() => {}}
      onCancel={() => {}}
      isEditMode
    />
  );
}

describe("course authoring trust UI", () => {
  it("routes the course list create action to /teacher/courses/new", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/(teacher)/teacher/courses/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("href={getTeacherCourseCreatePath()}");
    expect(pageSource).toContain("getTeacherCoursePermissions");
    expect(pageSource).toContain("canCreateCourse");
    expect(pageSource).toContain("<CollaboratorInvitationPanel onAccepted={fetchMyCourses} />");
    expect(getTeacherCourseCreatePath()).toBe("/teacher/courses/new");
    expect(CoursesPage).toBeTypeOf("function");
  });

  it("renders /teacher/courses/new as a usable creation form", () => {
    const html = renderToStaticMarkup(<NewCoursePage />);

    expect(html.length).toBeGreaterThan(1000);
    expect(html).toContain("Khởi tạo dự án khóa học mới");
    expect(html).toContain("Tên khóa học");
    expect(html).toContain("Tiến hành tạo");
  });

  it("shows a rejection reason only for a reviewed draft with a meaningful message", () => {
    const html = renderCourseList([
      {
        ...baseCourse,
        reject_message: "  Vui lòng bổ sung bài tập cuối khóa.  ",
        reviewed_at: "2026-06-01T10:00:00.000Z",
      },
      {
        ...baseCourse,
        id: "22222222-2222-4222-8222-222222222222",
        title: "Published stale message",
        status: "published",
        reject_message: "Không nên hiển thị vì course đã published.",
        reviewed_at: "2026-06-01T10:00:00.000Z",
      },
      {
        ...baseCourse,
        id: "33333333-3333-4333-8333-333333333333",
        title: "Draft empty reason",
        reject_message: "   ",
        reviewed_at: "2026-06-01T10:00:00.000Z",
      },
      {
        ...baseCourse,
        id: "44444444-4444-4444-8444-444444444444",
        title: "Draft without review metadata",
        reject_message: "Không nên hiển thị vì thiếu reviewed_at.",
        reviewed_at: null,
      },
      {
        ...baseCourse,
        id: "55555555-5555-4555-8555-555555555555",
        title: "Draft null reason",
        reviewed_at: "2026-06-01T10:00:00.000Z",
      },
    ]);

    expect(html.match(/Khóa học cần chỉnh sửa/g)).toHaveLength(1);
    expect(html).toContain("Khóa học cần chỉnh sửa");
    expect(html).toContain("Vui lòng bổ sung bài tập cuối khóa.");
    expect(html).toContain(
      "Vui lòng cập nhật nội dung khóa học rồi gửi lại để xét duyệt.",
    );
    expect(html).not.toContain("Không nên hiển thị vì course đã published.");
    expect(html).not.toContain("Không nên hiển thị vì thiếu reviewed_at.");
  });

  it("keeps CourseForm outside the sole collaborator management entry point", () => {
    const html = renderToStaticMarkup(<CourseFormEditFixture />);

    expect(html).toContain("Course Overview");
    expect(html).toContain("điểm vào duy nhất cho quản lý cộng tác viên");
    expect(html).not.toContain("Chưa hỗ trợ thêm thành viên");
    expect(html).not.toContain("nhanvien@example.com");
  });

  it("does not expose course mutation controls to a previewer", () => {
    const html = renderCourseList([{ ...baseCourse, my_role: "previewer" }]);

    expect(html).toContain("Mở tổng quan khóa học");
    expect(html).not.toContain("Cài đặt thông tin khóa học");
    expect(html).not.toContain("Đưa khóa học vào thùng rác");
  });

  it("uses soft-delete wording for course, chapter, and topic confirmations", () => {
    const files = [
      "app/(teacher)/teacher/courses/_components/DeleteCourseModal.tsx",
      "app/(teacher)/teacher/courses/[id]/_components/DeleteChapterModal.tsx",
      "app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx",
    ];
    const copySource = files
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(copySource).toContain("ConfirmDialog");
    expect(copySource).toContain("Đưa vào thùng rác");
    expect(copySource).toContain("Ẩn chương");
    expect(copySource).toContain(
      'description="Bài học sẽ được ẩn khỏi cấu trúc đang hoạt động. Nội dung bên trong được giữ lại và có thể khôi phục."',
    );
    expect(copySource).toContain('confirmText="Xóa bài học"');
    expect(copySource).not.toContain("Xóa vĩnh viễn");
  });

  it("supports a generic details slot for confirmation identity blocks", () => {
    const confirmDialogSource = readFileSync(
      join(process.cwd(), "components/ui/confirm-dialog.tsx"),
      "utf8",
    );

    expect(confirmDialogSource).toContain("details?: ReactNode");
    expect(confirmDialogSource).toContain("{details ? <div");
    expect(confirmDialogSource).toContain("sm:max-w-lg");
    expect(confirmDialogSource).toContain("disabled={isLoading}");
    expect(confirmDialogSource).not.toContain("imageUrl");
    expect(confirmDialogSource).not.toContain("rounded-full");
  });

  it("includes selected item identity blocks in delete confirmations", () => {
    const files = [
      "app/(teacher)/teacher/courses/_components/DeleteCourseModal.tsx",
      "app/(teacher)/teacher/courses/[id]/_components/DeleteChapterModal.tsx",
      "app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx",
    ];
    const copySource = files
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(copySource).toContain("details={");
    expect(copySource).toContain("thumbnail_url");
    expect(copySource).toContain("BookOpen");
    expect(copySource).toContain("Slug:");
    expect(copySource).toContain("Trạng thái:");
    expect(copySource).toContain("Chương");
    expect(copySource).toContain("Bài học");
    expect(copySource).not.toContain("Ảnh bìa:");
  });

  it("subscribes form messages directly to field error state", () => {
    const formPrimitiveSource = readFileSync(
      join(process.cwd(), "components/ui/form.tsx"),
      "utf8",
    );

    expect(formPrimitiveSource).toContain("useFormState");
    expect(formPrimitiveSource).toContain(
      "getFieldState(fieldContext.name, fieldFormState)",
    );
  });

  it("opens the topic trash affordance in the settings tab", () => {
    const courseId = "11111111-1111-4111-8111-111111111111";
    const topicId = "55555555-5555-4555-8555-555555555555";

    expect(getTopicBuilderPath(courseId, topicId)).toBe(
      `/teacher/courses/${courseId}/topics/${topicId}`,
    );
    expect(getTopicBuilderPath(courseId, topicId, "settings")).toBe(
      `/teacher/courses/${courseId}/topics/${topicId}?tab=settings`,
    );
    expect(getTopicBuilderTab("settings")).toBe("settings");
    expect(getTopicBuilderTab("unknown")).toBe("exercises");
  });

  it("uses the shared Select primitive for collaborator role controls", () => {
    const dialogSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/teacher/courses/[id]/_components/CollaboratorManagementDialog.tsx",
      ),
      "utf8",
    );

    expect(dialogSource).toContain("SelectTrigger");
    expect(dialogSource).toContain("SelectItem");
    expect(dialogSource).not.toContain("<select");
  });
});
