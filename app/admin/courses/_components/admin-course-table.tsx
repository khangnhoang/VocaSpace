import React, { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import type { Course } from "@/types/database";
import type { AdminCourseStatusFilter } from "./admin-course-toolbar";

export type AdminCourse = Course & {
  enrollments_count?: number | null;
};

interface AdminCourseTableProps {
  courses: AdminCourse[];
  statusFilter: AdminCourseStatusFilter;
  searchQuery: string;
  onResetFilters: () => void;
  onAccept: (course: AdminCourse) => void;
  onReject: (course: AdminCourse) => void;
}

const statusFilterLabels: Record<AdminCourseStatusFilter, string> = {
  all: "Tất cả",
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Xuất bản",
};

function formatVnd(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  if (value === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function formatEnrollmentCount(value: number | null | undefined) {
  if (typeof value === "number") return value;
  return "-";
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "published")
    return (
      <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20 transition-colors">
        Xuất bản
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/20 transition-colors">
        Chờ duyệt
      </Badge>
    );
  if (status === "draft")
    return (
      <Badge className="bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border-slate-500/20 transition-colors">
        Bản nháp
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-slate-700 text-slate-400">
      Không rõ
    </Badge>
  );
}

export function AdminCourseTable({
  courses,
  statusFilter,
  searchQuery,
  onResetFilters,
  onAccept,
  onReject,
}: AdminCourseTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(courses.length / itemsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentCourses = courses.slice(startIndex, startIndex + itemsPerPage);
  const trimmedSearchQuery = searchQuery.trim();
  const hasActiveFilters = statusFilter !== "all" || trimmedSearchQuery.length > 0;

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 border border-slate-800 rounded-2xl bg-[#111827] shadow-sm text-center">
        <div className="h-16 w-16 bg-[#1E293B] rounded-full flex items-center justify-center mb-4">
          <Inbox className="h-8 w-8 text-slate-500" aria-hidden="true" />
        </div>
        <p className="text-slate-200 text-sm font-semibold">
          Không tìm thấy khóa học phù hợp.
        </p>
        <p className="text-slate-400 text-sm mt-2 max-w-md">
          {hasActiveFilters
            ? `Không có kết quả cho bộ lọc ${statusFilterLabels[
                statusFilter
              ].toLowerCase()}${
                trimmedSearchQuery ? ` và từ khóa "${trimmedSearchQuery}"` : ""
              }.`
            : "Hiện chưa có khóa học nào trong danh sách quản trị."}
        </p>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={onResetFilters}
            className="mt-5 bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            Xóa bộ lọc
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table
          className="w-full caption-bottom text-sm table-fixed min-w-[900px]"
          aria-label="Bảng quản lý khóa học"
        >
          <thead className="[&_tr]:border-b border-slate-800 bg-[#0B1120]">
            <tr className="border-b transition-colors">
              <th className="w-[35%] h-14 px-6 text-left align-middle text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Khóa học
              </th>
              <th className="w-[11%] h-14 px-6 text-left align-middle text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Giá bán
              </th>
              <th className="w-[12%] h-14 px-6 text-left align-middle text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Trạng thái
              </th>
              <th className="w-[10%] h-14 px-6 text-center align-middle text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Học viên
              </th>
              <th className="w-[18%] h-14 px-6 text-left align-middle text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Ngày gửi duyệt
              </th>
              <th className="w-[14%] h-14 px-6 text-right align-middle text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0 text-slate-300">
            {currentCourses.map((course) => (
              <tr
                key={course.id}
                className="border-b border-slate-800 transition-colors hover:bg-[#1E293B]/50 group"
              >
                <td className="p-6 align-middle">
                  <div className="flex items-center gap-4">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 border border-slate-700 group-hover:border-slate-600 transition-colors">
                      {course.thumbnail_url ? (
                        <Image
                          src={course.thumbnail_url}
                          alt={course.title}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-200 truncate mb-1 group-hover:text-white transition-colors">
                        {course.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {course.slug}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="p-6 align-middle font-medium text-slate-300">
                  {formatVnd(course.price)}
                </td>

                <td className="p-6 align-middle">
                  <StatusBadge status={course.status} />
                </td>

                <td className="p-6 align-middle text-slate-400 font-medium text-center">
                  {formatEnrollmentCount(course.enrollments_count)}
                </td>

                <td className="p-6 align-middle text-slate-400 text-xs">
                  {formatDateTime(course.submitted_at)}
                </td>

                <td className="p-6 align-middle text-right">
                  {course.status === "pending" && (
                    <div className="flex items-center justify-end gap-2 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                      <Button
                        type="button"
                        size="icon"
                        className="h-9 w-9 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all rounded-lg shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
                        onClick={() => onAccept(course)}
                        title="Duyệt khóa học"
                        aria-label={`Duyệt khóa học ${course.title}`}
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        className="h-9 w-9 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all rounded-lg shadow-sm focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
                        onClick={() => onReject(course)}
                        title="Từ chối khóa học"
                        aria-label={`Từ chối khóa học ${course.title}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {courses.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#0B1120]">
          <div className="text-sm text-slate-400 hidden sm:block">
            Hiển thị{" "}
            <span className="font-medium text-slate-200">{startIndex + 1}</span>{" "}
            -{" "}
            <span className="font-medium text-slate-200">
              {Math.min(startIndex + itemsPerPage, courses.length)}
            </span>{" "}
            trong tổng số{" "}
            <span className="font-medium text-slate-200">{courses.length}</span>{" "}
            khóa học
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
              disabled={safeCurrentPage === 1}
              className="h-9 px-3 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Trước
            </Button>
            <div className="text-sm font-medium text-slate-300">
              Trang {safeCurrentPage} / {totalPages || 1}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))
              }
              disabled={safeCurrentPage === totalPages || totalPages === 0}
              className="h-9 px-3 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              Sau <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
