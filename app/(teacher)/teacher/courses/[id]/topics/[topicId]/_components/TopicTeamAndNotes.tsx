"use client";

import { useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { AlertTriangle, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { TopicWorkflow } from "@/lib/schemas/topic-workflow";
import TopicAuthorshipSection from "./TopicAuthorshipSection";
import TopicReviewNotes, { useTopicReviewNotesSummary } from "./TopicReviewNotes";

interface TopicTeamAndNotesProps {
  workflow: TopicWorkflow;
  onRefresh: () => void;
}

type SheetSection = "team" | "notes";

function PersonAvatar({ person }: { person: TopicWorkflow["responsibleAuthor"] }) {
  const className = "-ml-1.5 size-5 rounded-full ring-2 ring-white first:ml-0";
  if (person.avatarUrl) {
    return <Image src={person.avatarUrl} alt="" width={20} height={20} unoptimized className={`${className} object-cover`} />;
  }
  const name = person.fullName?.trim() || person.email || "?";
  return (
    <span className={`${className} flex items-center justify-center bg-route-quiet text-[11px] font-bold text-route`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Hai nút trong header mở chung một side sheet, để nhóm tác giả và ghi chú duyệt
 * không chiếm chỗ của phần soạn nội dung. Mở bằng nút nào thì focus (và cuộn) tới
 * đúng mục đó.
 */
export default function TopicTeamAndNotes({ workflow, onRefresh }: TopicTeamAndNotesProps) {
  const notes = useTopicReviewNotesSummary();
  const [section, setSection] = useState<SheetSection | null>(null);
  const teamRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const people = [workflow.responsibleAuthor, workflow.originalCreator, ...workflow.contributors].filter(
    (person, index, all) => all.findIndex((other) => other.userId === person.userId) === index,
  );

  const openSection = (next: SheetSection) => (event: MouseEvent<HTMLButtonElement>) => {
    returnFocusRef.current = event.currentTarget;
    setSection(next);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        onClick={openSection("team")}
        className="min-h-11 sm:min-h-9"
      >
        <span className="flex" aria-hidden="true">
          {people.slice(0, 3).map((person) => (
            <PersonAvatar key={person.userId} person={person} />
          ))}
        </span>
        Nhóm tác giả
        <span className="sr-only">{`, ${people.length} người`}</span>
        {workflow.latestAuthorshipFeedback ? (
          <>
            <span className="size-2 rounded-full bg-attention" aria-hidden="true" />
            <span className="sr-only">, có cập nhật cần xử lý</span>
          </>
        ) : null}
      </Button>
      {notes.isVisible ? (
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          onClick={openSection("notes")}
          className="min-h-11 sm:min-h-9"
        >
          {notes.hasReadError ? (
            <AlertTriangle className="text-correction" aria-hidden="true" />
          ) : (
            <MessageSquare aria-hidden="true" />
          )}
          Ghi chú
          {notes.hasReadError ? <span className="sr-only">, chưa tải được</span> : null}
          {notes.count !== null ? (
            <span className="rounded-md bg-slate-100 px-1.5 text-xs font-bold tabular-nums text-slate-700">
              <span className="sr-only">: </span>
              {notes.count}
            </span>
          ) : null}
        </Button>
      ) : null}

      <Sheet
        open={section !== null}
        onOpenChange={(open) => {
          if (!open) setSection(null);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg motion-reduce:animate-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (section === "notes" ? notesRef : teamRef).current?.focus();
          }}
          // Sheet không có Trigger của Radix (hai nút cùng mở), nên phải tự trả focus về nút đã bấm.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <div className="flex items-start gap-2 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-bold text-slate-900">Nhóm tác giả và ghi chú</SheetTitle>
              <SheetDescription className="truncate text-sm text-slate-600">{workflow.title}</SheetDescription>
            </div>
            <SheetClose asChild>
              <Button type="button" variant="ghost" size="icon-lg" aria-label="Đóng" className="-mt-1 -mr-2 shrink-0">
                <X aria-hidden="true" />
              </Button>
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-slate-200 overflow-y-auto px-4">
            <div ref={teamRef} tabIndex={-1} className="py-4 outline-none">
              <TopicAuthorshipSection workflow={workflow} onRefresh={onRefresh} />
            </div>
            <div ref={notesRef} tabIndex={-1} className="py-4 outline-none empty:hidden">
              <TopicReviewNotes />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
