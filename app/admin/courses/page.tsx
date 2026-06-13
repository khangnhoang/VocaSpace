"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminCourseStats } from "./_components/admin-course-stats";
import {
  AdminCourseToolbar,
  type AdminCourseStatusFilter,
} from "./_components/admin-course-toolbar";
import {
  AdminCourseTable,
  type AdminCourse,
} from "./_components/admin-course-table";
import { AcceptCourseDialog } from "./_components/accept-course-dialog";
import { RejectCourseDialog } from "./_components/reject-course-dialog";
import type { RejectCourseInput } from "@/lib/schemas/admin-course";

type SubmittingAction = "accept" | "reject" | null;

const MOCK_TIMESTAMP = "2026-06-13T00:00:00.000Z";

// Mock data deterministic cho UI review; thay bằng query thật khi backend review flow sẵn sàng.
const MOCK_ADMIN_COURSES: AdminCourse[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Chinh phục TOEIC 800+ trong 30 ngày",
    slug: "chinh-phuc-toeic-800-trong-30-ngay",
    description: "Khóa học luyện thi TOEIC cấp tốc.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=500&q=60",
    price: 599000,
    status: "published",
    order_index: 1,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2026-05-10T08:00:00Z",
    reviewed_by: "admin-id-1",
    reviewed_at: "2026-05-11T09:30:00Z",
    enrollments_count: 125,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Ngữ pháp tiếng Anh cơ bản",
    slug: "ngu-phap-tieng-anh-co-ban",
    description: "Nền tảng ngữ pháp vững chắc cho người mất gốc.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=500&q=60",
    price: 0,
    status: "pending",
    order_index: 2,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2026-06-12T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    enrollments_count: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Tiếng Anh giao tiếp công sở",
    slug: "tieng-anh-giao-tiep-cong-so",
    description: "Tự tin giao tiếp với đồng nghiệp và đối tác.",
    thumbnail_url: null,
    price: 850000,
    status: "pending",
    order_index: 3,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2026-06-12T23:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    enrollments_count: 0,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    title: "Luyện thi IELTS Speaking",
    slug: "luyen-thi-ielts-speaking",
    description: "Chiến lược trả lời IELTS Speaking band 7.0+.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=500&q=60",
    price: 1200000,
    status: "draft",
    order_index: 4,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: "Vui lòng cập nhật lại video bài giảng.",
    submitted_at: null,
    reviewed_by: "admin-id-1",
    reviewed_at: "2026-06-01T10:00:00Z",
    enrollments_count: 0,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Từ vựng Academic chuyên sâu",
    slug: "tu-vung-academic-chuyen-sau",
    description: "Bộ từ vựng học thuật dành cho sinh viên.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=500&q=60",
    price: 250000,
    status: "published",
    order_index: 5,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2026-01-15T08:00:00Z",
    reviewed_by: "admin-id-1",
    reviewed_at: "2026-01-16T14:30:00Z",
    enrollments_count: 854,
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    title: "Mastering ReactJS: Từ Zero đến Hero",
    slug: "mastering-reactjs-zero-to-hero",
    description: "Làm chủ React và các hook cơ bản đến nâng cao.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=500&q=60",
    price: 1499000,
    status: "pending",
    order_index: 6,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: MOCK_TIMESTAMP,
    reviewed_by: null,
    reviewed_at: null,
    enrollments_count: 0,
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    title: "Lập trình Next.js 14 Thực chiến",
    slug: "lap-trinh-nextjs-14-thuc-chien",
    description: "Khóa học xây dựng ứng dụng với App Router.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=500&q=60",
    price: 1800000,
    status: "published",
    order_index: 7,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2025-11-20T10:00:00Z",
    reviewed_by: "admin-id-1",
    reviewed_at: "2025-11-21T09:00:00Z",
    enrollments_count: 230,
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    title: "Thiết kế UI/UX với Figma",
    slug: "thiet-ke-ui-ux-voi-figma",
    description: "Làm chủ công cụ Figma từ cơ bản đến prototype.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=500&q=60",
    price: 850000,
    status: "pending",
    order_index: 8,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2026-06-12T22:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    enrollments_count: 0,
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    title: "Viết CV & Trả lời phỏng vấn IT",
    slug: "viet-cv-va-tra-loi-phong-van-it",
    description: "Bí kíp chinh phục nhà tuyển dụng ngành IT.",
    thumbnail_url: null,
    price: 0,
    status: "draft",
    order_index: 9,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    enrollments_count: 0,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Khóa học Nhiếp ảnh bằng điện thoại",
    slug: "khoa-hoc-nhiep-anh-bang-dien-thoai",
    description: "Chụp ảnh sản phẩm và chân dung bằng Smartphone.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=500&q=60",
    price: 499000,
    status: "published",
    order_index: 10,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2026-03-12T08:00:00Z",
    reviewed_by: "admin-id-1",
    reviewed_at: "2026-03-15T10:00:00Z",
    enrollments_count: 45,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: "Tiếng Trung giao tiếp (HSK 1-2)",
    slug: "tieng-trung-giao-tiep-hsk-1-2",
    description: "Giao tiếp cơ bản dành cho người mới bắt đầu.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1528696892704-5e1122852276?auto=format&fit=crop&w=500&q=60",
    price: 1200000,
    status: "pending",
    order_index: 11,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2026-06-12T22:53:20.000Z",
    reviewed_by: null,
    reviewed_at: null,
    enrollments_count: 0,
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    title: "Mastering Python for Data Science",
    slug: "mastering-python-data-science",
    description: "Phân tích dữ liệu với Python và thư viện Pandas.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=500&q=60",
    price: 2500000,
    status: "published",
    order_index: 12,
    created_at: MOCK_TIMESTAMP,
    updated_at: MOCK_TIMESTAMP,
    removed_at: null,
    reject_message: null,
    submitted_at: "2026-04-01T08:00:00Z",
    reviewed_by: "admin-id-1",
    reviewed_at: "2026-04-05T09:00:00Z",
    enrollments_count: 99,
  },
];

export default function AdminCoursesPage() {
  const courses = MOCK_ADMIN_COURSES;
  const [statusFilter, setStatusFilter] =
    useState<AdminCourseStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<AdminCourse | null>(
    null,
  );
  const [submittingAction, setSubmittingAction] =
    useState<SubmittingAction>(null);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchStatus =
        statusFilter === "all" || course.status === statusFilter;
      const matchQuery =
        !normalizedSearchQuery ||
        course.title.toLowerCase().includes(normalizedSearchQuery) ||
        course.slug.toLowerCase().includes(normalizedSearchQuery);

      return matchStatus && matchQuery;
    });
  }, [courses, normalizedSearchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      totalCourses: courses.length,
      draftCourses: courses.filter((course) => course.status === "draft")
        .length,
      pendingCourses: courses.filter((course) => course.status === "pending")
        .length,
      publishedCourses: courses.filter(
        (course) => course.status === "published",
      ).length,
      totalEnrollments: courses.reduce(
        (acc, course) => acc + (course.enrollments_count ?? 0),
        0,
      ),
    };
  }, [courses]);

  const resetFilters = () => {
    setStatusFilter("all");
    setSearchQuery("");
  };

  const openAccept = (course: AdminCourse) => {
    setSelectedCourse(course);
    setRejectDialogOpen(false);
    setAcceptDialogOpen(true);
  };

  const openReject = (course: AdminCourse) => {
    setSelectedCourse(course);
    setAcceptDialogOpen(false);
    setRejectDialogOpen(true);
  };

  const closeReviewDialog = (open: boolean) => {
    if (open || submittingAction) return;
    setAcceptDialogOpen(false);
    setRejectDialogOpen(false);
    setSelectedCourse(null);
  };

  const handleConfirmAccept = async () => {
    if (!selectedCourse) return false;

    try {
      setSubmittingAction("accept");
      throw new Error("acceptCourse action is not implemented yet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
      return false;
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleConfirmReject = async (payload: RejectCourseInput) => {
    if (!selectedCourse) return false;

    try {
      setSubmittingAction("reject");
      void payload;
      throw new Error("rejectCourse action is not implemented yet");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đã có lỗi xảy ra");
      return false;
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-x-hidden p-4 pt-4 md:p-8 md:pt-6">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Quản lý khóa học
          </h2>
          <p className="mt-1 text-slate-400">
            Danh sách khóa học, xét duyệt và xuất bản nội dung.
          </p>
        </div>
      </div>

      <AdminCourseStats {...stats} />

      <div className="space-y-4">
        <AdminCourseToolbar
          status={statusFilter}
          query={searchQuery}
          onStatusChange={setStatusFilter}
          onQueryChange={setSearchQuery}
        />
        <AdminCourseTable
          key={`${statusFilter}:${normalizedSearchQuery}`}
          courses={filteredCourses}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          onResetFilters={resetFilters}
          onAccept={openAccept}
          onReject={openReject}
        />
      </div>

      <AcceptCourseDialog
        open={acceptDialogOpen}
        onOpenChange={closeReviewDialog}
        course={acceptDialogOpen ? selectedCourse : null}
        isSubmitting={submittingAction === "accept"}
        onConfirm={handleConfirmAccept}
      />

      <RejectCourseDialog
        open={rejectDialogOpen}
        onOpenChange={closeReviewDialog}
        course={rejectDialogOpen ? selectedCourse : null}
        isSubmitting={submittingAction === "reject"}
        onConfirm={handleConfirmReject}
      />
    </div>
  );
}
