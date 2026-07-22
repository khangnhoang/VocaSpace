import { ArrowLeft, ArrowRight } from "lucide-react";

interface CoursePaginationProps {
  currentPage: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
}

const pageButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-[10px] border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:size-9";

export default function CoursePagination({
  currentPage,
  itemLabel,
  onPageChange,
  pageSize,
  totalItems,
}: CoursePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  if (pageCount <= 1) return null;

  const safePage = Math.min(Math.max(1, currentPage), pageCount);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const visiblePages =
    safePage < pageCount
      ? [safePage, safePage + 1]
      : [Math.max(1, safePage - 1), safePage];

  return (
    <nav
      aria-label={`Phân trang ${itemLabel}`}
      className="flex min-h-11 min-w-0 items-center justify-between gap-3"
    >
      <p className="min-w-0 text-xs leading-5 text-slate-600 sm:text-[13px]">
        Hiển thị {start}–{end} / {totalItems} {itemLabel}
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          aria-label="Trang trước"
          disabled={safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
          className={`${pageButtonClass} border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400`}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </button>
        {visiblePages.map((page) => {
          const isSelected = page === safePage;
          return (
            <button
              key={page}
              type="button"
              aria-current={isSelected ? "page" : undefined}
              aria-label={`Trang ${page}`}
              onClick={() => onPageChange(page)}
              className={`${pageButtonClass} ${
                isSelected
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {page}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Trang sau"
          disabled={safePage === pageCount}
          onClick={() => onPageChange(safePage + 1)}
          className={`${pageButtonClass} border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-slate-100 disabled:text-slate-400`}
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </nav>
  );
}
