import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Layers,
  Library,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";
import CourseReadinessIssueList from "./CourseReadinessIssueList";
import EmptyCourseDashboard from "./EmptyCourseDashboard";

interface CourseOverviewProps {
  readiness: CourseDashboardReadiness;
}

const statusLabels: Record<
  NonNullable<CourseDashboardReadiness["course"]["status"]>,
  string
> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Đã xuất bản",
};

const roleLabels: Record<CourseDashboardReadiness["role"], string> = {
  owner: "Chủ sở hữu",
  co_owner: "Đồng sở hữu",
  editor: "Biên tập viên",
  previewer: "Chỉ xem trước",
};

function formatPrice(price: number | null) {
  if (!price) return "Miễn phí";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

function formatStatus(status: CourseDashboardReadiness["course"]["status"]) {
  return status ? statusLabels[status] : "Bản nháp";
}

function formatOrderIndex(orderIndex: number | null) {
  return orderIndex ?? "Chưa sắp xếp";
}

export default function CourseOverview({ readiness }: CourseOverviewProps) {
  const { course, counts, issues, primaryCta, role } = readiness;
  const hasIssues = issues.length > 0;

  if (counts.chapters === 0) {
    return <EmptyCourseDashboard readiness={readiness} />;
  }

  const overviewStats = [
    {
      label: "Chương",
      value: counts.chapters,
      helper: "Khung lớn của khóa học",
      icon: <Layers className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-blue-100 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/20",
      iconClassName:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      valueClassName: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Bài học",
      value: counts.topics,
      helper: "Nơi soạn nội dung",
      icon: <FileText className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20",
      iconClassName:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      valueClassName: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Flashcards",
      value: counts.flashcards,
      helper: "Thẻ từ vựng",
      icon: <Library className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-amber-100 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20",
      iconClassName:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      valueClassName: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "Bài tập",
      value: counts.exercises,
      helper: "Hoạt động luyện tập",
      icon: <BookOpen className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-rose-100 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20",
      iconClassName:
        "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
      valueClassName: "text-rose-700 dark:text-rose-300",
    },
    {
      label: "Câu hỏi",
      value: counts.questions,
      helper: "Câu hỏi đang hoạt động",
      icon: <HelpCircle className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-violet-100 bg-violet-50/70 dark:border-violet-900/50 dark:bg-violet-950/20",
      iconClassName:
        "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
      valueClassName: "text-violet-700 dark:text-violet-300",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-6 text-slate-900 sm:px-6 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link
            href="/courses"
            className="rounded-sm hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            Khóa học của tôi
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900">Tổng quan</span>
        </nav>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                  {formatStatus(course.status)}
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {roleLabels[role]}
                </span>
              </div>
              <div>
                <h1 className="wrap-break-word text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">
                  {course.title}
                </h1>
                <p className="mt-2 max-w-3xl wrap-break-word text-sm leading-6 text-slate-600">
                  {course.description || "Khóa học chưa có mô tả."}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-800">
                <ClipboardCheck className="size-4" aria-hidden="true" />
                Việc tiếp theo
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {hasIssues
                  ? `Còn ${issues.length} việc cần xử lý trước khi khóa học sẵn sàng hơn.`
                  : "Khóa học hiện không có việc cần xử lý trong phần kiểm tra hiện tại."}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col">
                <Button
                  asChild
                  size="lg"
                  className="h-auto min-h-10 w-full whitespace-normal bg-[#3B82F6] px-3 py-2 text-center leading-5 text-white hover:bg-[#2563EB]"
                >
                  <Link href={primaryCta.destination.href}>
                    <Pencil className="size-4" aria-hidden="true" />
                    {primaryCta.label}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-10 w-full whitespace-normal bg-white px-3 py-2 text-center leading-5"
                >
                  <Link href="/courses">
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Danh sách
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          aria-labelledby="content-summary-title"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="content-summary-title"
                className="text-lg font-bold text-slate-950"
              >
                Tóm tắt nội dung
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Những số liệu giáo viên cần quét nhanh trước khi tiếp tục soạn khóa học.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {overviewStats.map((item) => (
              <div
                key={item.label}
                className={`min-w-0 rounded-lg border p-4 transition-colors ${item.surfaceClassName}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-8 items-center justify-center rounded-md ${item.iconClassName}`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 wrap-break-word text-sm font-semibold">
                    {item.label}
                  </span>
                </div>
                <p className={`mt-3 text-3xl font-black ${item.valueClassName}`}>
                  {item.value}
                </p>
                <p className="mt-1 wrap-break-word text-xs leading-5 text-slate-500">
                  {item.helper}
                </p>
              </div>
            ))}
          </div>
        </section>

        {hasIssues ? (
          <CourseReadinessIssueList issues={issues} />
        ) : (
          <section
            className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm"
            aria-labelledby="ready-state-title"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              <h2 id="ready-state-title">Chưa có việc cần xử lý</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Khóa học hiện không có vấn đề nào trong phần kiểm tra nội dung đang hoạt
              động. Bạn vẫn có thể tiếp tục soạn hoặc rà soát bài học.
            </p>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">Thông tin cơ bản</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Slug</dt>
              <dd className="mt-1 break-all font-semibold text-slate-900">
                {course.slug}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Giá</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {formatPrice(course.price)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Thứ tự</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {formatOrderIndex(course.order_index)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
