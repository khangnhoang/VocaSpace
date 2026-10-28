"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCourseStructureChapterPath } from "@/lib/course-authoring/routes";

export default function BackButton({
  courseId,
  chapterId,
}: {
  courseId: string;
  chapterId: string;
}) {
  return (
    <Link
      href={getCourseStructureChapterPath(courseId, chapterId)}
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-route transition-colors duration-[120ms] outline-none hover:bg-route-quiet focus-visible:ring-2 focus-visible:ring-route motion-reduce:transition-none sm:min-h-8"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Cấu trúc khóa học
    </Link>
  );
}
