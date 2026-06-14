"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCoursesForTeacher } from "@/app/actions/course";
import { getCourseStats } from "@/app/actions/topic";
import type { TeacherCourse } from "@/lib/schemas/course";
import CourseOverview, {
  type CourseWorkspaceStats,
} from "./_components/CourseOverview";

export default function CourseOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;
  const [course, setCourse] = useState<TeacherCourse | null>(null);
  const [stats, setStats] = useState<CourseWorkspaceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadOverview = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const coursesRes = await getCoursesForTeacher();
      if (!isMounted) return;

      if (coursesRes.error) {
        setErrorMessage(coursesRes.error);
        toast.error(coursesRes.error);
        setIsLoading(false);
        return;
      }

      const matchedCourse =
        coursesRes.data?.find((item) => item.id === courseId) ?? null;

      if (!matchedCourse) {
        setErrorMessage(
          "Khóa học không tồn tại hoặc bạn không có quyền truy cập.",
        );
        setIsLoading(false);
        return;
      }

      setCourse(matchedCourse);

      const statsRes = await getCourseStats(courseId);
      if (!isMounted) return;

      setStats(statsRes);
      setIsLoading(false);
    };

    loadOverview();

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] text-blue-600">
        <Loader2 className="size-10 animate-spin" aria-label="Đang tải tổng quan khóa học" />
      </div>
    );
  }

  if (!course || errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">
            Không thể mở tổng quan khóa học
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {errorMessage ?? "Vui lòng quay lại danh sách khóa học và thử lại."}
          </p>
          <Link
            href="/courses"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-bold text-white hover:bg-[#2563EB]"
          >
            Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  return <CourseOverview course={course} stats={stats} />;
}
