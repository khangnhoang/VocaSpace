"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ChapterHidePreviewProjection,
  TopicDeletePreviewProjection,
} from "@/lib/schemas/course-preview";

export type PreviewQuotaProjection = ChapterHidePreviewProjection | TopicDeletePreviewProjection;

type ProjectionResult = { data?: PreviewQuotaProjection; error?: string };
type MutationResult = {
  success?: true;
  message?: string;
  error?: string;
  previewProjection?: PreviewQuotaProjection;
  cancelled?: boolean;
};

interface PreviewQuotaResolutionDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  targetType: "chapter" | "topic";
  targetId: string | null;
  targetTitle: string;
  description: string;
  confirmText: string;
  loadingText: string;
  getProjection: (targetId: string) => Promise<ProjectionResult>;
  onConfirm: (unmarkTopicIds: string[]) => Promise<MutationResult>;
}

function projectionLabel(topic: PreviewQuotaProjection["outsideMarkedTopics"][number]) {
  const status = topic.status === "published"
    ? "Đã xuất bản"
    : topic.status === "pending"
      ? "Chờ duyệt · Chưa công khai"
      : "Bản nháp · Chưa công khai";
  return `${topic.chapterTitle} · ${status}`;
}

export default function PreviewQuotaResolutionDialog({
  open,
  setOpen,
  targetType,
  targetId,
  targetTitle,
  description,
  confirmText,
  loadingText,
  getProjection,
  onConfirm,
}: PreviewQuotaResolutionDialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstSelectionRef = useRef<HTMLInputElement>(null);
  const [projection, setProjection] = useState<PreviewQuotaProjection | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !targetId) return;
    let isCurrent = true;
    setProjection(null);
    setSelectedIds([]);
    setLoadError(null);
    setMutationError(null);
    setIsLoading(true);
    void getProjection(targetId).then((result) => {
      if (!isCurrent) return;
      if (result.error || !result.data) {
        setLoadError(result.error ?? "Không thể tải số liệu xem thử. Vui lòng thử lại.");
        return;
      }
      setProjection(result.data);
    }).catch(() => {
      if (isCurrent) setLoadError("Không thể tải số liệu xem thử. Vui lòng thử lại.");
    }).finally(() => {
      if (isCurrent) setIsLoading(false);
    });
    return () => { isCurrent = false; };
  }, [getProjection, open, targetId]);

  useEffect(() => {
    if (projection?.requiredUnmarkCount && projection.canManageMarkers) {
      firstSelectionRef.current?.focus();
    }
  }, [projection]);

  const currentOutsideIds = new Set(projection?.outsideMarkedTopics.map((topic) => topic.id) ?? []);
  const currentSelectedIds = selectedIds.filter((id) => currentOutsideIds.has(id));
  const required = projection?.requiredUnmarkCount ?? 0;
  const canResolve = Boolean(
    projection && (
      required === 0 ||
      (projection.canManageMarkers && currentSelectedIds.length >= required)
    ),
  );
  const projectedMarkedCount = Math.max(
    (projection?.projectedMarkedTopicCount ?? 0) - currentSelectedIds.length,
    0,
  );

  const retryProjection = async () => {
    if (!targetId || isLoading) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const fresh = await getProjection(targetId);
      if (fresh.data) {
        const freshIds = new Set(fresh.data.outsideMarkedTopics.map((topic) => topic.id));
        setSelectedIds((current) => current.filter((id) => freshIds.has(id)));
        setProjection(fresh.data);
      } else {
        setLoadError(fresh.error ?? "Không thể tải số liệu xem thử. Vui lòng thử lại.");
      }
    } catch {
      setLoadError("Không thể tải số liệu xem thử. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const submit = async () => {
    if (!targetId || !projection || !canResolve || isSubmitting || loadError) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      const result = await onConfirm(currentSelectedIds);
      if (result.cancelled) return;
      if (result.success) {
        setOpen(false);
        return;
      }
      setMutationError(result.error ?? "Không thể hoàn tất thao tác. Vui lòng thử lại.");
      if (result.previewProjection) {
        const freshIds = new Set(result.previewProjection.outsideMarkedTopics.map((topic) => topic.id));
        setSelectedIds((current) => current.filter((id) => freshIds.has(id)));
        setProjection(result.previewProjection);
      } else {
        const fresh = await getProjection(targetId);
        if (fresh.data) {
          const freshIds = new Set(fresh.data.outsideMarkedTopics.map((topic) => topic.id));
          setSelectedIds((current) => current.filter((id) => freshIds.has(id)));
          setProjection(fresh.data);
        } else {
          setLoadError(fresh.error ?? result.error ?? "Không thể tải lại số liệu xem thử.");
        }
      }
    } catch {
      setMutationError("Không thể hoàn tất thao tác. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetLabel = targetType === "chapter" ? "Chương" : "Bài học";
  const targetPreviewCount = targetType === "chapter"
    ? (projection && "internalMarkedTopicCount" in projection ? projection.internalMarkedTopicCount : 0)
    : (projection && "targetIsPreview" in projection && projection.targetIsPreview ? 1 : 0);
  const isPendingFreeze = Boolean(loadError?.includes("đang chờ duyệt"));
  const needsHandoff = Boolean(projection && required > 0 && !projection.canManageMarkers);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!isSubmitting) setOpen(nextOpen);
    }}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-white p-5 sm:max-w-xl sm:p-6"
      >
        <DialogHeader className="gap-3 pr-8">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle ref={titleRef} tabIndex={-1} className="min-w-0 text-lg font-bold leading-snug text-slate-950 sm:text-xl">
              {targetType === "chapter" ? "Ẩn chương?" : "Ẩn bài học?"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{targetLabel}</p>
          <p className="mt-1 break-words text-sm font-semibold leading-snug text-slate-900">{targetTitle}</p>
          {targetPreviewCount > 0 ? (
            <p className="mt-2 text-sm text-slate-700">
              {targetType === "chapter"
                ? `${targetPreviewCount} nhãn xem thử trong chương sẽ được gỡ tự động.`
                : "Nhãn xem thử của bài học này sẽ được gỡ tự động."}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-700">Nội dung sẽ được ẩn khỏi cấu trúc đang hoạt động và có thể được khôi phục.</p>
        </div>

        {isLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-600" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Đang kiểm tra ảnh hưởng đến bài học xem thử…
          </p>
        ) : null}

        {loadError ? (
          <div role="alert" className={`mt-4 rounded-lg border px-3 py-2.5 text-sm leading-6 ${isPendingFreeze ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {loadError}
            {isPendingFreeze ? " Không có thay đổi nào được thực hiện." : null}
            {!isPendingFreeze ? (
              <Button type="button" variant="link" className="mt-1 h-auto p-0 text-sm" onClick={() => void retryProjection()} disabled={isLoading}>
                Tải lại số liệu
              </Button>
            ) : null}
          </div>
        ) : null}

        {projection && required > 0 && !loadError ? (
          <section className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3" aria-labelledby="preview-resolution-title">
            <div>
              <h3 id="preview-resolution-title" className="text-sm font-bold text-amber-950">
                Cần chọn bài học xem thử để gỡ nhãn
              </h3>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Sau khi ẩn, phân bổ dự kiến là {projectedMarkedCount}/{projection.projectedCap}. Chọn ít nhất {required} bài học đang hoạt động bên ngoài mục này.
              </p>
            </div>
            {needsHandoff ? (
              <p role="alert" className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm leading-6 text-amber-950">
                Bạn không thể gỡ nhãn của các bài học khác. Hãy nhờ chủ khóa học, đồng chủ khóa học hoặc biên tập viên điều chỉnh phân bổ trước khi tiếp tục.
              </p>
            ) : (
              <fieldset className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-amber-200 bg-white p-2">
                <legend className="sr-only">Bài học bên ngoài có nhãn xem thử cần gỡ</legend>
                {projection.outsideMarkedTopics.map((topic) => (
                  <label key={topic.id} className="flex min-h-11 items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50">
                    <input
                      ref={topic.id === projection.outsideMarkedTopics[0]?.id ? firstSelectionRef : undefined}
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-blue-600"
                      checked={currentSelectedIds.includes(topic.id)}
                      disabled={!projection.canManageMarkers || isSubmitting}
                      onChange={(event) => setSelectedIds((current) => event.target.checked
                        ? [...current, topic.id]
                        : current.filter((id) => id !== topic.id))}
                      aria-label={`Bỏ nhãn xem thử cho ${topic.title}`}
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-semibold text-slate-900">{topic.title}</span>
                      <span className="block text-xs text-slate-600">{projectionLabel(topic)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <p className="text-sm font-medium text-slate-800" aria-live="polite">
              Đã chọn {currentSelectedIds.length}/{required} · Dự kiến còn {projectedMarkedCount}/{projection.projectedCap}
            </p>
          </section>
        ) : null}

        {mutationError ? <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-800">{mutationError}</p> : null}

        <DialogFooter className="mt-5 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)} disabled={isSubmitting} className="w-full rounded-lg sm:w-auto">
            Hủy bỏ
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isLoading || isSubmitting || Boolean(loadError) || !projection || !canResolve}
            onClick={() => void submit()}
            className="w-full rounded-lg bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/30 sm:w-auto"
          >
            {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />{loadingText}</> : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
