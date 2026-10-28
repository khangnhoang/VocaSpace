"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookType, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Card } from "@/app/(teacher)/teacher/courses/[id]/_components/types";
import { createCard, deleteCard, getCardsByTopicId, updateCard } from "@/app/actions/card";
import { cardSchema, type CardFormValues } from "@/lib/schemas/card";
import type { CourseAuthoringSuccessEvent } from "@/lib/course-authoring/issue-success";
import { PUBLISHED_DELETE_IMPACT } from "@/lib/course-authoring/published-edit-impact";
import { PublishedImpactNotice } from "@/app/(teacher)/teacher/courses/[id]/_components/PublishedEditWarning";
import AuthoringWorkbench from "./AuthoringWorkbench";
import EditorFrame, { EmptyEditorPanel, FieldError } from "./EditorFrame";
import { FlashcardPreview } from "./LearnerPreview";
import { useAuthoringGuard, useRegisterAuthoringEditor, useSingleFlightSave } from "./authoring-guard";
import { matchesSearch } from "./authoring-search";

interface FlashcardWorkbenchProps {
  topicId: string;
  isActive?: boolean;
  readOnly?: boolean;
  isPublished?: boolean;
  onAuthoringSuccess?: (event: CourseAuthoringSuccessEvent) => boolean;
  onMutationSuccess?: () => void;
}

type Selection = { mode: "new" } | { mode: "edit"; cardId: string };

const EMPTY_VALUES: CardFormValues = {
  word: "",
  pos: "",
  phonetic: "",
  translation: "",
  explanation: "",
  example: "",
  exampleTranslation: "",
  hint: "",
};

function toFormValues(card: Card): CardFormValues {
  return {
    word: card.front_content.word || "",
    pos: card.front_content.pos || "",
    phonetic: card.front_content.phonetic || "",
    translation: card.back_content.translation || "",
    explanation: card.back_content.explanation || "",
    example: card.back_content.example || "",
    exampleTranslation: card.back_content.exampleTranslation || "",
    hint: card.back_content.hint || "",
  };
}

function getMissingFields(card: Card) {
  const missing: string[] = [];
  if (!card.front_content.phonetic?.trim()) missing.push("phiên âm");
  if (!card.back_content.example?.trim()) missing.push("ví dụ");
  return missing;
}

const FIELDS: {
  name: keyof CardFormValues;
  label: string;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
}[] = [
  { name: "word", label: "Từ vựng", required: true, placeholder: "VD: negotiate" },
  { name: "pos", label: "Loại từ", placeholder: "VD: v, n, adj" },
  { name: "phonetic", label: "Phiên âm", placeholder: "VD: /nɪˈɡoʊʃieɪt/" },
  { name: "translation", label: "Nghĩa", required: true, placeholder: "VD: đàm phán" },
  { name: "explanation", label: "Giải thích", multiline: true },
  { name: "example", label: "Câu ví dụ", multiline: true },
  { name: "exampleTranslation", label: "Dịch câu ví dụ", multiline: true },
  { name: "hint", label: "Mẹo ghi nhớ" },
];

export default function FlashcardWorkbench({
  topicId,
  isActive = true,
  readOnly = false,
  isPublished = false,
  onAuthoringSuccess,
  onMutationSuccess,
}: FlashcardWorkbenchProps) {
  const guard = useAuthoringGuard();
  const fieldPrefix = useId();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSignal, setSavedSignal] = useState(0);
  const [deleting, setDeleting] = useState<Card | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectNewestAfterLoadRef = useRef(false);
  const saveFlight = useSingleFlightSave();

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: EMPTY_VALUES,
  });
  const previewValues = useWatch({ control: form.control }) as CardFormValues;
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const res = await getCardsByTopicId(topicId);
      if (!isMounted) return;
      if (res.error) {
        setLoadError(res.error);
      } else {
        const nextCards = res.data ?? [];
        setLoadError(null);
        setCards(nextCards);
        if (selectNewestAfterLoadRef.current) {
          // Sau khi tạo thẻ bằng `Lưu`, mở lại đúng thẻ vừa tạo để người soạn giữ ngữ cảnh;
          // action tạo thẻ không trả về ID nên chọn theo `created_at` mới nhất.
          selectNewestAfterLoadRef.current = false;
          const newest = nextCards.reduce<Card | null>(
            (latest, card) => (!latest || card.created_at > latest.created_at ? card : latest),
            null,
          );
          setSelection(newest ? { mode: "edit", cardId: newest.id } : null);
          form.reset(newest ? toFormValues(newest) : EMPTY_VALUES);
        }
      }
      setIsLoading(false);
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [form, topicId, refreshKey]);

  const selectedCard =
    selection?.mode === "edit" ? cards.find((card) => card.id === selection.cardId) ?? null : null;

  const visibleCards = useMemo(
    () =>
      cards.filter((card) =>
        matchesSearch(query, [
          card.front_content.word,
          card.back_content.translation,
          card.front_content.pos,
        ]),
      ),
    [cards, query],
  );

  const openSelection = (next: Selection | null) => {
    setSaveError(null);
    setSavedSignal(0);
    setSelection(next);
    if (next?.mode === "edit") {
      const card = cards.find((item) => item.id === next.cardId);
      form.reset(card ? toFormValues(card) : EMPTY_VALUES);
    } else {
      form.reset(EMPTY_VALUES);
    }
    if (next && !readOnly) requestAnimationFrame(() => form.setFocus("word"));
  };

  const requestSelection = async (next: Selection | null) => {
    if (selection?.mode === "edit" && next?.mode === "edit" && selection.cardId === next.cardId) return;
    if (guard.hasDirtyEditor() && !(await guard.confirmLeave())) return;
    openSelection(next);
  };

  const saveCard = async (after: "stay" | "next"): Promise<boolean> => {
    if (readOnly || !selection) return false;
    const valid = await form.trigger();
    if (!valid) {
      const firstInvalid = FIELDS.find((field) => form.getFieldState(field.name).error);
      if (firstInvalid) form.setFocus(firstInvalid.name);
      return false;
    }
    const values = form.getValues();
    setIsSaving(true);
    setSaveError(null);
    const res =
      selection.mode === "edit"
        ? await updateCard(selection.cardId, values)
        : await createCard(topicId, values);
    setIsSaving(false);

    if (res.error) {
      setSaveError(res.error);
      return false;
    }

    // Parent chỉ trả true khi thẻ mới khớp vấn đề từ dashboard; lúc đó thông báo inline thay toast.
    const handledByDashboardFeedback =
      selection.mode === "new" &&
      (onAuthoringSuccess?.({ type: "flashcard_created", topicId }) ?? false);
    if (!handledByDashboardFeedback) toast.success(res.message);
    onMutationSuccess?.();
    setRefreshKey((key) => key + 1);

    if (after === "next") {
      openSelection({ mode: "new" });
    } else if (selection.mode === "edit") {
      form.reset(values);
      setSavedSignal((signal) => signal + 1);
    } else {
      // Form sạch ngay khi server xác nhận; thẻ vừa tạo được chọn lại sau khi danh sách tải xong.
      form.reset(values);
      selectNewestAfterLoadRef.current = true;
      setSavedSignal((signal) => signal + 1);
    }
    return true;
  };

  const discard = () => {
    form.reset(selectedCard ? toFormValues(selectedCard) : EMPTY_VALUES);
    setSaveError(null);
  };

  useRegisterAuthoringEditor(
    selection && !readOnly
      ? {
          isDirty: () => form.formState.isDirty,
          save: () => saveFlight.run(() => saveCard("stay")),
          pendingSave: saveFlight.pending,
          discard,
          label: selection.mode === "edit" ? "Thẻ từ vựng đang sửa" : "Thẻ từ vựng mới",
        }
      : null,
  );

  const confirmDelete = async () => {
    if (!deleting || readOnly) return;
    setIsDeleting(true);
    const res = await deleteCard(deleting.id);
    setIsDeleting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message);
    if (selection?.mode === "edit" && selection.cardId === deleting.id) {
      setSelection(null);
      form.reset(EMPTY_VALUES);
    }
    setDeleting(null);
    setRefreshKey((key) => key + 1);
    onMutationSuccess?.();
  };

  const editorTitle =
    selection?.mode === "edit"
      ? selectedCard?.front_content.word || "Thẻ từ vựng"
      : "Thẻ từ vựng mới";

  const list = (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Thẻ từ vựng</h2>
          <p className="text-xs font-medium text-slate-600">
            {isLoading ? "Đang tải…" : `${cards.length} thẻ`}
          </p>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            onClick={() => void requestSelection({ mode: "new" })}
            disabled={isLoading || !!loadError}
            className="min-h-11 lg:min-h-9"
          >
            <Plus aria-hidden="true" /> Thêm thẻ
          </Button>
        ) : null}
      </div>
      {cards.length > 0 ? (
        <div className="border-b border-slate-200 px-4 py-3">
          <label htmlFor={`${fieldPrefix}-search`} className="sr-only">
            Tìm thẻ từ vựng
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <Input
              id={`${fieldPrefix}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo từ hoặc nghĩa"
              className="h-10 pl-9"
            />
          </div>
        </div>
      ) : null}
      <div className="min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600" role="status">
            <Loader2 className="size-5 animate-spin text-route" aria-hidden="true" /> Đang tải thẻ từ vựng…
          </div>
        ) : loadError ? (
          <div className="space-y-3 px-4 py-6" role="alert">
            <p className="text-sm font-medium text-correction">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>
              Tải lại
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <BookType className="mx-auto size-8 text-slate-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-slate-900">Chưa có thẻ từ vựng nào</p>
            <p className="mt-1 text-sm text-slate-600">
              {readOnly ? "Bài học này chưa có flashcard." : "Bấm “Thêm thẻ” để tạo thẻ đầu tiên."}
            </p>
          </div>
        ) : visibleCards.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600">
            Không có thẻ nào khớp “{query.trim()}”.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto">
            {visibleCards.map((card) => {
              const isSelected = selection?.mode === "edit" && selection.cardId === card.id;
              const missing = getMissingFields(card);
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => void requestSelection({ mode: "edit", cardId: card.id })}
                    className={`relative flex min-h-14 w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left outline-none transition-colors duration-[120ms] focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-inset motion-reduce:transition-none ${
                      isSelected ? "bg-route-quiet" : "hover:bg-slate-50"
                    }`}
                  >
                    {isSelected ? (
                      <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-route" aria-hidden="true" />
                    ) : null}
                    <span className="flex w-full min-w-0 items-baseline gap-1.5">
                      <span className={`truncate text-sm font-bold ${isSelected ? "text-route" : "text-slate-900"}`}>
                        {card.front_content.word}
                      </span>
                      {card.front_content.pos ? (
                        <span className="shrink-0 text-xs font-medium text-slate-600">({card.front_content.pos})</span>
                      ) : null}
                    </span>
                    <span className="w-full truncate text-sm text-slate-600">{card.back_content.translation}</span>
                    {missing.length > 0 ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-attention">
                        <span className="size-1.5 rounded-full bg-attention" aria-hidden="true" />
                        Thiếu {missing.join(", ")}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const editor = selection ? (
    <EditorFrame
      eyebrow={selection.mode === "edit" ? "Sửa thẻ từ vựng" : "Thêm thẻ từ vựng"}
      title={editorTitle}
      isDirty={isDirty}
      isSaving={isSaving}
      savedSignal={savedSignal}
      readOnly={readOnly}
      error={saveError}
      onSave={() => void saveFlight.run(() => saveCard("stay"))}
      onSaveAndNext={() => void saveFlight.run(() => saveCard("next"))}
      onDelete={selection.mode === "edit" && selectedCard ? () => setDeleting(selectedCard) : undefined}
      deleteLabel="Xóa thẻ từ vựng"
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void saveFlight.run(() => saveCard("stay"));
        }}
      >
        {FIELDS.map((field) => {
          const id = `${fieldPrefix}-${field.name}`;
          const errorId = `${id}-error`;
          const error = form.formState.errors[field.name]?.message;
          const Control = field.multiline ? Textarea : Input;
          return (
            <div key={field.name} className={field.multiline ? "sm:col-span-2" : undefined}>
              <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">
                {field.label}
                {field.required ? (
                  <span className="text-correction" aria-hidden="true">
                    {" "}*
                  </span>
                ) : (
                  <span className="font-normal text-slate-600"> (tùy chọn)</span>
                )}
              </label>
              <Control
                id={id}
                disabled={readOnly}
                placeholder={field.placeholder}
                aria-required={field.required || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={field.multiline ? "min-h-20 resize-y" : "h-11"}
                {...form.register(field.name)}
              />
              <FieldError id={errorId} message={error} />
            </div>
          );
        })}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Lưu
        </button>
      </form>
    </EditorFrame>
  ) : null;

  return (
    <>
      <AuthoringWorkbench
        label="thẻ từ vựng"
        list={list}
        editor={editor}
        isActive={isActive}
        isEditorOpen={selection !== null}
        editorTitle={editorTitle}
        onRequestClose={() => void requestSelection(null)}
        preview={selection ? <FlashcardPreview values={previewValues} /> : null}
        emptyEditor={
          <EmptyEditorPanel
            icon={<BookType aria-hidden="true" />}
            title={readOnly ? "Chọn một thẻ để xem" : "Chọn một thẻ để sửa"}
            description={
              readOnly
                ? "Nội dung và bản xem trước cho học viên hiện ở đây."
                : "Hoặc thêm thẻ mới. Bản xem trước cho học viên cập nhật theo từng ký tự bạn gõ."
            }
            action={
              !readOnly && !isLoading && !loadError ? (
                <Button type="button" variant="outline" onClick={() => void requestSelection({ mode: "new" })}>
                  <Plus aria-hidden="true" /> Thêm thẻ
                </Button>
              ) : null
            }
          />
        }
      />

      <Dialog open={!!deleting && !readOnly} onOpenChange={(open) => !open && !isDeleting && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa thẻ từ vựng</DialogTitle>
            <DialogDescription>
              Thẻ <span className="font-bold text-slate-900">{deleting?.front_content.word}</span> sẽ bị xóa
              khỏi bài học.
            </DialogDescription>
          </DialogHeader>
          {isPublished ? <PublishedImpactNotice>{PUBLISHED_DELETE_IMPACT.card}</PublishedImpactNotice> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
