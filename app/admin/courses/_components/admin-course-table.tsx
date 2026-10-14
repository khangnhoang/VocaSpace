import { CourseActionButtons } from "./course-action-buttons";
import {
  CourseStatusBadge,
  EMPTY_VALUE,
  formatDateTime,
  formatPrice,
  type CourseActionKind,
} from "./admin-course-format";
import type { AdminCourseListRow } from "@/lib/schemas/admin-course";

type AdminCourseTableProps = {
  courses: AdminCourseListRow[];
  onOpenSummary: (course: AdminCourseListRow) => void;
  onAction: (kind: CourseActionKind, course: AdminCourseListRow) => void;
};

const headerClass = "px-4 py-3 text-left align-middle text-xs font-bold tracking-wide text-slate-300 uppercase";
// Dưới lg mỗi hàng thành một thẻ: role tường minh giữ ngữ nghĩa bảng cho trình đọc màn hình khi CSS đổi display.
const cellClass = "block px-4 py-2 align-top lg:table-cell lg:py-4";
const mobileLabelClass = "mr-2 text-xs font-semibold text-slate-400 lg:hidden";

function TimeLine({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="text-xs leading-5 text-slate-300">
      <span className="text-slate-400">{label}: </span>
      {formatDateTime(value)}
    </p>
  );
}

export function AdminCourseTable({ courses, onOpenSummary, onAction }: AdminCourseTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-sm">
      <div className="overflow-x-auto">
        <table role="table" aria-label="Danh sách khóa học" className="block w-full text-sm lg:table lg:min-w-[960px]">
          <thead role="rowgroup" className="sr-only lg:table-header-group lg:not-sr-only lg:bg-[#0B1120]">
            <tr role="row" className="lg:table-row lg:border-b lg:border-slate-800">
              <th role="columnheader" scope="col" className={`${headerClass} lg:w-[32%]`}>
                Khóa học
              </th>
              <th role="columnheader" scope="col" className={`${headerClass} lg:w-[14%]`}>
                Chủ sở hữu
              </th>
              <th role="columnheader" scope="col" className={`${headerClass} lg:w-[10%]`}>
                Giá
              </th>
              <th role="columnheader" scope="col" className={`${headerClass} lg:w-[12%]`}>
                Trạng thái
              </th>
              <th role="columnheader" scope="col" className={`${headerClass} lg:w-[16%]`}>
                Thời gian
              </th>
              <th role="columnheader" scope="col" className={`${headerClass} lg:w-[16%]`}>
                Hành động
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="block text-slate-200 lg:table-row-group">
            {courses.map((course) => (
              <tr
                key={course.id}
                role="row"
                className="block border-b border-slate-800 py-3 transition-colors last:border-b-0 hover:bg-[#1E293B]/50 lg:table-row lg:py-0"
              >
                <td role="cell" className={cellClass}>
                  <button
                    type="button"
                    onClick={() => onOpenSummary(course)}
                    aria-haspopup="dialog"
                    className="block max-w-full rounded-md text-left font-bold break-words text-white underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
                  >
                    {course.title}
                    <span className="sr-only">, xem tóm tắt</span>
                  </button>
                  <p className="mt-1 text-xs break-all text-slate-400">{course.slug}</p>
                  {course.rejectMessage ? (
                    <p
                      role="note"
                      className="mt-2 rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-xs leading-5 break-words text-red-100"
                    >
                      <span className="font-bold">Lý do từ chối: </span>
                      {course.rejectMessage}
                    </p>
                  ) : null}
                </td>
                <td role="cell" className={`${cellClass} text-slate-200`}>
                  <span className={mobileLabelClass}>Chủ sở hữu</span>
                  {course.ownerName ?? EMPTY_VALUE}
                </td>
                <td role="cell" className={`${cellClass} font-medium text-slate-200`}>
                  <span className={mobileLabelClass}>Giá</span>
                  {formatPrice(course.price)}
                </td>
                <td role="cell" className={cellClass}>
                  <CourseStatusBadge course={course} />
                </td>
                <td role="cell" className={cellClass}>
                  <TimeLine label="Gửi duyệt" value={course.submittedAt} />
                  <TimeLine label="Xử lý duyệt" value={course.reviewedAt} />
                  {course.removedAt ? <TimeLine label="Đã gỡ" value={course.removedAt} /> : null}
                </td>
                <td role="cell" className={cellClass}>
                  <CourseActionButtons course={course} onAction={onAction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
