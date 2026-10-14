import { Check, FileDown, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminCourseListRow } from "@/lib/schemas/admin-course";
import { courseActionsFor, type CourseActionKind } from "./admin-course-format";

type CourseActionButtonsProps = {
  course: AdminCourseListRow;
  onAction: (kind: CourseActionKind, course: AdminCourseListRow) => void;
  className?: string;
};

// Chữ trên nền admin tối: Button dùng token của theme sáng nên các biến thể phụ được đặt màu tường minh ở nơi dùng.
const secondaryClass = "border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white";
const quietDestructiveClass = "rounded-l-none border-l border-slate-600 text-red-300 hover:bg-red-500/15 hover:text-red-200";

// Hành động chính ở bên trái; hành động hủy bỏ không thể hoàn tác nằm sau một vạch ngăn để không bấm nhầm kề nhau (AD3 AC9).
export function CourseActionButtons({ course, onAction, className }: CourseActionButtonsProps) {
  const actions = courseActionsFor(course);
  if (actions.length === 0) return null;
  const [primary, destructive] = actions;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-2 ${className ?? ""}`}>
      {primary === "approve" ? (
        <Button type="button" size="sm" onClick={() => onAction("approve", course)} aria-label={`Duyệt khóa học ${course.title}`}>
          <Check aria-hidden="true" />
          Duyệt
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={secondaryClass}
          onClick={() => onAction("demote", course)}
          aria-label={`Hạ về bản nháp: ${course.title}`}
        >
          <FileDown aria-hidden="true" />
          Hạ về bản nháp
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="destructive-quiet"
        className={quietDestructiveClass}
        onClick={() => onAction(destructive, course)}
        aria-label={`${destructive === "reject" ? "Từ chối" : "Gỡ"} khóa học ${course.title}`}
      >
        {destructive === "reject" ? <X aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
        {destructive === "reject" ? "Từ chối" : "Gỡ khóa học"}
      </Button>
    </div>
  );
}
