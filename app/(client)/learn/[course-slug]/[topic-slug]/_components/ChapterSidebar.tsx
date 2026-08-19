"use client";

import Link from "next/link";
import { PlayCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { LearningWorkspaceData } from "@/lib/schemas/learning-workspace";

interface ChapterSidebarProps {
  courseSlug: string;
  syllabus: LearningWorkspaceData["syllabus"];
  expandedChapter: string;
  setExpandedChapter: (id: string) => void;
  currentLessonSlug: string;
}

export default function ChapterSidebar({
  courseSlug,
  syllabus,
  expandedChapter,
  setExpandedChapter,
  currentLessonSlug,
}: ChapterSidebarProps) {
  return (
    <div className="animate-in space-y-4 fade-in duration-300">
      <h3 className="text-lg font-bold text-slate-900">Duyệt chương học</h3>
      <Accordion
        type="single"
        collapsible
        value={expandedChapter}
        onValueChange={setExpandedChapter}
        className="mt-4 w-full space-y-3"
      >
        {syllabus.map((chapter) => (
          <AccordionItem
            key={chapter.id}
            value={chapter.id}
            className="rounded-xl border border-slate-200 bg-white px-4 transition-colors hover:border-emerald-300 data-[state=open]:border-emerald-400"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <span className="text-sm font-bold text-slate-800">
                {chapter.title}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1">
              <div className="flex flex-col gap-2">
                {chapter.topics.map((topic) => {
                  const isActive = currentLessonSlug === topic.slug;
                  return (
                    <Link
                      key={topic.id}
                      href={`/learn/${courseSlug}/${topic.slug}`}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                        isActive
                          ? "border-emerald-200 bg-emerald-50 shadow-sm"
                          : "border-transparent bg-transparent hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <PlayCircle
                          aria-hidden="true"
                          className={`size-4 shrink-0 transition-colors ${
                            isActive
                              ? "text-emerald-500"
                              : "text-slate-400 group-hover:text-emerald-500"
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            isActive
                              ? "font-bold text-emerald-700"
                              : "font-medium text-slate-700"
                          }`}
                        >
                          {topic.title}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
