import Link from "next/link";
import { getCourseDashboardReadiness } from "@/app/actions/course-readiness";
import type { CourseReadinessErrorCode } from "@/lib/schemas/course-readiness";
import CourseOverview from "./_components/CourseOverview";

const errorCopy: Record<
  CourseReadinessErrorCode,
  { title: string; actionHref: string; actionLabel: string }
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
    actionHref: "/courses",
    actionLabel: "Quay lại danh sách khóa học",
  },
  INVALID_READINESS_DATA: {
    title: "Dữ liệu tổng quan chưa hợp lệ",
    actionHref: "/courses",
    actionLabel: "Quay lại danh sách khóa học",
  },
};

function CourseOverviewError({
  code,
  message,
}: {
  code: CourseReadinessErrorCode;
  message: string;
}) {
  const copy = errorCopy[code];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <Link
          href={copy.actionHref}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-bold text-white hover:bg-[#2563EB]"
        >
          {copy.actionLabel}
        </Link>
      </div>
    </div>
  );
}

export default async function CourseOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const readiness = await getCourseDashboardReadiness(resolvedParams.id);

  if (!readiness.success) {
    return (
      <CourseOverviewError
        code={readiness.error.code}
        message={readiness.error.message}
      />
    );
  }

  return <CourseOverview readiness={readiness.data} />;
}
