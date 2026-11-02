"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { AlertCircle, Check, Loader2, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorFrameProps {
  title: string;
  eyebrow?: string;
  badge?: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  savedSignal?: number;
  readOnly?: boolean;
  error?: string | null;
  onSave?: () => void;
  onSaveAndNext?: () => void;
  saveAndNextLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  onCancel?: () => void;
  saveLabel?: string;
  children: ReactNode;
}

// Khung chung cho mọi editor nội dung: lỗi lưu nằm ở đầu editor, nút lưu ở cuối,
// Ctrl/Cmd+S lưu khi focus nằm trong editor. Không tự giữ dữ liệu form.
export default function EditorFrame({
  title,
  eyebrow,
  badge,
  isDirty,
  isSaving,
  savedSignal = 0,
  readOnly = false,
  error,
  onSave,
  onSaveAndNext,
  saveAndNextLabel = "Lưu & thêm tiếp",
  onDelete,
  deleteLabel = "Xóa",
  onCancel,
  saveLabel = "Lưu",
  children,
}: EditorFrameProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !onSave) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!isSaving) onSave();
    }
  };

  return (
    <div className="flex min-w-0 flex-col" onKeyDown={handleKeyDown}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-[0.04em] text-slate-600 uppercase">{eyebrow}</p>
          ) : null}
          <h3 className="mt-0.5 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">{title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {readOnly ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
              <Lock className="size-3.5" aria-hidden="true" /> Chỉ xem
            </span>
          ) : isDirty ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-attention">
              <span className="size-2 rounded-full bg-attention" aria-hidden="true" /> Chưa lưu
            </span>
          ) : savedSignal > 0 ? (
            <span
              key={savedSignal}
              className="inline-flex items-center gap-1 text-xs font-semibold text-growth motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300"
            >
              <Check className="size-4" aria-hidden="true" /> Đã lưu
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-correction-line bg-correction-quiet px-3 py-2.5 text-sm text-slate-900"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-correction" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-correction">Chưa lưu được thay đổi</p>
            <p className="mt-0.5 [overflow-wrap:anywhere]">{error}</p>
            <p className="mt-0.5 text-slate-600">Nội dung bạn nhập vẫn còn nguyên.</p>
          </div>
          {onSave && !readOnly ? (
            <Button type="button" size="sm" variant="outline" onClick={onSave} disabled={isSaving}>
              Thử lại
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0 space-y-5 px-5 py-5">{children}</div>

      {!readOnly && (onSave || onDelete) ? (
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {onDelete ? (
            <Button
              type="button"
              variant="destructive-quiet"
              onClick={onDelete}
              disabled={isSaving}
              className="min-h-11 sm:min-h-9"
            >
              <Trash2 aria-hidden="true" /> {deleteLabel}
            </Button>
          ) : onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving} className="min-h-11 sm:min-h-9">
              Hủy
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          {onSave ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <span className="hidden text-xs text-slate-600 xl:inline">Ctrl/⌘ + S để lưu</span>
              {onSaveAndNext ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSaveAndNext}
                  disabled={isSaving}
                  className="min-h-11 sm:min-h-9"
                >
                  {saveAndNextLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                aria-busy={isSaving}
                className="min-h-11 sm:min-h-9"
              >
                {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {isSaving ? "Đang lưu…" : saveLabel}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {isSaving ? "Đang lưu…" : savedSignal > 0 && !isDirty ? "Đã lưu thay đổi." : ""}
      </p>
    </div>
  );
}

export function EmptyEditorPanel({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-route-quiet text-route" aria-hidden="true">
        {icon}
      </span>
      <p className="text-base font-bold text-slate-900">{title}</p>
      <p className="max-w-sm text-sm leading-6 text-slate-600">{description}</p>
      {action}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-correction">
      {message}
    </p>
  );
}
