"use client";

import Link from "next/link";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { useTranslations } from "next-intl";
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
  completedTopicIds: ReadonlySet<string>;
}

export default function ChapterSidebar({
  courseSlug,
  syllabus,
  expandedChapter,
  setExpandedChapter,
  currentLessonSlug,
  completedTopicIds,
}: ChapterSidebarProps) {
  const t = useTranslations("learn");
  return (
    <div>
      <Accordion
        type="single"
        collapsible
        value={expandedChapter}
        onValueChange={setExpandedChapter}
        className="w-full space-y-3"
      >
        {syllabus.map((chapter) => (
          <AccordionItem
            key={chapter.id}
            value={chapter.id}
            className="rounded-lg border border-slate-200 bg-white px-4 transition-[border-color] duration-[120ms] hover:border-slate-300 data-[state=open]:border-route-line"
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
                  const isCompleted = completedTopicIds.has(topic.id);
                  return (
                    <Link
                      key={topic.id}
                      href={`/learn/${courseSlug}/${topic.slug}`}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex min-h-11 w-full items-center justify-between rounded-lg border p-3 text-left transition-[background-color,border-color] duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                        isActive
                          ? "border-route-line bg-route-quiet"
                          : "border-transparent bg-transparent hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {isCompleted ? (
                          <CheckCircle2
                            aria-hidden="true"
                            className="size-4 shrink-0 text-growth"
                          />
                        ) : (
                          <PlayCircle
                            aria-hidden="true"
                            className={`size-4 shrink-0 transition-colors duration-[120ms] ${
                              isActive
                                ? "text-route"
                                : "text-slate-500 group-hover:text-route"
                            }`}
                          />
                        )}
                        <span
                          className={`text-sm ${
                            isActive
                              ? "font-bold text-route"
                              : "font-medium text-slate-700"
                          }`}
                        >
                          {topic.title}
                          {isCompleted && (
                            <span className="sr-only"> ({t("workspace.sidebar.completed")})</span>
                          )}
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
