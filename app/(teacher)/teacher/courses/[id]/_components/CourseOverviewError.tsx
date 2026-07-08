import Link from "next/link";
import { getTeacherCourseListPath } from "@/lib/course-authoring/routes";
import type { CourseReadinessErrorCode } from "@/lib/schemas/course-readiness";

const teacherCourseListPath = getTeacherCourseListPath();

const errorCopy: Record<
  CourseReadinessErrorCode,
  {
    title: string;
    actionLabel: string;
    actionHref?: string;
    shouldRetry?: boolean;
  }
> = {
  INVALID_COURSE_ID: {
    title: "Đường dẫn khóa học không hợp lệ",
    actionHref: teacherCourseListPath,
    actionLabel: "Quay lại danh sách khóa học",
  },
  AUTH_REQUIRED: {
    title: "Phiên đăng nhập đã hết hạn",
    actionHref: "/login",
    actionLabel: "Đăng nhập lại",
  },
  COURSE_NOT_FOUND_OR_FORBIDDEN: {
    title: "Không thể mở tổng quan khóa học",
    actionHref: teacherCourseListPath,
    actionLabel: "Quay lại danh sách khóa học",
  },
  QUERY_FAILED: {
    title: "Không thể tải tổng quan khóa học",
    actionLabel: "Thử tải lại",
    shouldRetry: true,
  },
  INVALID_READINESS_DATA: {
    title: "Dữ liệu tổng quan chưa hợp lệ",
    actionLabel: "Thử tải lại",
    shouldRetry: true,
  },
};

interface CourseOverviewErrorProps {
  code: CourseReadinessErrorCode;
  message: string;
  retryHref: string;
}

export default function CourseOverviewError({
  code,
  message,
  retryHref,
}: CourseOverviewErrorProps) {
  const copy = errorCopy[code];
  const actionHref = copy.shouldRetry
    ? retryHref
    : copy.actionHref || teacherCourseListPath;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
        <h1 className="wrap-break-word text-xl font-bold text-slate-950">
          {copy.title}
        </h1>
        <p className="mt-2 wrap-break-word text-sm leading-6 text-slate-600">
          {message}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          {copy.shouldRetry ? (
            <a
              href={actionHref}
              className="inline-flex h-auto min-h-10 w-full items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-center text-sm font-bold leading-5 whitespace-normal text-white hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/40 sm:w-auto"
            >
              {copy.actionLabel}
            </a>
          ) : (
            <Link
              href={actionHref}
              className="inline-flex h-auto min-h-10 w-full items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-center text-sm font-bold leading-5 whitespace-normal text-white hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/40 sm:w-auto"
            >
              {copy.actionLabel}
            </Link>
          )}
          {copy.shouldRetry && (
            <Link
              href={teacherCourseListPath}
              className="inline-flex h-auto min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-bold leading-5 whitespace-normal text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-400/30 sm:w-auto"
            >
              Quay lại danh sách khóa học
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
