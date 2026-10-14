import { Ban, CircleCheck, Clock, FilePen, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AdminCourseItemStatus, AdminCourseListRow } from "@/lib/schemas/admin-course";

// Giá trị database không có thì hiển thị "—", không dùng số liệu giả (AD3 AC2).
export const EMPTY_VALUE = "—";

export function formatPrice(price: number | null | undefined) {
  if (typeof price !== "number") return EMPTY_VALUE;
  if (price === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(price);
}

// Múi giờ cố định: component này render cả ở server và client, nên nếu theo múi giờ máy thì ngày giờ lệch giữa hai bên (lỗi hydration).
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatDateTime(value: string | null | undefined) {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY_VALUE : dateTimeFormatter.format(date);
}

type StatusView = { label: string; Icon: LucideIcon; className: string };

const itemStatusViews: Record<AdminCourseItemStatus, StatusView> = {
  pending: { label: "Chờ duyệt", Icon: Clock, className: "border-orange-400/40 bg-orange-500/10 text-orange-300" },
  published: { label: "Đã xuất bản", Icon: CircleCheck, className: "border-sky-400/40 bg-sky-500/10 text-sky-300" },
  draft: { label: "Bản nháp", Icon: FilePen, className: "border-slate-500/60 bg-slate-500/10 text-slate-300" },
};

const removedView: StatusView = {
  label: "Đã gỡ",
  Icon: Ban,
  className: "border-red-400/40 bg-red-500/10 text-red-300",
};

// Course có removed_at luôn là "Đã gỡ" dù cột status còn giá trị cũ (takedown giữ status của course tại thời điểm gỡ).
function statusViewOf(course: Pick<AdminCourseListRow, "status" | "removedAt">): StatusView {
  return course.removedAt ? removedView : itemStatusViews[course.status];
}

export function courseStatusLabel(course: Pick<AdminCourseListRow, "status" | "removedAt">) {
  return statusViewOf(course).label;
}

export function topicStatusLabel(status: AdminCourseItemStatus) {
  return itemStatusViews[status].label;
}

// Trạng thái luôn có chữ và biểu tượng, không chỉ dựa vào màu (WCAG 1.4.1).
export function CourseStatusBadge({ course }: { course: Pick<AdminCourseListRow, "status" | "removedAt"> }) {
  const { label, Icon, className } = statusViewOf(course);
  return (
    <Badge variant="outline" className={`h-6 gap-1.5 rounded-md px-2 text-xs font-semibold ${className}`}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}

export type CourseActionKind = "approve" | "reject" | "demote" | "takedown";

// Nút theo trạng thái chỉ để dễ dùng; quyền và trạng thái thật do server kiểm tra (AD3 G5).
export function courseActionsFor(course: Pick<AdminCourseListRow, "status" | "removedAt">): CourseActionKind[] {
  if (course.removedAt) return [];
  if (course.status === "pending") return ["approve", "reject"];
  if (course.status === "published") return ["demote", "takedown"];
  return [];
}
