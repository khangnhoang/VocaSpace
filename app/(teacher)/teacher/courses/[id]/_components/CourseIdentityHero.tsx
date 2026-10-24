import { CircleCheck, Clock3, FilePenLine, MessageSquareWarning } from "lucide-react";
import { courseRoleLabels, courseStatusLabels } from "@/lib/course-authoring/portfolio";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";
import CourseThumbnail from "../../_components/CourseThumbnail";
import CollaboratorManagementDialog from "./CollaboratorManagementDialog";
import CourseCollaborationLeaveDialog from "./CourseCollaborationLeaveDialog";
import CourseCollaboratorSummary from "./CourseCollaboratorSummary";

function formatPrice(price: number | null) {
  if (!price) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
}

const statusStyles = {
  draft: { className: "text-slate-700", icon: FilePenLine },
  pending: { className: "text-route", icon: Clock3 },
  published: { className: "text-growth", icon: CircleCheck },
} as const;

interface CourseIdentityHeroProps {
  readiness: CourseDashboardReadiness;
  isRejected: boolean;
}

// Chỉ dùng dữ liệu readiness để vùng nhận diện luôn hiện ngay; số liệu ghi danh nằm trong vùng số liệu riêng (AC1, AC10).
export default function CourseIdentityHero({ readiness, isRejected }: CourseIdentityHeroProps) {
  const { course, role, counts, publishedTopicCount } = readiness;
  const status = course.status ?? "draft";
  const StatusIcon = statusStyles[status].icon;
  const canManageCollaborators = role === "owner" || role === "co_owner";

  return (
    <section aria-labelledby="course-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid gap-5 p-5 sm:grid-cols-[176px_minmax(0,1fr)] sm:gap-6 sm:p-6">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-route-quiet sm:aspect-[4/3]">
          <CourseThumbnail src={course.thumbnail_url} sizes="(min-width: 640px) 176px, 100vw" />
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
            <span className={`inline-flex items-center gap-1 ${statusStyles[status].className}`}>
              <StatusIcon className="size-3.5" aria-hidden="true" />{courseStatusLabels[status]}
            </span>
            {isRejected ? (
              <>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="inline-flex items-center gap-1 text-correction"><MessageSquareWarning className="size-3.5" aria-hidden="true" />Bị từ chối niêm yết</span>
              </>
            ) : null}
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="text-slate-900">{courseRoleLabels[role]}</span>
          </p>
          <h1 id="course-title" className="mt-2 text-[26px] font-extrabold leading-[34px] tracking-tight [overflow-wrap:anywhere] sm:text-[32px] sm:leading-10">{course.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{course.description || "Khóa học chưa có mô tả."}</p>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-xs font-medium text-slate-600">Giá</dt>
              <dd className="mt-0.5 text-sm font-bold">{formatPrice(course.price)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-600">Bài đã xuất bản</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums">{publishedTopicCount} / {counts.topics} bài</dd>
            </div>
          </dl>
        </div>
      </div>
      <div id="collaborators" className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Cộng tác viên</h2>
          {/* Danh sách thành viên tải phía client; giữ sẵn chỗ cho hai dòng (avatar + vai trò) để trang không bị đẩy xuống. */}
          <div className="mt-2 min-h-24 sm:min-h-17">
            <CourseCollaboratorSummary courseId={course.id} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageCollaborators ? <CollaboratorManagementDialog courseId={course.id} actorRole={role} /> : null}
          <CourseCollaborationLeaveDialog courseId={course.id} actorRole={role} />
        </div>
      </div>
    </section>
  );
}
