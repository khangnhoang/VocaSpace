"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCourseStructurePath } from "@/lib/course-authoring/routes";

export default function BackButton({ courseId }: { courseId: string }) {
  return (
    <Link
      href={getCourseStructurePath(courseId)}
      className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-900"
      aria-label="Quay về structure workspace"
    >
      <ArrowLeft size={20} />
    </Link>
  );
}
