import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Clock3, Layers, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";
import type { TeacherCoursePortfolioResult } from "@/lib/schemas/teacher-course-portfolio";
import CourseInfoEditDialog from "./CourseInfoEditDialog";
import CourseListingReviewControls from "./CourseListingReviewControls";
import CourseOtherWorkList, { CourseOtherWorkListFallback } from "./CourseOtherWorkList";

type PrimaryAction = "issue" | "edit" | "submit" | "structure";

// Bảng trạng thái mục 1.2.1 của docs/teacher-course-overview-plan.md: luôn đúng một nút filled.
// Nút Gửi duyệt/Rút yêu cầu vẫn hiện đúng như AD2 cho owner/co_owner, chỉ hạ xuống outline khi
// hành động chính là việc khác.
export function getCourseNextAction(readiness: CourseDashboardReadiness) {
  const { course, role, issues, publishedTopicCount } = readiness;
  const status = course.status ?? "draft";
  const canManage = role === "owner" || role === "co_owner";
  const isRejected = status === "draft" && Boolean(course.reviewed_at) && Boolean(course.reject_message?.trim());
  const primary: PrimaryAction = issues.length > 0
    ? "issue"
    : isRejected
      ? "edit"
      : status === "draft" && canManage && publishedTopicCount > 0
        ? "submit"
        : "structure";
  return {
    status,
    canManage,
    isRejected,
    primary,
    showListingControls: canManage && (status === "draft" || status === "pending"),
    showEdit: isRejected,
  };
}

interface CourseNextActionPanelProps {
  readiness: CourseDashboardReadiness;
  portfolio: Promise<TeacherCoursePortfolioResult>;
}

function Eyebrow({ tone, icon, children }: { tone: "attention" | "correction" | "growth" | "route"; icon: ReactNode; children: ReactNode }) {
  const toneClassName = {
    attention: "text-attention",
    correction: "text-correction",
    growth: "text-growth",
    route: "text-route",
  }[tone];
  return <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${toneClassName}`}>{icon}{children}</p>;
}

export default function CourseNextActionPanel({ readiness, portfolio }: CourseNextActionPanelProps) {
  const { course, issues, primaryCta, publishedTopicCount } = readiness;
  const next = getCourseNextAction(readiness);
  const structureHref = getCourseStructurePath(course.id);
  const headlineIssue = issues.find((issue) => issue.id === primaryCta.sourceIssueId) ?? issues[0];
  const otherIssues = issues.filter((issue) => issue.id !== headlineIssue?.id);

  let eyebrow: ReactNode;
  let title: string;
  let body: string;
  let railClassName = "border-l-attention";
  if (next.primary === "issue" && headlineIssue) {
    eyebrow = <Eyebrow tone="attention" icon={<CircleAlert className="size-4" aria-hidden="true" />}>Việc tiếp theo · còn {issues.length} việc cần xử lý</Eyebrow>;
    title = headlineIssue.context;
    body = headlineIssue.isBlocking
      ? "Học viên chưa học được trọn vẹn phần này cho đến khi bạn hoàn thiện."
      : "Nên hoàn thiện để nội dung đầy đủ hơn cho học viên.";
  } else if (next.primary === "edit") {
    railClassName = "border-l-correction";
    eyebrow = <Eyebrow tone="correction" icon={<MessageSquareWarning className="size-4" aria-hidden="true" />}>Cần sửa để niêm yết</Eyebrow>;
    title = "Sửa thông tin khóa học theo góp ý";
    body = next.canManage
      ? "Sau khi sửa, hãy gửi duyệt lại để quản trị viên xem xét."
      : "Sau khi sửa, chủ sở hữu hoặc đồng sở hữu sẽ gửi duyệt lại.";
  } else if (next.primary === "submit") {
    railClassName = "border-l-growth";
    eyebrow = <Eyebrow tone="growth" icon={<CircleCheck className="size-4" aria-hidden="true" />}>Không còn việc cần xử lý</Eyebrow>;
    title = "Sẵn sàng gửi duyệt niêm yết";
    body = "Quản trị viên sẽ xem xét trước khi khóa học xuất hiện với học viên.";
  } else if (next.status === "pending") {
    railClassName = "border-l-route";
    eyebrow = <Eyebrow tone="route" icon={<Clock3 className="size-4" aria-hidden="true" />}>Đang chờ duyệt niêm yết</Eyebrow>;
    title = "Quản trị viên đang xem xét khóa học";
    body = "Bạn vẫn có thể tiếp tục soạn và chỉnh sửa bài học trong lúc chờ.";
  } else if (next.status === "draft" && next.canManage && publishedTopicCount === 0) {
    eyebrow = <Eyebrow tone="attention" icon={<CircleAlert className="size-4" aria-hidden="true" />}>Chưa thể gửi duyệt</Eyebrow>;
    title = "Xuất bản ít nhất một bài học";
    body = "Khóa học cần ít nhất 1 bài học đã xuất bản trước khi gửi duyệt niêm yết.";
  } else {
    railClassName = "border-l-growth";
    eyebrow = <Eyebrow tone="growth" icon={<CircleCheck className="size-4" aria-hidden="true" />}>Không còn việc cần xử lý</Eyebrow>;
    title = next.status === "published" ? "Khóa học đã xuất bản" : "Nội dung đã đủ điều kiện kiểm tra";
    body = next.status === "published"
      ? "Tiếp tục bổ sung bài học trong cấu trúc khi cần."
      : "Chủ sở hữu hoặc đồng sở hữu gửi duyệt niêm yết khi khóa học sẵn sàng.";
  }

  const primaryButtonClassName = "w-full whitespace-normal";
  const editCourse = { id: course.id, title: course.title, slug: course.slug, description: course.description, thumbnail_url: course.thumbnail_url, price: course.price };

  return (
    <section aria-labelledby="next-action-title" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className={`border-l-4 p-5 sm:p-6 ${railClassName}`}>
        {eyebrow}
        <h2 id="next-action-title" className="mt-2 text-lg font-bold leading-7 [overflow-wrap:anywhere]">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p>
        {next.isRejected && course.reject_message ? (
          <div role="note" className="mt-4 rounded-lg border border-correction-line bg-correction-quiet p-3 text-sm leading-6">
            <p className="font-semibold text-correction">Yêu cầu duyệt bị từ chối</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{course.reject_message}</p>
          </div>
        ) : null}
        {next.status === "pending" && next.primary !== "structure" ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600"><Clock3 className="size-4 text-route" aria-hidden="true" />Khóa học đang chờ quản trị viên duyệt niêm yết.</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          {next.primary === "issue" ? (
            <Button asChild size="lg" className={primaryButtonClassName}>
              <Link href={primaryCta.destination.href}>{primaryCta.label}<ArrowRight aria-hidden="true" /></Link>
            </Button>
          ) : null}
          {next.primary === "edit" ? <CourseInfoEditDialog course={editCourse} emphasis="filled" /> : null}
          {next.primary === "structure" ? (
            <Button asChild size="lg" className={primaryButtonClassName}>
              <Link href={structureHref}><Layers aria-hidden="true" />Mở cấu trúc</Link>
            </Button>
          ) : null}
          {next.showEdit && next.primary !== "edit" ? <CourseInfoEditDialog course={editCourse} emphasis="outline" /> : null}
          {next.showListingControls ? (
            <CourseListingReviewControls
              readiness={readiness}
              emphasis={next.primary === "submit" ? "filled" : "outline"}
              showRejectionReason={false}
            />
          ) : null}
          {next.primary !== "structure" ? (
            <Button asChild variant="link" className="justify-start px-0 coarse-input:h-11">
              <Link href={structureHref}>Xem toàn bộ cấu trúc<ArrowRight aria-hidden="true" /></Link>
            </Button>
          ) : null}
        </div>
      </div>
      <Suspense fallback={<CourseOtherWorkListFallback issues={otherIssues} />}>
        <CourseOtherWorkList courseId={course.id} issues={otherIssues} portfolio={portfolio} />
      </Suspense>
    </section>
  );
}
