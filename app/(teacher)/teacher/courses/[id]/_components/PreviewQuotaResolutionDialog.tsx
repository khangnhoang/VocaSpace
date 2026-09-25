"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
  confirmAriaLabel?: string;
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
  confirmAriaLabel,
  loadingText,
  getProjection,
  onConfirm,
}: PreviewQuotaResolutionDialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstSelectionRef = useRef<HTMLInputElement>(null);
  const [projection, setProjection] = useState<PreviewQuotaProjection | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl bg-white p-5 sm:max-w-xl sm:p-6 shadow-2xl"
      >
        <DialogHeader className="gap-3 pr-8">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 border border-rose-100/80 text-rose-600">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle ref={titleRef} tabIndex={-1} className="min-w-0 text-lg font-bold leading-snug text-slate-950 sm:text-xl">
                {targetType === "chapter" ? "Xóa chương?" : "Xóa bài học?"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed text-slate-600">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Clean target info preview */}
        <div className="mt-1 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{targetLabel}</p>
          <p className="mt-0.5 break-words text-sm font-semibold leading-snug text-slate-900">{targetTitle}</p>
          {targetPreviewCount > 0 ? (
            <p className="mt-1.5 text-xs font-medium text-amber-800">
              {targetType === "chapter"
                ? `${targetPreviewCount} nhãn xem thử trong chương sẽ được gỡ tự động.`
                : "Nhãn xem thử của bài học này sẽ được gỡ tự động."}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">Nội dung sẽ được ẩn khỏi cấu trúc đang hoạt động và có thể được khôi phục.</p>
        </div>

        {isLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-600" role="status">
            <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden="true" />
            Đang kiểm tra ảnh hưởng đến bài học xem thử…
          </p>
        ) : null}

        {loadError ? (
          <div role="alert" className={`mt-4 rounded-xl border p-3.5 text-sm leading-6 ${isPendingFreeze ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {loadError}
            {isPendingFreeze ? " Không có thay đổi nào được thực hiện." : null}
            {!isPendingFreeze ? (
              <Button type="button" variant="link" className="mt-1 h-auto p-0 text-sm font-semibold" onClick={() => void retryProjection()} disabled={isLoading}>
                Tải lại số liệu
              </Button>
            ) : null}
          </div>
        ) : null}

        {projection && required > 0 && !loadError ? (
          <section className="mt-4 space-y-3" aria-labelledby="preview-resolution-title">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5">
              <div>
                <h3 id="preview-resolution-title" className="text-sm font-bold text-slate-900">
                  Cần chọn bài học xem thử để gỡ nhãn
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sau khi xóa, phân bổ dự kiến là {projectedMarkedCount}/{projection.projectedCap}. Chọn ít nhất {required} bài học đang hoạt động bên ngoài mục này.
                </p>
              </div>
              <div className="shrink-0">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                    canResolve
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  )}
                  aria-live="polite"
                >
                  Đã chọn {currentSelectedIds.length}/{required} · Dự kiến còn {projectedMarkedCount}/{projection.projectedCap}
                </span>
              </div>
            </div>

            {needsHandoff ? (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900">
                Bạn không thể gỡ nhãn của các bài học khác. Hãy nhờ chủ khóa học, đồng chủ khóa học hoặc biên tập viên điều chỉnh phân bổ trước khi tiếp tục.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-2xs">
                {projection.outsideMarkedTopics.map((topic, index) => {
                  const isChecked = currentSelectedIds.includes(topic.id);
                  return (
                    <label
                      key={topic.id}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors select-none group",
                        isChecked ? "bg-blue-50/40" : "hover:bg-slate-50/80"
                      )}
                    >
                      <input
                        ref={index === 0 ? firstSelectionRef : undefined}
                        type="checkbox"
                        className="peer sr-only"
                        checked={isChecked}
                        disabled={!projection.canManageMarkers || isSubmitting}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, topic.id]
                              : current.filter((id) => id !== topic.id)
                          )
                        }
                        aria-label={`Bỏ nhãn xem thử cho ${topic.title}`}
                      />
                      {/* Modern circular checkbox with thin border */}
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2",
                          isChecked
                            ? "border-blue-600 bg-blue-600 text-white shadow-2xs"
                            : "border-slate-300 bg-white group-hover:border-slate-400"
                        )}
                        aria-hidden="true"
                      >
                        {isChecked && <Check className="size-3.5 stroke-[2.5]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-1 group-hover:text-slate-900">
                          {topic.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {projectionLabel(topic)}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {mutationError ? (
          <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
            {mutationError}
          </p>
        ) : null}

        <DialogFooter className="mt-5 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
            className="w-full rounded-xl sm:w-auto font-medium"
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isLoading || isSubmitting || Boolean(loadError) || !projection || !canResolve}
            onClick={() => void submit()}
            aria-label={confirmAriaLabel}
            className="w-full rounded-xl bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/30 sm:w-auto font-semibold shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {loadingText}
              </>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
