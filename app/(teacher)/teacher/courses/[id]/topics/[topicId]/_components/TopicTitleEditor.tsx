"use client";

import { useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { updateTopic } from "@/app/actions/topic";
import { topicSchema } from "@/lib/schemas/topic";
import { useRegisterAuthoringEditor, useSingleFlightSave } from "./authoring-guard";

interface TopicTitleEditorProps {
  id: string;
  topicId: string;
  title: string;
  canEdit: boolean;
  onSaved: () => void;
}

const TITLE_TEXT = "text-2xl leading-8 font-extrabold tracking-[-0.01em] text-slate-950 sm:text-[28px] sm:leading-9";

// Bấm vào tên để sửa ngay tại chỗ: Enter hoặc rời ô nhập thì lưu, Esc thì bỏ. Tên chưa lưu được
// (sai độ dài, server từ chối) giữ nguyên trong ô nhập và báo lỗi ngay bên dưới.
export default function TopicTitleEditor({ id, topicId, title, canEdit, onSaved }: TopicTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Tên vừa lưu hiện ngay, không chờ trang refresh xong mới đổi.
  const [saved, setSaved] = useState<{ from: string; to: string } | null>(null);
  const shownTitle = saved?.from === title ? saved.to : title;
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Bỏ ô nhập khỏi DOM cũng có thể phát blur; ref này chặn blur đó lưu lại lần nữa.
  const editingRef = useRef(false);
  const saveFlight = useSingleFlightSave();
  const errorId = `${id}-error`;

  const stop = (returnFocus: boolean) => {
    editingRef.current = false;
    setIsEditing(false);
    setError(null);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const save = async (returnFocus: boolean) => {
    const parsed = topicSchema.safeParse({ title: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Tên bài học không hợp lệ.");
      return false;
    }
    if (parsed.data.title === shownTitle) {
      stop(returnFocus);
      return true;
    }
    setIsSaving(true);
    setError(null);
    const res = await updateTopic({ topicId, title: parsed.data.title }).catch(() => ({
      error: "Không lưu được tên bài học. Vui lòng thử lại.",
      message: undefined,
    }));
    setIsSaving(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    toast.success(res.message);
    setSaved({ from: title, to: parsed.data.title });
    stop(returnFocus);
    onSaved();
    return true;
  };

  useRegisterAuthoringEditor(
    canEdit
      ? {
          isDirty: () => editingRef.current && value.trim() !== shownTitle,
          save: () => saveFlight.run(() => save(false)),
          pendingSave: saveFlight.pending,
          discard: () => stop(false),
          label: "Tên bài học",
        }
      : null,
  );

  if (canEdit && isEditing) {
    return (
      <div className="min-w-0">
        <h1 id={id} className="flex items-center gap-2">
          <Input
            autoFocus
            value={value}
            readOnly={isSaving}
            aria-label="Tên bài học"
            aria-busy={isSaving || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveFlight.run(() => save(true));
              } else if (event.key === "Escape" && !isSaving) {
                event.preventDefault();
                stop(true);
              }
            }}
            onBlur={() => {
              if (editingRef.current) void saveFlight.run(() => save(false));
            }}
            className={`-mx-2 h-auto min-w-0 flex-1 px-2 py-0.5 md:text-[28px] ${TITLE_TEXT}`}
          />
          {isSaving ? <Loader2 className="size-5 shrink-0 animate-spin text-route" aria-hidden="true" /> : null}
        </h1>
        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-correction">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <h1 id={id} className={`[overflow-wrap:anywhere] ${TITLE_TEXT}`}>
      {canEdit ? (
        <button
          ref={triggerRef}
          type="button"
          title="Bấm để sửa tên bài học"
          onClick={() => {
            editingRef.current = true;
            setValue(shownTitle);
            setError(null);
            setIsEditing(true);
          }}
          className="-mx-2 inline-flex max-w-full cursor-text items-start gap-2 rounded-lg px-2 text-left outline-none transition-colors duration-[120ms] hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-route motion-reduce:transition-none"
        >
          <span className="min-w-0">{shownTitle}</span>
          <Pencil className="mt-2 size-4 shrink-0 text-slate-500 sm:mt-2.5" aria-hidden="true" />
        </button>
      ) : (
        shownTitle
      )}
    </h1>
  );
}
