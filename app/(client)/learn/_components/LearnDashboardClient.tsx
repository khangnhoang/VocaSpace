"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Layers3,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  LearnDashboardCourse,
  LearnDashboardResult,
  PendingPaymentSummary,
} from "@/lib/schemas/learn-dashboard";
import {
  addDismissedPaymentId,
  getVisiblePendingPayments,
} from "@/lib/learn-dashboard";
import ReviewSheet from "./ReviewSheet";

const DISMISSED_PAYMENT_STORAGE_KEY =
  "vocaspace:learn-dashboard:dismissed-payments";

function formatPaymentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function CourseCard({ course }: { course: LearnDashboardCourse }) {
  const isCompleted = course.status === "completed";
  const hasContent = course.status !== "no-content";
  const destinationTopic = isCompleted ? course.lastTopic : course.nextTopic;
  const destination = destinationTopic
    ? `/learn/${course.courseSlug}/${destinationTopic.slug}`
    : null;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/8] bg-slate-100">
        {course.courseThumbnailUrl ? (
          <Image
            src={course.courseThumbnailUrl}
            alt={`Ảnh bìa khóa học ${course.courseTitle}`}
            fill
            sizes="(max-width: 767px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={`Chưa có ảnh bìa cho khóa học ${course.courseTitle}`}
            className="flex h-full items-center justify-center bg-emerald-50 text-emerald-500"
          >
            <BookOpen aria-hidden="true" className="size-14" />
          </div>
        )}
        {isCompleted && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            Đã hoàn thành
          </span>
        )}
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <h3 className="line-clamp-2 text-xl font-extrabold text-slate-900">
            {course.courseTitle}
          </h3>
          {hasContent ? (
            <p className="mt-2 text-sm text-slate-500">
              {course.completedTopicCount}/{course.totalTopicCount} bài học đã
              hoàn thành
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-amber-700">
              Khóa học hiện chưa có nội dung học khả dụng.
            </p>
          )}
        </div>

        {hasContent && course.progressPercentage !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Tiến độ khóa học</span>
              <span>{course.progressPercentage}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={`Tiến độ khóa học ${course.courseTitle}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={course.progressPercentage}
              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${course.progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {destinationTopic && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
              {isCompleted ? "Bài học cuối" : "Học tiếp theo"}
            </p>
            <p className="mt-1 font-bold text-slate-800">
              {destinationTopic.title}
            </p>
            {destinationTopic.chapterTitle && (
              <p className="mt-1 text-xs text-slate-500">
                {destinationTopic.chapterTitle}
              </p>
            )}
          </div>
        )}

        {destination && (
          <Button
            asChild
            variant={isCompleted ? "outline" : "default"}
            className={
              isCompleted
                ? "min-h-11 w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                : "min-h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            <Link href={destination}>
              {isCompleted ? "Xem lại bài học cuối" : "Tiếp tục học"}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

function PaymentReminder({
  payment,
  onDismiss,
}: {
  payment: PendingPaymentSummary;
  onDismiss: (paymentId: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-start gap-3">
        <Clock3
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-amber-700"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">
            {payment.courseTitle}
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-800">
            {payment.status === "creating"
              ? "Đang khởi tạo thanh toán"
              : "Đang chờ thanh toán"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tạo lúc {formatPaymentDate(payment.createdAt)}
          </p>
          {payment.expiresAt && (
            <p className="mt-1 text-xs text-slate-500">
              Hết hạn {formatPaymentDate(payment.expiresAt)}
            </p>
          )}
          <Link
            href={`/courses/${payment.courseSlug}`}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-amber-900 underline-offset-4 hover:underline"
          >
            Tiếp tục thanh toán
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <button
          type="button"
          aria-label={`Ẩn nhắc thanh toán cho ${payment.courseTitle}`}
          onClick={() => onDismiss(payment.paymentId)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  );
}

export default function LearnDashboardClient({
  result,
}: {
  result: LearnDashboardResult;
}) {
  const router = useRouter();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [dismissedPaymentIds, setDismissedPaymentIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const storedValue = sessionStorage.getItem(
        DISMISSED_PAYMENT_STORAGE_KEY,
      );
      const parsedValue: unknown = storedValue ? JSON.parse(storedValue) : [];
      if (
        Array.isArray(parsedValue) &&
        parsedValue.every((value) => typeof value === "string")
      ) {
        queueMicrotask(() => setDismissedPaymentIds(parsedValue));
      }
    } catch {
      sessionStorage.removeItem(DISMISSED_PAYMENT_STORAGE_KEY);
    }
  }, []);

  const handleReviewClose = useCallback(() => {
    setIsReviewOpen(false);
  }, []);

  const handleReviewComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  const visiblePayments = useMemo(() => {
    if (!result.success) return [];
    return getVisiblePendingPayments(
      result.data.pendingPayments,
      dismissedPaymentIds,
    );
  }, [dismissedPaymentIds, result]);

  const handleDismissPayment = useCallback((paymentId: string) => {
    setDismissedPaymentIds((current) => {
      const next = addDismissedPaymentId(current, paymentId);
      if (next === current) return current;
      sessionStorage.setItem(
        DISMISSED_PAYMENT_STORAGE_KEY,
        JSON.stringify(next),
      );
      return next;
    });
  }, []);

  if (!result.success) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-12">
        <div className="max-w-lg rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
          <AlertTriangle
            aria-hidden="true"
            className="mx-auto size-12 text-rose-500"
          />
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
            Chưa thể tải dashboard học tập
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {result.error}
          </p>
          <Button
            type="button"
            onClick={() => router.refresh()}
            className="mt-6 min-h-11 bg-slate-900 text-white hover:bg-slate-800"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Thử lại
          </Button>
        </div>
      </main>
    );
  }

  const { courses, reviewSummary } = result.data;
  const displayedPayments = showAllPayments
    ? visiblePayments
    : visiblePayments.slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-3xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-700">
            Không gian học tập
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Hôm nay bạn muốn học gì tiếp?
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Tiếp tục đúng bài còn thiếu, theo dõi tiến độ và giữ nhịp ôn tập
            mỗi ngày.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <section
            aria-labelledby="review-summary-title"
            className="rounded-3xl border border-emerald-200 bg-emerald-950 p-6 text-white shadow-sm lg:col-span-2"
          >
            <div className="flex items-center gap-2 text-emerald-200">
              <Sparkles aria-hidden="true" className="size-5" />
              <h2
                id="review-summary-title"
                className="text-sm font-extrabold uppercase tracking-[0.15em]"
              >
                Nhịp ôn tập hôm nay
              </h2>
            </div>
            <div className="mt-7 flex items-end gap-3">
              <strong className="text-6xl font-black tracking-tight">
                {reviewSummary.dueCardCount}
              </strong>
              <span className="pb-2 text-sm font-semibold text-emerald-200">
                thẻ đến hạn
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-3">
                <span className="block text-xs text-emerald-200">
                  Tổng số thẻ
                </span>
                <strong className="mt-1 block text-xl">
                  {reviewSummary.totalCardCount}
                </strong>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <span className="block text-xs text-emerald-200">
                  Đang học
                </span>
                <strong className="mt-1 block text-xl">
                  {reviewSummary.learningCardCount}
                </strong>
              </div>
            </div>
            <Button
              type="button"
              disabled={reviewSummary.dueCardCount === 0}
              onClick={() => setIsReviewOpen(true)}
              className="mt-6 min-h-11 w-full bg-white font-bold text-emerald-950 hover:bg-emerald-50 disabled:bg-white/20 disabled:text-emerald-200"
            >
              {reviewSummary.dueCardCount > 0
                ? "Ôn tập ngay"
                : "Chưa có thẻ đến hạn"}
            </Button>
          </section>

          <section
            aria-labelledby="pending-payments-title"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <AlertCircle
                    aria-hidden="true"
                    className="size-5 text-amber-600"
                  />
                  <h2
                    id="pending-payments-title"
                    className="text-lg font-extrabold text-slate-900"
                  >
                    Thanh toán đang chờ
                  </h2>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Tiếp tục từ trang khóa học để hoàn tất đăng ký an toàn.
                </p>
              </div>
              {visiblePayments.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                  {visiblePayments.length}
                </span>
              )}
            </div>

            {visiblePayments.length === 0 ? (
              <div className="mt-6 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <CheckCircle2
                  aria-hidden="true"
                  className="size-8 text-emerald-500"
                />
                <p className="mt-3 text-sm font-bold text-slate-700">
                  Không có thanh toán nào cần nhắc
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {displayedPayments.map((payment) => (
                  <PaymentReminder
                    key={payment.paymentId}
                    payment={payment}
                    onDismiss={handleDismissPayment}
                  />
                ))}
                {visiblePayments.length > 3 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAllPayments((current) => !current)}
                    className="min-h-11 w-full text-slate-700"
                  >
                    {showAllPayments
                      ? "Thu gọn"
                      : `Xem tất cả thanh toán đang chờ (${visiblePayments.length})`}
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>

        <section aria-labelledby="course-list-title" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
                Lộ trình của bạn
              </p>
              <h2
                id="course-list-title"
                className="mt-2 text-2xl font-black text-slate-950"
              >
                Khóa học đang tham gia
              </h2>
            </div>
            {courses.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500">
                <Layers3 aria-hidden="true" className="size-4" />
                {courses.length} khóa học
              </span>
            )}
          </div>

          {courses.length === 0 ? (
            <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <BookOpen aria-hidden="true" className="size-12 text-slate-300" />
              <h3 className="mt-4 text-xl font-extrabold text-slate-900">
                Bạn chưa có khóa học để tiếp tục
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Khám phá các khóa học đã xuất bản và chọn lộ trình phù hợp với
                mục tiêu của bạn.
              </p>
              <Button
                asChild
                className="mt-6 min-h-11 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Link href="/courses">
                  Khám phá khóa học
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {courses.map((course) => (
                <CourseCard key={course.enrollmentId} course={course} />
              ))}
            </div>
          )}
        </section>
      </div>

      <ReviewSheet
        isOpen={isReviewOpen}
        onClose={handleReviewClose}
        onReviewComplete={handleReviewComplete}
      />
    </main>
  );
}
