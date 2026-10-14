import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildAdminCoursesHref } from "@/lib/admin/routes";
import type { AdminCourseFilter, AdminCourseListData } from "@/lib/schemas/admin-course";

type AdminCoursePaginationProps = {
  filter: AdminCourseFilter;
  data: Pick<AdminCourseListData, "total" | "page" | "pageSize" | "totalPages" | "rows">;
};

const pageLinkClass =
  "inline-flex h-9 items-center gap-1 rounded-lg border border-slate-500 px-3 text-sm font-semibold text-slate-100 transition-colors outline-none hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]";
const disabledPageClass =
  "inline-flex h-9 items-center gap-1 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-500";

// Phân trang bằng liên kết thật: mỗi trang có URL riêng, mở lại hoặc chia sẻ đều đúng trang (AD3 AC3).
export function AdminCoursePagination({ filter, data }: AdminCoursePaginationProps) {
  const { total, page, pageSize, totalPages, rows } = data;
  const firstShown = (page - 1) * pageSize + 1;
  const lastShown = firstShown + rows.length - 1;
  const hrefFor = (target: number) => buildAdminCoursesHref({ status: filter.status, q: filter.q, page: target });

  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-[#0B1120] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-slate-300">
        Hiển thị <span className="font-semibold text-white">{firstShown}</span>–
        <span className="font-semibold text-white">{lastShown}</span> trong tổng số{" "}
        <span className="font-semibold text-white">{total}</span> khóa học
      </p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} rel="prev" className={pageLinkClass}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            Trước
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledPageClass}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            Trước
          </span>
        )}
        <span className="text-sm font-medium text-slate-200">
          Trang {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} rel="next" className={pageLinkClass}>
            Sau
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledPageClass}>
            Sau
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
