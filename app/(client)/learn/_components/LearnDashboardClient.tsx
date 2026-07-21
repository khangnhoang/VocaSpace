"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  BookAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type {
  LearnDashboardCourse,
  LearnDashboardResult,
  PendingPaymentSummary,
} from "@/lib/schemas/learn-dashboard";
import {
  addDismissedPaymentId,
  getVisiblePendingPayments,
} from "@/lib/learn-dashboard";
import CoursePagination from "./CoursePagination";
import CourseRow from "./CourseRow";
import {
  filterRemainingCourses,
  getCourseStatusCount,
  getInProgressCourses,
  getRemainingCourses,
  MOBILE_COURSES_PER_PAGE,
  paginateCourses,
  type RemainingCourseFilter,
  WIDE_COURSES_PER_PAGE,
} from "./learning-dashboard-state";
import { PendingPaymentPreview, PendingPaymentsPanel } from "./PendingPayments";
import ReviewSheet from "./ReviewSheet";

const DISMISSED_PAYMENT_STORAGE_KEY =
  "vocaspace:learn-dashboard:dismissed-payments";

function subscribeToMediaQuery(query: string, callback: () => void) {
  const mediaQuery = window.matchMedia(query);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => subscribeToMediaQuery(query, callback),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function DashboardError({ error }: { error: string }) {
  const router = useRouter();

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-lg rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto size-12 text-rose-600"
        />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-950">
          Chưa thể tải không gian học tập
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{error}</p>
        <Button
          type="button"
          onClick={() => router.refresh()}
          className="mt-6 min-h-11 bg-blue-600 px-5 text-white hover:bg-blue-700"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Thử lại
        </Button>
      </div>
    </div>
  );
}

function SectionHeading({
  count,
  description,
  id,
  title,
}: {
  count: number;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-2xl font-bold leading-8 text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-slate-600">
        <BookOpen aria-hidden="true" className="size-4" />
        {count} khóa học
      </span>
    </div>
  );
}

function EmptyCourseState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-white p-6 text-center">
      <BookOpen aria-hidden="true" className="size-10 text-blue-300" />
      <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-slate-700">
        {children}
      </p>
    </div>
  );
}

function ContinuingCoursesSection({
  courses,
  pageSize,
}: {
  courses: LearnDashboardCourse[];
  pageSize: number;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(courses.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const displayedCourses = paginateCourses(courses, safePage, pageSize);

  return (
    <section
      aria-labelledby="continuing-courses-title"
      className="min-w-0"
    >
      <SectionHeading
        id="continuing-courses-title"
        title="Học tiếp"
        description="Quay lại đúng bài tiếp theo trong hành trình của bạn."
        count={courses.length}
      />
      <div className="mt-5 space-y-4">
        {courses.length === 0 ? (
          <EmptyCourseState>
            Bạn chưa có khóa học đang học dở. Các khóa học khác vẫn được giữ
            đúng trạng thái bên dưới.
          </EmptyCourseState>
        ) : (
          displayedCourses.map((course) => (
            <CourseRow key={course.enrollmentId} course={course} />
          ))
        )}
      </div>
      <div className="mt-4">
        <CoursePagination
          currentPage={safePage}
          itemLabel="khóa học đang học"
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalItems={courses.length}
        />
      </div>
    </section>
  );
}

const remainingFilters: Array<{
  label: string;
  value: RemainingCourseFilter;
}> = [
  { label: "Tất cả", value: "all" },
  { label: "Chưa bắt đầu học", value: "not-started" },
  { label: "Đã hoàn thành", value: "completed" },
];

function RemainingCoursesSection({
  courses,
  pageSize,
}: {
  courses: LearnDashboardCourse[];
  pageSize: number;
}) {
  const [activeFilter, setActiveFilter] =
    useState<RemainingCourseFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const filteredCourses = useMemo(
    () => filterRemainingCourses(courses, activeFilter),
    [activeFilter, courses],
  );
  const pageCount = Math.max(1, Math.ceil(filteredCourses.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const displayedCourses = paginateCourses(filteredCourses, safePage, pageSize);

  return (
    <section
      aria-labelledby="remaining-courses-title"
      className="min-w-0"
    >
      <SectionHeading
        id="remaining-courses-title"
        title="Các khóa học còn lại"
        description="Các khóa học bạn đã đăng ký nhưng chưa bắt đầu, đã hoàn thành hoặc chưa có nội dung."
        count={courses.length}
      />
      <div
        role="group"
        aria-label="Lọc các khóa học còn lại"
        className="mt-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible"
      >
        {remainingFilters.map((filter) => {
          const count =
            filter.value === "all"
              ? courses.length
              : getCourseStatusCount(courses, filter.value);
          const isActive = activeFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setActiveFilter(filter.value);
                setCurrentPage(1);
              }}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isActive
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
              }`}
            >
              {filter.label} · {count}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-4">
        {filteredCourses.length === 0 ? (
          <EmptyCourseState>
            Không có khóa học nào ở trạng thái này.
          </EmptyCourseState>
        ) : (
          displayedCourses.map((course) => (
            <CourseRow key={course.enrollmentId} course={course} />
          ))
        )}
      </div>
      <div className="mt-4 min-h-11">
        <CoursePagination
          currentPage={safePage}
          itemLabel="khóa học"
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalItems={filteredCourses.length}
        />
      </div>
    </section>
  );
}

function ReviewCard({
  dueCardCount,
  onOpen,
}: {
  dueCardCount: number;
  onOpen: () => void;
}) {
  if (dueCardCount === 0) {
    return (
      <section
        aria-labelledby="review-summary-title"
        className="rounded-[20px] border border-blue-100 bg-blue-50 p-5"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-blue-600"
          />
          <div>
            <h2 id="review-summary-title" className="font-bold text-slate-950">
              Đã hoàn thành ôn tập hôm nay
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Không có thẻ nào đang đến hạn.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="review-summary-title"
      className="rounded-3xl border border-blue-200 bg-blue-50 p-6 lg:p-7"
    >
      <div className="flex items-center gap-2 text-blue-900">
        <BookAlert aria-hidden="true" className="size-4 text-blue-600" />
        <p className="text-[10px] font-extrabold tracking-[0.13em]">
          ÔN TẬP HÔM NAY
        </p>
      </div>
      <h2
        id="review-summary-title"
        className="mt-3 text-xl font-bold text-slate-950"
      >
        Ôn tập hôm nay
      </h2>
      <div className="mt-2 flex items-end gap-2">
        <strong className="text-5xl font-extrabold tracking-tight text-blue-700">
          {dueCardCount}
        </strong>
        <span className="pb-1.5 text-xs font-bold text-blue-900">
          thẻ đến hạn
        </span>
      </div>
      <Button
        type="button"
        onClick={onOpen}
        className="mt-4 min-h-11 w-full bg-blue-600 font-bold text-white shadow-none hover:bg-blue-700 focus-visible:ring-blue-500"
      >
        Ôn ngay
        <span aria-hidden="true">→</span>
      </Button>
    </section>
  );
}

function MemoryRhythmCard({
  learningCardCount,
  totalCardCount,
}: {
  learningCardCount: number;
  totalCardCount: number;
}) {
  return (
    <section
      aria-labelledby="memory-rhythm-title"
      className="rounded-[20px] border border-blue-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] lg:p-6"
    >
      <p className="text-[11px] font-extrabold tracking-[0.08em] text-blue-900">
        NHỊP GHI NHỚ
      </p>
      <h2
        id="memory-rhythm-title"
        className="mt-2 text-base font-bold text-slate-950"
      >
        {learningCardCount} thẻ đang học · {totalCardCount} thẻ tổng cộng
      </h2>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        Số liệu thật, không quy đổi thành phần trăm tiến độ.
      </p>
    </section>
  );
}

function DashboardAside({
  className = "",
  dueCardCount,
  isDesktop,
  isPaymentsOpen,
  learningCardCount,
  onDismissPayment,
  onOpenPaymentsChange,
  onOpenReview,
  payments,
  totalCardCount,
}: {
  className?: string;
  dueCardCount: number;
  isDesktop: boolean;
  isPaymentsOpen: boolean;
  learningCardCount: number;
  onDismissPayment: (paymentId: string) => void;
  onOpenPaymentsChange: (open: boolean) => void;
  onOpenReview: () => void;
  payments: PendingPaymentSummary[];
  totalCardCount: number;
}) {
  return (
    <aside className={`min-w-0 space-y-5 ${className}`}>
      <ReviewCard dueCardCount={dueCardCount} onOpen={onOpenReview} />
      <MemoryRhythmCard
        learningCardCount={learningCardCount}
        totalCardCount={totalCardCount}
      />
      <Sheet open={isPaymentsOpen} onOpenChange={onOpenPaymentsChange}>
        <PendingPaymentPreview
          isDesktop={isDesktop}
          payments={payments}
          onDismiss={onDismissPayment}
        />
        <PendingPaymentsPanel
          onDismiss={onDismissPayment}
          payments={payments}
        />
      </Sheet>
    </aside>
  );
}

export default function LearnDashboardClient({
  result,
}: {
  result: LearnDashboardResult;
}) {
  const router = useRouter();
  const isAtLeastTablet = useMediaQuery("(min-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [dismissedPaymentIds, setDismissedPaymentIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const storedValue = sessionStorage.getItem(DISMISSED_PAYMENT_STORAGE_KEY);
      const parsedValue: unknown = storedValue ? JSON.parse(storedValue) : [];
      if (
        Array.isArray(parsedValue) &&
        parsedValue.every((value) => typeof value === "string")
      ) {
        queueMicrotask(() => setDismissedPaymentIds(parsedValue));
      }
    } catch {
      // Dashboard vẫn hoạt động trong session React nếu trình duyệt chặn storage.
    }
  }, []);

  const visiblePayments = useMemo(() => {
    if (!result.success) return [];
    return getVisiblePendingPayments(
      result.data.pendingPayments,
      dismissedPaymentIds,
    );
  }, [dismissedPaymentIds, result]);

  const handleDismissPayment = useCallback(
    (paymentId: string) => {
      setDismissedPaymentIds((current) => {
        const next = addDismissedPaymentId(current, paymentId);
        if (next === current) return current;

        try {
          sessionStorage.setItem(
            DISMISSED_PAYMENT_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch {
          // State vẫn được cập nhật trong session React hiện tại nếu storage bị chặn.
        }
        return next;
      });

      if (
        visiblePayments.length === 1 &&
        visiblePayments[0]?.paymentId === paymentId
      ) {
        setIsPaymentsOpen(false);
      }
    },
    [visiblePayments],
  );

  const handleReviewComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  if (!result.success) {
    return <DashboardError error={result.error} />;
  }

  const { courses, reviewSummary } = result.data;
  const inProgressCourses = getInProgressCourses(courses);
  const remainingCourses = getRemainingCourses(courses);
  const pageSize = isAtLeastTablet
    ? WIDE_COURSES_PER_PAGE
    : MOBILE_COURSES_PER_PAGE;
  const continuingCoursesSection = (
    <ContinuingCoursesSection
      courses={inProgressCourses}
      pageSize={pageSize}
    />
  );
  const remainingCoursesSection = (
    <RemainingCoursesSection courses={remainingCourses} pageSize={pageSize} />
  );
  const dashboardAside = (
    <DashboardAside
      className={isDesktop ? "col-span-4" : undefined}
      dueCardCount={reviewSummary.dueCardCount}
      isDesktop={isDesktop}
      isPaymentsOpen={isPaymentsOpen}
      learningCardCount={reviewSummary.learningCardCount}
      onDismissPayment={handleDismissPayment}
      onOpenPaymentsChange={setIsPaymentsOpen}
      onOpenReview={() => setIsReviewOpen(true)}
      payments={visiblePayments}
      totalCardCount={reviewSummary.totalCardCount}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8 md:py-10 lg:py-12">
      <div className="mx-auto max-w-315">
        <header className="max-w-3xl">
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-blue-700">
            KHÔNG GIAN HỌC TẬP
          </p>
          <h1 className="mt-3 text-[30px] font-extrabold leading-10 tracking-tight text-slate-950 sm:text-[38px] sm:leading-12">
            Hôm nay bạn muốn học gì tiếp?
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-[15px]">
            Tiếp tục đúng bài còn thiếu, giữ nhịp ôn tập và nhìn rõ toàn bộ hành
            trình học tập của bạn.
          </p>
        </header>

        {isDesktop ? (
          <div className="mt-8 grid min-w-0 grid-cols-12 items-start gap-x-8">
            <div className="col-span-8 min-w-0 space-y-10">
              {continuingCoursesSection}
              {remainingCoursesSection}
            </div>
            {dashboardAside}
          </div>
        ) : (
          <div className="mt-8 grid min-w-0 grid-cols-1 items-start gap-y-10">
            {continuingCoursesSection}
            {dashboardAside}
            {remainingCoursesSection}
          </div>
        )}
      </div>

      <ReviewSheet
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onReviewComplete={handleReviewComplete}
      />
    </div>
  );
}
