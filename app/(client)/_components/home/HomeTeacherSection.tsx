import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getTeacherCourseListPath } from "@/lib/course-authoring/routes";
import { cn } from "@/lib/utils";
import { HOME_CONTAINER, HOME_EYEBROW, HOME_SECTION_TITLE } from "./home-layout";

export const TEACHER_SECTION_ID = "danh-cho-giao-vien";

// Ví dụ minh họa cấu trúc khóa → chương → chủ đề; không đọc dữ liệu thật.
const SAMPLE_STRUCTURE = [
  { labelKey: "teacher.sampleChapter1", level: 1, state: "published" },
  { labelKey: "teacher.sampleTopic1", level: 2, state: "published" },
  { labelKey: "teacher.sampleTopic2", level: 2, state: "editing" },
  { labelKey: "teacher.sampleChapter2", level: 1, state: "draft" },
] as const;

const STATE_LABEL = {
  published: { textKey: "teacher.statePublished", className: "text-growth" },
  editing: { textKey: "teacher.stateEditing", className: "text-route" },
  draft: { textKey: "teacher.stateDraft", className: "text-slate-500" },
} as const;

type HomeTeacherSectionProps = {
  isTeacher: boolean;
};

export default function HomeTeacherSection({ isTeacher }: HomeTeacherSectionProps) {
  const t = useTranslations("home");
  return (
    <section id={TEACHER_SECTION_ID} aria-labelledby="home-teacher-title" className="scroll-mt-20 pb-12 sm:pb-16">
      <div className={HOME_CONTAINER}>
        <div className="grid grid-cols-1 items-center gap-10 rounded-2xl border border-slate-200 bg-white p-6 sm:rounded-3xl sm:p-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className={HOME_EYEBROW}>{t("teacher.eyebrow")}</p>
            <h2 id="home-teacher-title" className={cn("mt-2", HOME_SECTION_TITLE)}>
              {t("teacher.title")}
            </h2>
            <p className="mt-3 max-w-[34em] text-base leading-[26px] text-slate-600">
              {t("teacher.lead")}
            </p>
            {isTeacher ? (
              <Button asChild size="lg" className="mt-6 duration-[350ms]">
                <Link href={getTeacherCourseListPath()}>
                  {t("teacher.open")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <p className="mt-6 text-sm font-semibold text-slate-600">{t("teacher.notice")}</p>
            )}
          </div>
          <div aria-label={t("teacher.sampleLabel")} role="group" className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="flex items-center gap-3 py-2 text-sm font-bold text-slate-900">
              <BookOpen aria-hidden="true" className="size-4 shrink-0" />
              {t("teacher.sampleCourse")}
            </p>
            <ul>
              {SAMPLE_STRUCTURE.map((row) => (
                <li
                  key={row.labelKey}
                  className={cn(
                    "flex items-center gap-3 py-2 text-sm",
                    row.level === 1 ? "pl-6 text-slate-900" : "pl-12 text-slate-600",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2.5 shrink-0 rounded-full border-2",
                      row.state === "published" && "border-growth bg-growth",
                      row.state === "editing" && "border-route bg-route",
                      row.state === "draft" && "border-slate-300 bg-white",
                    )}
                  />
                  <span className="min-w-0 flex-1">{t(row.labelKey)}</span>
                  {row.level === 1 || row.state === "editing" ? (
                    <span className={cn("shrink-0 text-xs font-semibold leading-4", STATE_LABEL[row.state].className)}>
                      {t(STATE_LABEL[row.state].textKey)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
