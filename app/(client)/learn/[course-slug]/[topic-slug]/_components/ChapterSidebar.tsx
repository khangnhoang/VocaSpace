"use client";
import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlayCircle } from "lucide-react";
import { ChapterSyllabusDTO, TopicSyllabusDTO } from "@/lib/schemas/learn";

interface ChapterSidebarProps {
  syllabus: ChapterSyllabusDTO[];
  expandedChapter: string;
  setExpandedChapter: (id: string) => void;
  currentLessonSlug: string;
  setCurrentLessonSlug: (slug: string) => void;
}

export default function ChapterSidebar({
  syllabus, expandedChapter, setExpandedChapter, currentLessonSlug, setCurrentLessonSlug,
}: ChapterSidebarProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h3 className="font-bold text-slate-900 text-lg">Duyệt chương học</h3>
      <Accordion type="single" collapsible value={expandedChapter} onValueChange={setExpandedChapter} className="w-full space-y-3 mt-4">
        {syllabus.map((chapter) => (
          <AccordionItem key={chapter.id} value={chapter.id} className="border border-slate-200 rounded-xl px-4 bg-white hover:border-emerald-300 transition-colors data-[state=open]:border-emerald-400">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="font-bold text-slate-800 text-sm">{chapter.title}</span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1">
              <div className="flex flex-col gap-2">
                {chapter.topics.map((topic: TopicSyllabusDTO) => {
                  const isActive = currentLessonSlug === topic.slug;
                  return (
                    <button
                      key={topic.id}
                      onClick={() => { setCurrentLessonSlug(topic.slug); setExpandedChapter(chapter.id); }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left group ${isActive ? "bg-emerald-50 border-emerald-200 shadow-sm" : "bg-transparent border-transparent hover:bg-slate-50"}`}
                    >
                      <div className="flex items-center gap-3">
                        <PlayCircle size={16} className={`shrink-0 transition-colors ${isActive ? "text-emerald-500" : "text-slate-400 group-hover:text-emerald-500"}`} />
                        <span className={`text-sm ${isActive ? "text-emerald-700 font-bold" : "text-slate-700 font-medium"}`}>{topic.title}</span>
                      </div>
                    </button>
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