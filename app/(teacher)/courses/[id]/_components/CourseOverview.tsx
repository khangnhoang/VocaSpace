"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, FileText, Layers, Library, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeacherCourse } from "@/lib/schemas/course";
import { getCourseStructurePath } from "./topic-builder-path";

export type CourseWorkspaceStats = {
  chapters: number;
  topics: number;
  cards: number;
  exercises: number;
};

interface CourseOverviewProps {
  course: TeacherCourse;
  stats: CourseWorkspaceStats | null;
}

const statusLabels: Record<TeacherCourse["status"], string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Đã xuất bản",
};

const roleLabels: Record<TeacherCourse["my_role"], string> = {
  owner: "Chủ sở hữu",
  co_owner: "Đồng sở hữu",
  editor: "Biên tập viên",
  previewer: "Chỉ xem trước",
};

function formatPrice(price: number) {
  if (!price) return "Miễn phí";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

export default function CourseOverview({ course, stats }: CourseOverviewProps) {
  const structureHref = getCourseStructurePath(course.id);
  const overviewStats = [
    {
      label: "Chương",
      value: stats?.chapters ?? 0,
      icon: <Layers className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-blue-100 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/20",
      iconClassName:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      valueClassName: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Bài học",
      value: stats?.topics ?? 0,
      icon: <FileText className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20",
      iconClassName:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      valueClassName: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Flashcards",
      value: stats?.cards ?? 0,
      icon: <Library className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-amber-100 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20",
      iconClassName:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      valueClassName: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "Bài tập",
      value: stats?.exercises ?? 0,
      icon: <BookOpen className="size-4" aria-hidden="true" />,
      surfaceClassName:
        "border-rose-100 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20",
      iconClassName:
        "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
      valueClassName: "text-rose-700 dark:text-rose-300",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-6 text-slate-900 sm:px-6 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link href="/courses" className="hover:text-slate-900">
            Khóa học của tôi
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900">Tổng quan</span>
        </nav>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                  {statusLabels[course.status]}
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {roleLabels[course.my_role]}
                </span>
              </div>
              <div>
                <h1 className="break-words text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">
                  {course.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {course.description || "Khóa học chưa có mô tả."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
              <Button asChild variant="outline" size="lg" className="h-10">
                <Link href="/courses">
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Danh sách
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="h-10 bg-[#3B82F6] text-white hover:bg-[#2563EB]"
              >
                <Link href={structureHref}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Quản lý cấu trúc
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-950">
              Thông tin cơ bản
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Slug</dt>
                <dd className="break-all text-right font-semibold text-slate-900">
                  {course.slug}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Giá</dt>
                <dd className="font-semibold text-slate-900">
                  {formatPrice(course.price)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Thứ tự</dt>
                <dd className="font-semibold text-slate-900">
                  {course.order_index}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Tóm tắt nội dung
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Các số liệu này chỉ phản ánh cấu trúc authoring hiện có.
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 w-fit rounded-lg border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
              >
                <Link href={structureHref} aria-label="Mở structure workspace">
                  <Pencil className="size-4" aria-hidden="true" />
                  Mở structure workspace
                </Link>
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {overviewStats.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-lg border p-3 transition-colors ${item.surfaceClassName}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-8 items-center justify-center rounded-md ${item.iconClassName}`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-xs font-semibold">{item.label}</span>
                  </div>
                  <p className={`mt-2 text-2xl font-black ${item.valueClassName}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
