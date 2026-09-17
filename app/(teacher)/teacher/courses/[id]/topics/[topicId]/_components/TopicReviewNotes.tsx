"use client";

import Image from "next/image";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  createReviewNote,
  removeReviewNote,
  updateReviewNote,
} from "@/app/actions/review-notes";
import type { TopicReviewNote } from "@/lib/schemas/review-notes";

interface TopicReviewNotesValue {
  topicId: string;
  notes: TopicReviewNote[] | null;
  readError: string | null;
  currentUserId: string;
  canRead: boolean;
  canReview: boolean;
}

const TopicReviewNotesContext = createContext<TopicReviewNotesValue | null>(null);

interface TopicReviewNotesProviderProps extends TopicReviewNotesValue {
  children: ReactNode;
}

/**
 * `TopicBuilderTabs` là component duy nhất render `TopicWorkflowPanel`, nhưng nó
 * là component dùng chung nên không nhận thêm prop riêng cho ghi chú. Vì vậy dữ
 * liệu ghi chú đã đọc ở server component `page.tsx` được truyền xuống panel qua
 * context thay vì prop trung gian, và panel vẫn render `TopicReviewNotes` không đổi.
 */
export function TopicReviewNotesProvider({
  children,
  ...value
}: TopicReviewNotesProviderProps) {
  return (
    <TopicReviewNotesContext.Provider value={value}>
      {children}
    </TopicReviewNotesContext.Provider>
  );
}

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ngày trước`;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function displayName(identity: TopicReviewNote["author"] | null, fallback: string) {
  if (!identity) return fallback;
  return identity.fullName?.trim() || identity.email || fallback;
}

function initialsOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

function targetLabel(note: TopicReviewNote) {
  if (note.cardId && note.cardTitle) return `Flashcard: ${note.cardTitle}`;
  if (note.exerciseId && note.exerciseTitle) return `Bài tập: ${note.exerciseTitle}`;
  return null;
}

export default function TopicReviewNotes() {
  const value = useContext(TopicReviewNotesContext);
  const router = useRouter();
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Khi đường đọc lỗi, `page.tsx` gửi `canRead=false` kèm `readError`. Lỗi phải
  // hiện thành state riêng (Fail Loud); nếu xét `canRead` trước thì cả mục biến
  // mất im lặng và người đọc tưởng bài học chưa có ghi chú nào.
  if (!value || (!value.canRead && !value.readError)) return null;

  const { topicId, notes, readError, currentUserId, canReview } = value;

  const submitNote = () => {
    const trimmed = body.trim();
    if (trimmed.length === 0 || isPending) return;
    startTransition(async () => {
      const result = await createReviewNote({ topicId, body });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã gửi ghi chú.");
      setBody("");
      router.refresh();
    });
  };

  const submitEdit = (noteId: string) => {
    const trimmed = editingBody.trim();
    if (trimmed.length === 0 || isPending) return;
    startTransition(async () => {
      const result = await updateReviewNote({ noteId, body: editingBody });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã cập nhật ghi chú.");
      setEditingId(null);
      setEditingBody("");
      router.refresh();
    });
  };

  const submitRemove = (noteId: string) => {
    if (isPending) return;
    startTransition(async () => {
      const result = await removeReviewNote({ noteId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã xóa ghi chú.");
      setRemovingId(null);
      router.refresh();
    });
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
      aria-labelledby="topic-review-notes-title"
    >
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="size-4 text-slate-600" />
        <h3 id="topic-review-notes-title" className="text-sm font-bold text-slate-900">
          Ghi chú phản hồi{notes ? ` (${notes.length})` : ""}
        </h3>
      </div>

      {readError ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">{readError}</p>
      ) : null}

      {canReview ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Ghi lại điều cần lưu ý cho bài học này..."
            maxLength={2000}
            aria-label="Nội dung ghi chú"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Ghi chú không chặn hay duyệt bài học.</p>
            <Button
              type="button"
              size="sm"
              onClick={submitNote}
              disabled={isPending || body.trim().length === 0}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isPending ? "Đang gửi..." : "Gửi ghi chú"}
            </Button>
          </div>
        </div>
      ) : null}

      {!notes ? null : notes.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          Chưa có ghi chú nào cho bài học này.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {notes.map((note) => {
            const authorName = displayName(note.author, "Người dùng ẩn");
            const removedByName = displayName(note.removedBy, "không còn trong hệ thống");
            const isOwnNote = note.author.userId === currentUserId;
            const label = targetLabel(note);

            return (
              <li key={note.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex items-start gap-3">
                  {note.author.avatarUrl ? (
                    <Image
                      src={note.author.avatarUrl}
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                      className="size-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                      {initialsOf(authorName)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-slate-900">{authorName}</p>
                      <p className="text-xs text-slate-500">{formatRelativeTime(note.createdAt)}</p>
                      {note.isEdited && note.removedAt === null ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          đã chỉnh sửa
                        </span>
                      ) : null}
                    </div>

                    {label ? (
                      <p className="mt-1 text-xs font-medium text-blue-700">{label}</p>
                    ) : null}

                    {note.removedAt ? (
                      <p className="mt-1 text-sm italic text-slate-600">
                        {`Ghi chú đã bị xóa bởi ${removedByName}`}
                      </p>
                    ) : editingId === note.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editingBody}
                          onChange={(event) => setEditingBody(event.target.value)}
                          maxLength={2000}
                          aria-label="Nội dung ghi chú đang sửa"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => submitEdit(note.id)}
                            disabled={isPending || editingBody.trim().length === 0}
                          >
                            {isPending ? "Đang lưu..." : "Lưu"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingId(null); setEditingBody(""); }}
                            disabled={isPending}
                          >
                            Hủy
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm leading-6 wrap-break-word text-slate-800">
                        {note.body}
                      </p>
                    )}

                    {isOwnNote && note.removedAt === null && editingId !== note.id ? (
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingId(note.id); setEditingBody(note.body); }}
                          disabled={isPending}
                        >
                          <Pencil className="size-3.5" /> Sửa
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-rose-700 hover:bg-rose-50"
                          onClick={() => setRemovingId(note.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="size-3.5" /> Xóa
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={removingId !== null} onOpenChange={(open) => !isPending && !open && setRemovingId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Xóa ghi chú</DialogTitle>
            <DialogDescription>
              Ghi chú sẽ được đánh dấu đã xóa và vẫn hiển thị với người xem. Không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemovingId(null)} disabled={isPending}>
              Giữ lại
            </Button>
            <Button
              type="button"
              onClick={() => removingId && submitRemove(removingId)}
              disabled={isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {isPending ? "Đang xóa..." : "Xóa ghi chú"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
