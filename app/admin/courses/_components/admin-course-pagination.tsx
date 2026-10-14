"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Phân trang bằng liên kết thật (kèm ô nhập số trang để nhảy tới trang bất kỳ): mỗi trang có URL riêng, mở lại hoặc chia sẻ đều đúng trang (AD3 AC3).
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-5">
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
        {totalPages > 1 ? (
          // key theo trang hiện tại: URL đổi (liên kết, Back/Forward, chính ô này) thì ô nhập và thông báo lỗi được dựng lại theo URL.
          <JumpToPage key={`${page}:${totalPages}`} filter={filter} page={page} totalPages={totalPages} />
        ) : null}
      </div>
    </nav>
  );
}

// Chỉ nhận số nguyên từ 1 đến tổng số trang; giá trị khác không điều hướng và báo lỗi ngay dưới ô nhập (không chỉ bằng màu).
function JumpToPage({
  filter,
  page,
  totalPages,
}: {
  filter: AdminCourseFilter;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(String(page));
  const [error, setError] = useState<string | null>(null);
  const errorId = `${inputId}-error`;

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

  return (
    <form noValidate onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-200">
        Đến trang
      </label>
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={1}
        max={totalPages}
        step={1}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-9 w-20 border-slate-500 bg-[#0B1120] text-sm text-slate-100 focus-visible:border-route focus-visible:ring-route/50"
      />
      <span className="text-sm text-slate-300" aria-hidden="true">
        / {totalPages}
      </span>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="h-9 border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white"
      >
        Đi
      </Button>
      {error ? (
        <p id={errorId} role="alert" className="basis-full text-sm font-medium text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
