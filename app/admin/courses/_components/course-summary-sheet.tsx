"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { getAdminCourseSummary } from "@/app/actions/admin-course-moderation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AdminCourseListRow, AdminCourseSummary } from "@/lib/schemas/admin-course";
import {
  CourseStatusBadge,
  EMPTY_VALUE,
  formatDateTime,
  formatPrice,
  topicStatusLabel,
  type CourseActionKind,
} from "./admin-course-format";
import { CourseActionButtons } from "./course-action-buttons";

const LOAD_ERROR = "Không thể tải tóm tắt khóa học. Vui lòng thử lại.";

type SummaryResult = { data: AdminCourseSummary } | { error: string };

type CourseSummarySheetProps = {
  // null = đóng. Hàng của danh sách đã có đủ metadata nên phần đầu panel hiện ngay, chỉ dàn bài là tải từ server.
  course: AdminCourseListRow | null;
  onClose: () => void;
  onAction: (kind: CourseActionKind, course: AdminCourseListRow) => void;
};

export function CourseSummarySheet({ course, onClose, onAction }: CourseSummarySheetProps) {
  // Chỉ mount khi có khóa học: SheetContent luôn có SheetTitle (tên khóa học) và state tải dàn bài reset theo từng khóa học.
  if (!course) return null;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="dark w-full gap-0 border-slate-700 bg-[#111827] p-0 text-slate-200 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SummaryBody key={course.id} course={course} onAction={onAction} />
      </SheetContent>
    </Sheet>
  );
}

function SummaryBody({
  course,
  onAction,
}: {
  course: AdminCourseListRow;
  onAction: CourseSummarySheetProps["onAction"];
}) {
  const [attempt, setAttempt] = useState(0);
  // Kết quả gắn với khóa của lần yêu cầu: bấm "Thử lại" hay đổi khóa học thì kết quả cũ tự thành "đang tải",
  // và phản hồi muộn của yêu cầu đã bị hủy không ghi đè kết quả mới.
  const requestKey = `${course.id}:${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; result: SummaryResult } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminCourseSummary({ courseId: course.id })
      .then((response) => {
        if (cancelled) return;
        setLoaded({
          key: requestKey,
          result: "error" in response ? { error: response.error } : { data: response.data },
        });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: requestKey, result: { error: LOAD_ERROR } });
      });
    return () => {
      cancelled = true;
    };
  }, [course.id, requestKey]);

  const result = loaded?.key === requestKey ? loaded.result : null;
  const summary = result && "data" in result ? result.data : null;
  // Dữ liệu từ lần tải này (mới hơn hàng của danh sách) được ưu tiên khi đã có.
  const header = summary?.course ?? course;
  const thumbnailUrl = summary?.course.thumbnailUrl ?? null;

  return (
    <>
      <SheetHeader className="gap-1 border-b border-slate-800 p-5 pr-14">
        <SheetTitle className="text-xl leading-snug font-bold break-words text-white">{header.title}</SheetTitle>
        <SheetDescription className="break-all text-slate-400">{header.slug}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-700 bg-[#0B1120]">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={`Ảnh bìa khóa học ${header.title}`}
              fill
              sizes="(max-width: 640px) 100vw, 576px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-slate-400">
              <ImageOff className="size-6" aria-hidden="true" />
              {summary ? "Chưa có ảnh bìa" : "Ảnh bìa"}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Fact label="Trạng thái">
            <CourseStatusBadge course={header} />
          </Fact>
          <Fact label="Chủ sở hữu">{header.ownerName ?? EMPTY_VALUE}</Fact>
          <Fact label="Giá">{formatPrice(header.price)}</Fact>
          <Fact label="Gửi duyệt">{formatDateTime(header.submittedAt)}</Fact>
          <Fact label="Xử lý duyệt">{formatDateTime(header.reviewedAt)}</Fact>
          {header.removedAt ? <Fact label="Đã gỡ">{formatDateTime(header.removedAt)}</Fact> : null}
        </dl>

        {header.rejectMessage ? (
          <p
            role="note"
            className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm leading-6 break-words text-red-100"
          >
            <span className="font-bold">Lý do từ chối: </span>
            {header.rejectMessage}
          </p>
        ) : null}

        <section aria-labelledby="course-summary-description" className="space-y-1.5">
          <h3 id="course-summary-description" className="text-sm font-bold text-white">
            Mô tả
          </h3>
          {summary ? (
            <p className="text-sm leading-6 break-words whitespace-pre-line text-slate-300">
              {summary.course.description?.trim() || EMPTY_VALUE}
            </p>
          ) : (
            <p className="text-sm text-slate-400">{result ? EMPTY_VALUE : "Đang tải..."}</p>
          )}
        </section>

        <section aria-labelledby="course-summary-outline" className="space-y-2">
          <h3 id="course-summary-outline" className="text-sm font-bold text-white">
            Chương và bài học
          </h3>
          {result === null ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-300">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Đang tải dàn bài...
            </p>
          ) : "error" in result ? (
            <div role="alert" className="space-y-3 rounded-lg border border-red-400/40 bg-red-500/10 p-3">
              <p className="text-sm text-red-100">{result.error}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Thử lại
              </Button>
            </div>
          ) : (
            <Outline summary={result.data} />
          )}
        </section>
      </div>

      <div className="border-t border-slate-800 bg-[#0B1120] p-4">
        <CourseActionButtons course={header} onAction={onAction} />
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-semibold text-slate-400">{label}</dt>
      <dd className="text-slate-100">{children}</dd>
    </div>
  );
}

function Outline({ summary }: { summary: AdminCourseSummary }) {
  const topicCount = summary.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0);

  if (summary.chapters.length === 0) {
    return <p className="text-sm text-slate-300">Khóa học chưa có chương nào.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        <span className="font-semibold text-white">{summary.publishedTopicCount}</span> / {topicCount} bài học đã xuất
        bản
      </p>
      <ol className="space-y-3">
        {summary.chapters.map((chapter, chapterIndex) => (
          <li key={chapter.id} className="rounded-xl border border-slate-700 bg-[#0B1120] p-3">
            <p className="text-sm font-semibold break-words text-white">
              Chương {chapterIndex + 1}: {chapter.title}
            </p>
            {chapter.topics.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">Chưa có bài học.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-800">
                {chapter.topics.map((topic) => (
                  <li key={topic.id} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                    <span className="min-w-0 break-words text-slate-200">{topic.title}</span>
                    <span
                      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${
                        topic.status === "published"
                          ? "border-sky-400/40 text-sky-300"
                          : topic.status === "pending"
                            ? "border-orange-400/40 text-orange-300"
                            : "border-slate-500/60 text-slate-300"
                      }`}
                    >
                      {topicStatusLabel(topic.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
