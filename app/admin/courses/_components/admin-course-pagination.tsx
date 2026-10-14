"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildAdminCoursesHref } from "@/lib/admin/routes";
import type { AdminCourseFilter, AdminCourseListData } from "@/lib/schemas/admin-course";

type AdminCoursePaginationProps = {
  filter: AdminCourseFilter;
  data: Pick<AdminCourseListData, "total" | "page" | "pageSize" | "totalPages" | "rows">;
};

const arrowClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-500 text-slate-100 transition-colors outline-none hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120]";
const disabledArrowClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-500";

// Phân trang gọn một khối `‹ [ 5 ] / 22 ›`: mũi tên là liên kết thật (mỗi trang có URL riêng, mở lại hoặc chia sẻ đều đúng trang, AD3 AC3),
// số trang hiện tại là ô nhập để nhảy tới trang bất kỳ.
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
      {totalPages > 1 ? (
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" aria-label="Trang trước" className={arrowClass}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <button type="button" disabled aria-label="Trang trước" className={disabledArrowClass}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
          )}
          {/* key theo trang hiện tại: URL đổi (liên kết, Back/Forward, chính ô này) thì ô nhập và thông báo lỗi được dựng lại theo URL. */}
          <PageInput key={`${page}:${totalPages}`} filter={filter} page={page} totalPages={totalPages} />
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} rel="next" aria-label="Trang sau" className={arrowClass}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <button type="button" disabled aria-label="Trang sau" className={disabledArrowClass}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">
          <span className="sr-only">Trang </span>1 / 1
        </p>
      )}
    </nav>
  );
}

// Chỉ nhận số nguyên từ 1 đến tổng số trang. Enter áp dụng; giá trị sai không điều hướng và báo lỗi ngay dưới nhóm (không chỉ bằng màu);
// rời ô (blur) hoặc Escape trả về trang hiện tại mà không điều hướng.
function PageInput({
  filter,
  page,
  totalPages,
}: {
  filter: AdminCourseFilter;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const baseId = useId();
  const totalId = `${baseId}-total`;
  const errorId = `${baseId}-error`;
  const [value, setValue] = useState(String(page));
  const [error, setError] = useState<string | null>(null);

  const revert = () => {
    setValue(String(page));
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = value.trim();
    const target = /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isInteger(target) || target < 1 || target > totalPages) {
      setError(`Nhập số nguyên từ 1 đến ${totalPages}.`);
      return;
    }
    setError(null);
    // Cùng cơ chế điều hướng với các liên kết trang; trang 1 bỏ `page` khỏi URL, `status` và `q` được giữ.
    router.push(buildAdminCoursesHref({ status: filter.status, q: filter.q, page: target }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      revert();
    }
  };

  return (
    <form noValidate onSubmit={submit} className="relative flex items-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onBlur={revert}
        onKeyDown={handleKeyDown}
        aria-label="Trang hiện tại, nhập số trang để chuyển"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${totalId} ${errorId}` : totalId}
        style={{ width: `${String(totalPages).length + 2}ch` }}
        className="h-9 rounded-lg border border-transparent bg-transparent px-1 text-center text-sm font-semibold text-white tabular-nums outline-none transition-colors hover:border-slate-500 focus-visible:border-route focus-visible:bg-[#111827] focus-visible:ring-2 focus-visible:ring-route aria-[invalid=true]:border-red-300"
      />
      <span aria-hidden="true" className="text-sm text-slate-300">
        / {totalPages}
      </span>
      <span id={totalId} className="sr-only">
        trên tổng số {totalPages} trang
      </span>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="absolute top-full left-1/2 z-10 mt-1 w-max max-w-[14rem] -translate-x-1/2 rounded-md border border-red-400/40 bg-[#111827] px-2 py-1 text-xs font-medium text-red-200"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
