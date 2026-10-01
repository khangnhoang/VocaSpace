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
      className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-900"
      aria-label="Quay về structure workspace"
    >
      <ArrowLeft size={20} />
    </Link>
  );
}
