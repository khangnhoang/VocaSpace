import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PlayCircle,
  GraduationCap,
  Dumbbell,
  Lock,
  CheckCircle,
} from "lucide-react";

interface Topic {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "pending" | "published";
  topic_type?: "video" | "vocabulary" | "exercise";
  is_free_preview?: boolean;
}

interface Chapter {
  id: string;
  title: string;
  topics: Topic[];
}

interface SyllabusAccordionProps {
  syllabus: Chapter[];
}

export default function SyllabusAccordion({
  syllabus,
}: SyllabusAccordionProps) {
  const getIcon = (type?: string) => {
    if (type === "video")
      return <PlayCircle size={18} className="text-blue-500" />;
    if (type === "exercise")
      return <Dumbbell size={18} className="text-orange-500" />;
    return <GraduationCap size={18} className="text-emerald-500" />;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xl font-bold text-slate-800 mb-4">
        Đề cương khóa học
      </h3>
      <Accordion type="single" collapsible className="w-full space-y-3">
        {syllabus.map((chapter) => (
          <AccordionItem
            key={chapter.id}
            value={chapter.id}
            className="border border-slate-200 rounded-2xl px-4 bg-white shadow-sm data-[state=open]:border-emerald-400 transition-colors"
          >
            <AccordionTrigger className="hover:no-underline py-4 text-left">
              <span className="font-bold text-slate-800 text-sm md:text-base">
                {chapter.title}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 border-t border-slate-50 mt-1">
              <div className="flex flex-col gap-1.5 mt-2">
                {chapter.topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-transparent bg-slate-50/50 hover:bg-slate-50 border-slate-100 transition-all text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {getIcon(topic.topic_type)}
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {topic.title}
                      </span>
                    </div>

                    <div className="shrink-0 ml-4">
                      {topic.is_free_preview ? (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          Học thử miễn phí
                        </span>
                      ) : (
                        <Lock size={14} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
