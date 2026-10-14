"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Inbox, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildAdminCoursesHref } from "@/lib/admin/routes";
import type {
  AdminCourseFilter,
  AdminCourseListData,
  AdminCourseListRow,
  AdminCourseStatusFilter,
} from "@/lib/schemas/admin-course";
import type { CourseActionKind } from "./admin-course-format";
import { AdminCoursePagination } from "./admin-course-pagination";
import { AdminCourseTable } from "./admin-course-table";
import { AdminCourseToolbar, sortCaptions, tabLabels } from "./admin-course-toolbar";
import { CourseActionDialog } from "./course-action-dialog";
import { CourseSummarySheet } from "./course-summary-sheet";

type AdminCoursesClientProps = {
  filter: AdminCourseFilter;
  // data và error loại trừ nhau: server render trả đúng một trong hai.
  data: AdminCourseListData | null;
  error: string | null;
};

type ActiveAction = { kind: CourseActionKind; course: AdminCourseListRow };

const emptyMessages: Record<AdminCourseStatusFilter, string> = {
  pending: "Không có khóa học nào đang chờ duyệt.",
  published: "Chưa có khóa học nào được xuất bản.",
  draft: "Không có khóa học nào ở bản nháp.",
  all: "Chưa có khóa học nào.",
  removed: "Chưa có khóa học nào bị gỡ.",
};

const outlineLinkClass =
  "border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white";

export default function AdminCoursesClient({ filter, data, error }: AdminCoursesClientProps) {
  const router = useRouter();
  const [summaryCourse, setSummaryCourse] = useState<AdminCourseListRow | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  // Phần tử đã mở panel/dialog: dialog và panel mở từ state (không có Radix Trigger) nên focus được trả về đây khi đóng (AD3 AC9).
  const summaryOpenerRef = useRef<HTMLElement | null>(null);
  const actionOpenerRef = useRef<HTMLElement | null>(null);
  // Sau khi server xác nhận, dòng vừa xử lý có thể rời tab nên focus về tiêu đề danh sách thay vì nút đã mở.
  const returnToHeadingRef = useRef(false);

  // Nút vừa được bấm (bắt ở pha capture, kể cả nút trong dialog/panel qua portal): Safari và Firefox trên macOS không focus nút khi bấm
  // nên document.activeElement không đáng tin để biết "nút đã mở".
  const lastClickedButtonRef = useRef<HTMLElement | null>(null);

  const rememberOpener = (ref: { current: HTMLElement | null }) => {
    ref.current =
      lastClickedButtonRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    returnToHeadingRef.current = false;
  };

  const openSummary = (course: AdminCourseListRow) => {
    rememberOpener(summaryOpenerRef);
    setSummaryCourse(course);
  };

  const startAction = (kind: CourseActionKind, course: AdminCourseListRow) => {
    rememberOpener(actionOpenerRef);
    setActiveAction({ kind, course });
  };

  // Chặn Radix trả focus mặc định (về <body> vì không có Trigger) và tự đặt: nút đã mở nếu còn trong DOM, nếu không thì tiêu đề danh sách.
  const restoreFocus = (event: Event, opener: { current: HTMLElement | null }) => {
    event.preventDefault();
    const target = !returnToHeadingRef.current && opener.current?.isConnected ? opener.current : resultsHeadingRef.current;
    target?.focus();
  };

  // Server đã xác nhận: đóng dialog và panel rồi làm mới danh sách; focus về tiêu đề danh sách qua restoreFocus.
  const finishAction = () => {
    returnToHeadingRef.current = true;
    setActiveAction(null);
    setSummaryCourse(null);
    router.refresh();
  };

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-5"
      onClickCapture={(event) => {
        lastClickedButtonRef.current = event.target instanceof Element ? event.target.closest("button") : null;
      }}
    >
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Quản lý khóa học</h1>
        <p className="text-sm text-slate-300">
          Duyệt khóa học giáo viên gửi lên, hạ hoặc gỡ khóa học đã xuất bản.
        </p>
      </header>

      <AdminCourseToolbar filter={filter} counts={data?.counts ?? null} />

      <section aria-labelledby="admin-course-results" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2
            id="admin-course-results"
            ref={resultsHeadingRef}
            tabIndex={-1}
            className="text-base font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {tabLabels[filter.status]}
            {filter.q ? <span className="font-normal text-slate-300"> · tìm “{filter.q}”</span> : null}
          </h2>
          <p className="text-xs text-slate-400">{sortCaptions[filter.status]}</p>
        </div>

        {error || !data ? (
          <ListError message={error} onRetry={() => router.refresh()} />
        ) : data.rows.length === 0 ? (
          <EmptyState filter={filter} data={data} />
        ) : (
          <>
            <AdminCourseTable courses={data.rows} onOpenSummary={openSummary} onAction={startAction} />
            <AdminCoursePagination filter={filter} data={data} />
          </>
        )}
      </section>

      <CourseSummarySheet
        course={summaryCourse}
        onClose={() => setSummaryCourse(null)}
        onCloseAutoFocus={(event) => restoreFocus(event, summaryOpenerRef)}
        onAction={startAction}
      />

      {activeAction ? (
        <CourseActionDialog
          key={`${activeAction.kind}:${activeAction.course.id}`}
          kind={activeAction.kind}
          course={activeAction.course}
          onClose={() => setActiveAction(null)}
          onCloseAutoFocus={(event) => restoreFocus(event, actionOpenerRef)}
          onDone={finishAction}
        />
      ) : null}
    </div>
  );
}

function StatePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-[#111827] px-6 py-16 text-center shadow-sm">
      {children}
    </div>
  );
}

function ListError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <StatePanel>
      <div role="alert" className="flex flex-col items-center">
        <TriangleAlert className="mb-3 size-8 text-red-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-100">Không thể tải danh sách khóa học.</p>
        <p className="mt-2 max-w-md text-sm text-slate-300">{message ?? "Vui lòng thử lại."}</p>
      </div>
      <Button type="button" variant="outline" onClick={onRetry} className={`mt-5 ${outlineLinkClass}`}>
        Thử lại
      </Button>
    </StatePanel>
  );
}

function EmptyState({ filter, data }: { filter: AdminCourseFilter; data: AdminCourseListData }) {
  // Có khóa học trong tab nhưng trang này quá cuối (URL cũ sau khi danh sách ngắn lại): đưa về trang 1.
  const beyondLastPage = data.total > 0;

  return (
    <StatePanel>
      <Inbox className="mb-3 size-8 text-slate-400" aria-hidden="true" />
      {beyondLastPage ? (
        <>
          <p className="text-sm font-semibold text-slate-100">Trang này không có khóa học nào.</p>
          <p className="mt-2 max-w-md text-sm text-slate-300">
            Danh sách chỉ còn {data.totalPages} trang.
          </p>
          <Button asChild variant="outline" className={`mt-5 ${outlineLinkClass}`}>
            <Link href={buildAdminCoursesHref({ status: filter.status, q: filter.q })}>Về trang 1</Link>
          </Button>
        </>
      ) : filter.q ? (
        <>
          <p className="text-sm font-semibold text-slate-100">Không tìm thấy khóa học phù hợp.</p>
          <p className="mt-2 max-w-md text-sm break-words text-slate-300">
            Không có khóa học nào trong “{tabLabels[filter.status]}” khớp với “{filter.q}”.
          </p>
          <Button asChild variant="outline" className={`mt-5 ${outlineLinkClass}`}>
            <Link href={buildAdminCoursesHref({ status: filter.status })}>Xóa tìm kiếm</Link>
          </Button>
        </>
      ) : (
        <p className="text-sm font-semibold text-slate-100">{emptyMessages[filter.status]}</p>
      )}
    </StatePanel>
  );
}
