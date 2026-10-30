"use client";

import Image from "next/image";
import { AlertTriangle, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { TopicWorkflow } from "@/lib/schemas/topic-workflow";
import TopicAuthorshipSection from "./TopicAuthorshipSection";
import TopicReviewNotes, { useTopicReviewNotesSummary } from "./TopicReviewNotes";

interface TopicTeamAndNotesProps {
  workflow: TopicWorkflow;
  onRefresh: () => void;
}

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
 * Nút "Nhóm tác giả" ở header mở một side sheet chứa cả nhóm tác giả và ghi chú duyệt, để hai phần
 * này không chiếm chỗ của nội dung đang soạn. Ghi chú không có nút riêng nên số ghi chú và lỗi tải
 * ghi chú hiện ngay trên nút này, kẻo có ghi chú mới mà người soạn không biết.
 */
export default function TopicTeamAndNotes({ workflow, onRefresh }: TopicTeamAndNotesProps) {
  const notes = useTopicReviewNotesSummary();
  const people = [workflow.responsibleAuthor, workflow.originalCreator, ...workflow.contributors].filter(
    (person, index, all) => all.findIndex((other) => other.userId === person.userId) === index,
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-9">
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
          {notes.hasReadError ? (
            <>
              <AlertTriangle className="text-correction" aria-hidden="true" />
              <span className="sr-only">, chưa tải được ghi chú</span>
            </>
          ) : notes.count ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 text-xs font-bold tabular-nums text-slate-700">
              <MessageSquare className="size-3" aria-hidden="true" />
              {notes.count}
              <span className="sr-only"> ghi chú</span>
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg motion-reduce:animate-none"
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
          <div className="py-4">
            <TopicAuthorshipSection workflow={workflow} onRefresh={onRefresh} />
          </div>
          <div className="py-4 empty:hidden">
            <TopicReviewNotes />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
