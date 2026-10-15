import { formatCount, formatVnd } from "@/lib/admin/dashboard-format";
import type { AdminDashboardDTO } from "@/lib/schemas/admin-dashboard";
import { HorizontalDataBar } from "./data-bar";
import { RevealScope } from "./reveal-scope";

// Tối đa năm khóa học, xếp theo số ghi danh (gồm cả học viên đã bị gỡ); doanh thu là tổng thanh toán thành công của chính khóa đó (AC7).
export function TopCourses({ courses }: { courses: AdminDashboardDTO["topCourses"] }) {
  const max = Math.max(...courses.map((course) => course.enrollmentCount), 0);

  return (
    <section
      aria-labelledby="admin-top-courses-heading"
      className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-slate-700 bg-[#111827] p-4 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="admin-top-courses-heading" className="text-lg leading-[26px] font-bold text-slate-50">
          Khóa học nhiều học viên nhất
        </h2>
        <p className="text-sm leading-[22px] text-slate-300">
          Xếp theo số lượt ghi danh. Doanh thu là thanh toán thành công của khóa học, mọi thời điểm.
        </p>
      </div>
      {courses.length === 0 ? (
        <p className="text-sm text-slate-300">Chưa có khóa học nào.</p>
      ) : (
        <RevealScope>
        <ol className="flex flex-col gap-4">
          {courses.map((course, index) => (
            <li key={course.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm leading-[22px] font-bold break-words text-slate-50">
                  <span className="mr-2 font-semibold text-slate-400 tabular-nums">{index + 1}.</span>
                  {course.title}
                </p>
                <p className="shrink-0 text-sm leading-[22px] text-slate-300 tabular-nums">
                  <span className="font-bold text-slate-50">{formatCount(course.enrollmentCount)}</span> học viên
                </p>
              </div>
              <HorizontalDataBar
                percent={max > 0 ? (course.enrollmentCount / max) * 100 : 0}
                value={course.enrollmentCount}
                max={max}
                index={index}
                count={courses.length}
              />
              <p className="text-xs leading-4 font-medium text-slate-400 tabular-nums">
                Doanh thu: {formatVnd(course.revenue)}
              </p>
            </li>
          ))}
        </ol>
        </RevealScope>
      )}
    </section>
  );
}
