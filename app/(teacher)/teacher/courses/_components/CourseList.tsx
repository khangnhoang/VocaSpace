import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Settings, Trash2 } from "lucide-react";
import CourseThumbnail from "./CourseThumbnail";
import { Button } from "@/components/ui/button";
import { getCourseOverviewPath } from "@/lib/course-authoring/routes";
import { courseRoleLabels, courseStatusLabels } from "@/lib/course-authoring/portfolio";
import type { TeacherCourse } from "@/lib/schemas/course";

interface CourseListProps {
  coursesList: TeacherCourse[];
  isLoadingData: boolean;
  isPending: boolean;
  courseToDelete: TeacherCourse | null;
  setCourseToDelete: (course: TeacherCourse | null) => void;
  onEditCourse: (course: TeacherCourse) => void;
}

export default function CourseList({ coursesList, isLoadingData, isPending, courseToDelete, setCourseToDelete, onEditCourse }: CourseListProps) {
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = viewport.current;
    if (!region) return;
    const rows = Array.from(region.querySelectorAll('li')).slice(0, 2);
    const measure = () => {
      if (!rows.length) return;
      // Đo hai dòng thật để tên dài, lý do từ chối và button touch không bị cắt cố định.
      const height = rows[rows.length - 1].getBoundingClientRect().bottom - rows[0].getBoundingClientRect().top;
      if (height > 0) region.style.setProperty('--course-list-preview-height', `${height + 2}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    rows.forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [coursesList]);
  if (isLoadingData) return <p role="status" className="p-8 text-center text-slate-600">Đang tải khóa học…</p>;
  if (!coursesList.length) return null;

  return (
    <div className="space-y-2">
    {coursesList.length > 2 ? <p className="text-xs leading-5 text-slate-600">Cuộn trong danh sách để xem các khóa học còn lại.</p> : null}
    <div ref={viewport} role="region" aria-label="Kết quả khóa học" tabIndex={0} className="max-h-[min(var(--course-list-preview-height,20rem),70svh)] overflow-y-auto overscroll-y-contain rounded-2xl border border-slate-300 bg-white [overflow-anchor:none] [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route">
    <ul aria-label="Danh sách khóa học" className="divide-y divide-slate-200">
      {coursesList.map((course) => {
        const reason = course.status === "draft" && course.reviewed_at ? course.reject_message?.trim() : null;
        return (
          <li key={course.id} className="p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="relative hidden size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-600 md:flex">
                <CourseThumbnail src={course.thumbnail_url} sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={getCourseOverviewPath(course.id)} className="block rounded-sm font-semibold leading-6 text-slate-900 hover:text-route focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-route [overflow-wrap:anywhere]">{course.title}</Link>
                <p className="mt-1 text-sm leading-6 text-slate-600">{courseRoleLabels[course.my_role]} <span aria-hidden="true">·</span> {courseStatusLabels[course.status]}</p>
                {reason ? <div className="mt-3 rounded-lg border border-correction-line bg-correction-quiet p-3 text-sm leading-6 text-correction"><p className="font-semibold">Khóa học cần chỉnh sửa</p><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{reason}</p><p className="mt-1">Vui lòng cập nhật nội dung khóa học rồi gửi lại để xét duyệt.</p></div> : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 md:pl-18">
              <Button asChild variant="link" className="px-0 coarse-input:h-11 coarse-input:bg-action coarse-input:px-5 coarse-input:text-action-foreground coarse-input:hover:no-underline"><Link href={getCourseOverviewPath(course.id)} aria-label={`Mở tổng quan khóa học ${course.title}`}>Mở khóa học <ArrowUpRight className="size-4.5 coarse-input:size-5" aria-hidden="true" /></Link></Button>
              {course.my_role !== "previewer" ? <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="text-slate-600 coarse-input:size-11 coarse-input:border-slate-300" disabled={isPending} aria-label={`Cài đặt thông tin khóa học ${course.title}`} onClick={() => onEditCourse(course)}><Settings className="size-4.5 coarse-input:size-5" aria-hidden="true" /></Button>
                <Button variant="destructive-quiet" size="icon" className="coarse-input:size-11 coarse-input:border-slate-300" disabled={isPending} aria-label={`Đưa khóa học vào thùng rác: ${course.title}`} onClick={() => setCourseToDelete(course)}>{isPending && courseToDelete?.id === course.id ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : <Trash2 className="size-4.5 coarse-input:size-5" aria-hidden="true" />}</Button>
              </div> : null}
            </div>
          </li>
        );
      })}
    </ul>
    </div>
    </div>
  );
}
