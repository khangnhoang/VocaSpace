"use client";

import React, { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ZodType } from "zod";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InlineRenameResult = { error?: string; cancelled?: boolean } | void;

interface UseInlineRenameOptions {
  title: string;
  schema: ZodType<{ title: string }>;
  onSave: (title: string) => Promise<InlineRenameResult>;
  /** Nơi nhận lại focus sau khi lưu hoặc hủy (nút `Đổi tên` hay nút menu của hàng). */
  returnFocusTo: () => HTMLElement | null;
}

export function useInlineRename({
  title,
  schema,
  onSave,
  returnFocusTo,
}: UseInlineRenameOptions) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const groupId = useId();
  const inputId = `${groupId}-input`;
  const errorId = `${groupId}-error`;
  const focusInput = () => document.getElementById(inputId)?.focus();

  const finish = () => {
    setIsEditing(false);
    setError(null);
    // Chờ nút `Đổi tên` render lại rồi mới trả focus.
    requestAnimationFrame(() => returnFocusTo()?.focus());
  };

  const start = () => {
    setValue(title);
    setError(null);
    setIsEditing(true);
  };

  const cancel = () => {
    if (isSaving) return;
    finish();
  };

  const save = async () => {
    if (isSaving) return;
    const parsed = schema.safeParse({ title: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Tên không hợp lệ.");
      focusInput();
      return;
    }
    if (parsed.data.title === title.trim()) {
      finish();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const result = await onSave(parsed.data.title);
      if (result?.cancelled) {
        focusInput();
        return;
      }
      if (result?.error) {
        setError(result.error);
        focusInput();
        return;
      }
      finish();
    } catch (saveError) {
      console.error("[INLINE RENAME UI ERROR]:", saveError);
      setError("Không thể lưu tên. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  // Rời khỏi ô nhập và hai nút điều khiển thì thoát chế độ đổi tên,
  // trừ khi đang lưu hoặc đang hiển thị lỗi để người dùng còn sửa lại.
  const handleBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as HTMLElement | null;
    if (next?.closest("[data-inline-rename]")?.getAttribute("data-inline-rename") === groupId) return;
    if (isSaving || error) return;
    finish();
  };

  return {
    isEditing,
    isSaving,
    error,
    start,
    cancel,
    save,
    groupId,
    inputProps: {
      id: inputId,
      value,
      autoFocus: true,
      "data-inline-rename": groupId,
      onFocus: (event: React.FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
      disabled: isSaving,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
        if (error) setError(null);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void save();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
      },
      onBlur: handleBlur,
    },
    errorId,
    handleBlur,
  };
}

export type InlineRenameState = ReturnType<typeof useInlineRename>;

export function InlineRenameInput({
  rename,
  label,
  className,
}: {
  rename: InlineRenameState;
  label: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <input
        {...rename.inputProps}
        type="text"
        aria-label={label}
        className={cn(
          "w-full min-w-0 rounded-[8px] border border-route bg-background px-2.5 text-foreground outline-none transition-[border-color,box-shadow] duration-[120ms] focus-visible:ring-2 focus-visible:ring-route/30 disabled:opacity-60 aria-invalid:border-correction motion-reduce:transition-none",
          className,
        )}
      />
      {rename.error ? (
        <p id={rename.errorId} className="mt-1 text-sm font-medium text-correction">
          {rename.error}
        </p>
      ) : null}
    </div>
  );
}

export function InlineRenameActions({
  rename,
  size = "sm",
}: {
  rename: InlineRenameState;
  size?: "sm" | "default";
}) {
  // Giữ focus trong ô nhập khi bấm chuột vào nút; Safari không focus nút khi click,
  // nên nếu không chặn thì blur của ô nhập sẽ hủy trước khi click kịp chạy.
  const keepInputFocus = (event: React.MouseEvent) => event.preventDefault();

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        data-inline-rename={rename.groupId}
        type="button"
        variant="outline"
        size={size}
        disabled={rename.isSaving}
        aria-busy={rename.isSaving || undefined}
        onMouseDown={keepInputFocus}
        onBlur={rename.handleBlur}
        onClick={() => void rename.save()}
      >
        {rename.isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {rename.isSaving ? "Đang lưu…" : "Lưu tên"}
      </Button>
      <Button
        data-inline-rename={rename.groupId}
        type="button"
        variant="ghost"
        size={size}
        disabled={rename.isSaving}
        onMouseDown={keepInputFocus}
        onBlur={rename.handleBlur}
        onClick={rename.cancel}
      >
        Hủy
      </Button>
    </div>
  );
}
