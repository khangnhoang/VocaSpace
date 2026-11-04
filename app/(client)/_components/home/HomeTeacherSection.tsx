import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTeacherCourseListPath } from "@/lib/course-authoring/routes";
import { cn } from "@/lib/utils";
import { HOME_CONTAINER, HOME_EYEBROW, HOME_SECTION_TITLE } from "./home-layout";

export const TEACHER_SECTION_ID = "danh-cho-giao-vien";

// Ví dụ minh họa cấu trúc khóa → chương → chủ đề; không đọc dữ liệu thật.
const SAMPLE_STRUCTURE = [
  { label: "Chương 1 · Văn phòng", level: 1, state: "published" },
  { label: "Họp và thuyết trình · 24 thẻ", level: 2, state: "published" },
  { label: "Email công việc · 18 thẻ", level: 2, state: "editing" },
  { label: "Chương 2 · Đi lại", level: 1, state: "draft" },
] as const;

const STATE_LABEL = {
  published: { text: "Đã đăng", className: "text-growth" },
  editing: { text: "Đang soạn", className: "text-route" },
  draft: { text: "Bản nháp", className: "text-slate-500" },
} as const;

type HomeTeacherSectionProps = {
  isTeacher: boolean;
};

export default function HomeTeacherSection({ isTeacher }: HomeTeacherSectionProps) {
  return (
    <section id={TEACHER_SECTION_ID} aria-labelledby="home-teacher-title" className="scroll-mt-20 pb-12 sm:pb-16">
      <div className={HOME_CONTAINER}>
        <div className="grid grid-cols-1 items-center gap-10 rounded-2xl border border-slate-200 bg-white p-6 sm:rounded-3xl sm:p-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className={HOME_EYEBROW}>Dành cho giáo viên</p>
            <h2 id="home-teacher-title" className={cn("mt-2", HOME_SECTION_TITLE)}>
              Soạn khóa học theo chương và chủ đề
            </h2>
            <p className="mt-3 max-w-[34em] text-base leading-[26px] text-slate-600">
              Sắp xếp nội dung thành chương, chủ đề và bộ thẻ. Học viên học theo đúng thứ tự bạn đặt ra.
            </p>
            {isTeacher ? (
              <Button asChild size="lg" className="mt-6">
                <Link href={getTeacherCourseListPath()}>
                  Mở khu soạn khóa học
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <p className="mt-6 text-sm font-semibold text-slate-600">Tài khoản giáo viên do VocaSpace cấp.</p>
            )}
          </div>
          <div aria-label="Ví dụ cấu trúc khóa học" role="group" className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="flex items-center gap-3 py-2 text-sm font-bold text-slate-900">
              <BookOpen aria-hidden="true" className="size-4 shrink-0" />
              TOEIC 600: từ vựng cốt lõi
            </p>
            <ul>
              {SAMPLE_STRUCTURE.map((row) => (
                <li
                  key={row.label}
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
                  <span className="min-w-0 flex-1">{row.label}</span>
                  {row.level === 1 || row.state === "editing" ? (
                    <span className={cn("shrink-0 text-xs font-semibold leading-4", STATE_LABEL[row.state].className)}>
                      {STATE_LABEL[row.state].text}
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
