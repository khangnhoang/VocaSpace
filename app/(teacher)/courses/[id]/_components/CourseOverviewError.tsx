import Link from "next/link";
import type { CourseReadinessErrorCode } from "@/lib/schemas/course-readiness";

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
    actionHref: "/courses",
    actionLabel: "Quay lại danh sách khóa học",
  },
  AUTH_REQUIRED: {
    title: "Phiên đăng nhập đã hết hạn",
    actionHref: "/login",
    actionLabel: "Đăng nhập lại",
  },
  COURSE_NOT_FOUND_OR_FORBIDDEN: {
    title: "Không thể mở tổng quan khóa học",
    actionHref: "/courses",
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
  const actionHref = copy.shouldRetry ? retryHref : copy.actionHref || "/courses";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          {copy.shouldRetry ? (
            <a
              href={actionHref}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-bold text-white hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/40"
            >
              {copy.actionLabel}
            </a>
          ) : (
            <Link
              href={actionHref}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-bold text-white hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/40"
            >
              {copy.actionLabel}
            </Link>
          )}
          {copy.shouldRetry && (
            <Link
              href="/courses"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-400/30"
            >
              Quay lại danh sách khóa học
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
