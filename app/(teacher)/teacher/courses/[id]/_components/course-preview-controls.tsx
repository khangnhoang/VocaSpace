"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCoursePreviewAllocation,
  setCourseTopicPreviewMarkers,
} from "@/app/actions/course-preview";
import type { CoursePreviewAllocation } from "@/lib/schemas/course-preview";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";

export type PreviewMarkerChange = {
  markTopicIds?: string[];
  unmarkTopicIds?: string[];
};

export function useCoursePreviewAllocation(courseId: string, enabled: boolean) {
  const [allocation, setAllocation] = useState<CoursePreviewAllocation | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getCoursePreviewAllocation(courseId);
      if (currentRequest !== requestId.current) return;
      if ("error" in result) {
        setError(result.error ?? "Không thể tải phân bổ bài học xem thử.");
        return;
      }
      if (result.data) setAllocation(result.data);
    } catch {
      if (currentRequest === requestId.current) {
        setError("Không thể tải phân bổ bài học xem thử. Vui lòng thử lại.");
      }
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [courseId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setAllocation(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    void refresh();
    return () => {
      requestId.current += 1;
    };
  }, [enabled, refresh]);

  const changeMarkers = useCallback(async (change: PreviewMarkerChange) => {
    if (!enabled || isUpdating) return { error: "Thao tác đang được xử lý." };
    setIsUpdating(true);
    setError(null);
    try {
      const result = await setCourseTopicPreviewMarkers({ courseId, ...change });
      if (result.allocation) setAllocation(result.allocation);
      if ("success" in result && result.success) {
        setAllocation(result.allocation);
        return result;
      }
      if (!result.allocation) await refresh();
      setError(result.error ?? "Không thể cập nhật bài học xem thử. Vui lòng thử lại.");
      return result;
    } catch {
      const message = "Không thể cập nhật bài học xem thử. Vui lòng thử lại.";
      await refresh();
      setError(message);
      return { error: message };
    } finally {
      setIsUpdating(false);
    }
  }, [courseId, enabled, isUpdating, refresh]);

  return { allocation, isLoading, isUpdating, error, refresh, changeMarkers };
}

export function PreviewSuspensionNotice({
  allocation,
  canManage,
  onAction,
  actionHref,
}: {
  allocation: CoursePreviewAllocation | null;
  canManage: boolean;
  onAction?: () => void;
  actionHref?: string;
}) {
  if (!canManage || !allocation?.isSuspended) return null;

  return (
    <section
      aria-labelledby="preview-suspended-title"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:p-5"
      role="status"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="preview-suspended-title" className="font-bold">
            Xem trước bài học đang tạm thời bị vô hiệu hóa
          </h2>
          <p className="mt-1 text-sm leading-6">
            Đang chọn {allocation.markedTopicCount}/{allocation.cap} bài học xem thử.
            {" "}
            Vượt giới hạn {allocation.excess} bài học; có thể gỡ ít nhất {allocation.excess} nhãn Xem thử.
          </p>
          {allocation.causeVerified && allocation.cause ? (
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Tác vụ của quản trị viên nền tảng liên quan đến {allocation.cause.targetLabel}. Lý do: {allocation.cause.reason}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Hãy điều chỉnh danh sách bài học xem thử để khôi phục quyền xem trước công khai.
            </p>
          )}
          {onAction || actionHref ? (
            <Button
              type={actionHref ? undefined : "button"}
              variant="outline"
              className="mt-3 min-h-10 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              onClick={onAction}
              asChild={Boolean(actionHref)}
            >
              {actionHref ? (
                <Link href={actionHref}>
                  <Sparkles className="mr-2 size-4" aria-hidden="true" />
                  Điều chỉnh bài học xem thử
                </Link>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" aria-hidden="true" />
                  Điều chỉnh bài học xem thử
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function topicStatusLabel(status: CoursePreviewAllocation["markedTopics"][number]["status"]) {
  if (status === "draft") return "Bản nháp · Chưa công khai";
  if (status === "pending") return "Chờ duyệt · Chưa công khai";
  return "Đã xuất bản";
}

export function CoursePreviewAllocationCard({
  allocation,
  isLoading,
  isUpdating,
  error,
  canManage,
  onChange,
  onRefresh,
  showTopicListAction = true,
}: {
  allocation: CoursePreviewAllocation | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  canManage: boolean;
  onChange: (change: PreviewMarkerChange) => Promise<unknown>;
  onRefresh?: () => Promise<void> | void;
  showTopicListAction?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const focusMarkerList = () => {
    setIsExpanded(true);
    const focus = () => {
      listRef.current?.focus();
      listRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(focus);
    else focus();
  };

  const availableIds = new Set(allocation?.markedTopics.map((topic) => topic.id) ?? []);
  const currentSelectedIds = selectedIds.filter((id) => availableIds.has(id));
  const selectedCount = currentSelectedIds.length;
  const projectedCount = allocation
    ? Math.max(allocation.markedTopicCount - selectedCount, 0)
    : 0;
  const enoughToRecover = Boolean(
    allocation && (!allocation.isSuspended || selectedCount >= allocation.excess),
  );

  const handleApply = async () => {
    if (!allocation || selectedIds.length === 0 || !enoughToRecover) return;
    const result = await onChange({ unmarkTopicIds: currentSelectedIds });
    if (result && typeof result === "object" && "success" in result) {
      setSelectedIds([]);
    }
  };

  return (
    <section
      aria-labelledby="course-preview-allocation-title"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="course-preview-allocation-title" className="flex items-center gap-2 text-base font-bold text-slate-950">
            <Sparkles className="size-4 text-blue-600" aria-hidden="true" />
            Bài học xem thử
          </h2>
          {allocation ? (
            <>
              <p className="mt-2 text-sm font-semibold text-slate-800" aria-live="polite">
                Đã chọn xem thử: {allocation.markedTopicCount}/{allocation.cap} bài học
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Còn {allocation.remaining} lượt chọn
              </p>
            </>
          ) : isLoading ? (
            <p className="mt-2 text-sm text-slate-500" role="status">Đang tải phân bổ bài học xem thử…</p>
          ) : null}
        </div>
        <Button
          type="button"
          id="course-preview-expand-markers"
          variant="outline"
          className="min-h-10 w-full whitespace-normal sm:w-auto"
          disabled={!allocation || allocation.markedTopics.length === 0}
          onClick={() => {
            if (isExpanded) setIsExpanded(false);
            else focusMarkerList();
          }}
        >
          {isExpanded ? "Thu gọn danh sách" : "Xem bài học đã chọn"}
        </Button>
      </div>

      {allocation?.markedTopics.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
          <p>Chưa chọn bài học xem thử</p>
          {canManage && showTopicListAction ? (
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto px-0 py-1 text-sm"
              onClick={() => document.getElementById("course-chapter-list")?.scrollIntoView?.({ behavior: "smooth", block: "start" })}
            >
              Chọn trong danh sách bài học
            </Button>
          ) : null}
        </div>
      ) : null}

      {isExpanded && allocation?.markedTopics.length ? (
        <div
          id="course-preview-marked-list"
          ref={listRef}
          tabIndex={-1}
          className="mt-4 scroll-mt-6 space-y-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {allocation.isSuspended ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
              Chọn ít nhất {allocation.excess} bài học đang hoạt động để gỡ nhãn. Bài học trong bản nháp hoặc chờ duyệt vẫn tính vào giới hạn nhưng chưa mở công khai.
            </p>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              Bài học chưa xuất bản vẫn tính vào giới hạn nhưng chưa mở công khai.
            </p>
          )}
          <ul className="space-y-2">
            {allocation.markedTopics.map((topic) => (
              <li key={topic.id} className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  id={`preview-unmark-${topic.id}`}
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-blue-600"
                  checked={currentSelectedIds.includes(topic.id)}
                  disabled={!canManage || isUpdating}
                  onChange={(event) => setSelectedIds((current) => {
                    const validCurrent = current.filter((id) => availableIds.has(id));
                    return event.target.checked
                      ? [...validCurrent, topic.id]
                      : validCurrent.filter((id) => id !== topic.id);
                  })}
                  aria-label={`Bỏ nhãn xem thử cho ${topic.title}`}
                />
                <label htmlFor={`preview-unmark-${topic.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block break-words text-sm font-semibold text-slate-900">{topic.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {topic.chapterTitle} · {topicStatusLabel(topic.status)}
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 shrink-0 px-2 text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    document.getElementById(`dashboard-chapter-${topic.chapterId}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
                    document.getElementById(`dashboard-chapter-${topic.chapterId}`)?.focus();
                  }}
                  aria-label={`Đi đến chương ${topic.chapterTitle}`}
                >
                  <MapPin className="size-4 sm:mr-1" aria-hidden="true" />
                  <span className="hidden sm:inline">Đến chương</span>
                </Button>
              </li>
            ))}
          </ul>
          {canManage ? (
            <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-700" aria-live="polite">
                Dự kiến sau khi bỏ nhãn: {projectedCount}/{allocation.cap}
                {allocation.isSuspended ? ` · Cần bỏ ít nhất ${allocation.excess}` : ""}
              </p>
              <Button
                type="button"
                className="min-h-11 w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                disabled={selectedCount === 0 || !enoughToRecover || isUpdating}
                onClick={() => void handleApply()}
              >
                {isUpdating ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <Check className="mr-2 size-4" aria-hidden="true" />}
                Bỏ nhãn đã chọn
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-3 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          {onRefresh ? (
            <Button type="button" variant="outline" className="min-h-10 shrink-0 border-rose-200 bg-white text-rose-800" onClick={() => void onRefresh()}>
              Tải lại phân bổ
            </Button>
          ) : null}
        </div>
      ) : null}
      {isUpdating ? <span className="sr-only" role="status">Đang cập nhật phân bổ bài học xem thử.</span> : null}
      {!allocation && !isLoading && !error ? <p className="mt-2 text-sm text-slate-500">Chưa có dữ liệu phân bổ.</p> : null}
    </section>
  );
}

export function TopicPreviewMarkerToggle({
  topicId,
  title,
  status,
  allocation,
  canManage,
  isUpdating,
  error,
  onChange,
  onShowAllocation,
}: {
  topicId: string;
  title: string;
  status: CoursePreviewAllocation["markedTopics"][number]["status"];
  allocation: CoursePreviewAllocation | null;
  canManage: boolean;
  isUpdating: boolean;
  error?: string | null;
  onChange: (change: PreviewMarkerChange) => Promise<unknown>;
  onShowAllocation?: () => void;
}) {
  if (!allocation || !canManage) return null;
  const isMarked = allocation.markedTopics.some((topic) => topic.id === topicId);
  const isUnavailable = status !== "published";
  const blockedByQuota = !isMarked && allocation.remaining === 0;
  const descriptionId = `preview-marker-description-${topicId}`;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <label className="flex min-h-10 items-start gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={isMarked}
          disabled={isUpdating || blockedByQuota}
          onChange={(event) => void onChange(event.target.checked
            ? { markTopicIds: [topicId] }
            : { unmarkTopicIds: [topicId] })}
          aria-label={`${isMarked ? "Bỏ nhãn" : "Đánh dấu"} xem thử: ${title}`}
          aria-describedby={descriptionId}
          className="mt-0.5 size-4 shrink-0 accent-blue-600"
        />
        <span>{isMarked ? "Bài học xem thử" : "Chọn xem thử"}</span>
      </label>
      <p id={descriptionId} className="mt-1 pl-6 text-xs leading-5 text-slate-600">
        {isUnavailable
          ? "Bài học chưa xuất bản vẫn tính vào giới hạn nhưng chưa mở công khai."
          : blockedByQuota
            ? `Đã dùng ${allocation.markedTopicCount}/${allocation.cap} lượt. Gỡ một nhãn trước khi chọn thêm.`
            : `Đã chọn ${allocation.markedTopicCount}/${allocation.cap}; còn ${allocation.remaining} lượt.`}
      </p>
      {blockedByQuota && onShowAllocation ? (
        <Button type="button" variant="link" className="mt-1 h-auto px-6 py-1 text-xs" onClick={onShowAllocation}>
          Xem danh sách đã chọn
        </Button>
      ) : null}
      {error ? <p role="alert" className="mt-1 text-xs font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}

export function CoursePreviewOverviewNotice({ courseId, canManage }: { courseId: string; canManage: boolean }) {
  const preview = useCoursePreviewAllocation(courseId, canManage);
  if (!canManage) return null;
  if (preview.isLoading) {
    return <p role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Đang kiểm tra trạng thái bài học xem thử…</p>;
  }
  if (preview.error) {
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
        <p>Không thể xác minh trạng thái bài học xem thử. {preview.error}</p>
        <Button type="button" variant="outline" className="min-h-10 border-rose-200 bg-white text-rose-800" onClick={() => void preview.refresh()}>
          Thử tải lại
        </Button>
      </div>
    );
  }
  if (!preview.allocation?.isSuspended) return null;
  return (
    <PreviewSuspensionNotice
      allocation={preview.allocation}
      canManage={canManage}
      actionHref={getCourseStructurePath(courseId)}
    />
  );
}
