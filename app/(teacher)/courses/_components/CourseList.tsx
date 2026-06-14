import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pencil, Trash2, Loader2, Settings } from "lucide-react";

import type { TeacherCourse } from "@/lib/schemas/course";

interface CourseListProps {
  coursesList: TeacherCourse[];
  isLoadingData: boolean;
  isPending: boolean;
  courseToDelete: TeacherCourse | null;
  setCourseToDelete: (course: TeacherCourse | null) => void;
  onEditCourse: (course: TeacherCourse) => void;
}

export default function CourseList({
  coursesList,
  isLoadingData,
  isPending,
  courseToDelete,
  setCourseToDelete,
  onEditCourse,
}: CourseListProps) {
  const formatPrice = (price: number) => {
    if (!price || price === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: "Bản nháp",
      pending: "Chờ duyệt",
      pending_review: "Chờ duyệt",
      reviewing: "Đang xét duyệt",
      approved: "Đã duyệt",
      published: "Đã xuất bản",
      rejected: "Bị từ chối",
      archived: "Đã lưu trữ",
      private: "Riêng tư",
      public: "Công khai",
    };

    return statusMap[status.toLowerCase()] || status;
  };

  const getRejectionReason = (course: TeacherCourse) => {
    const reason = course.reject_message?.trim();

    if (course.status !== "draft" || !course.reviewed_at || !reason) {
      return null;
    }

    return reason;
  };

  if (isLoadingData) {
    return (
      <div className="flex justify-center items-center py-20 text-[#5FE8EF]">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (coursesList.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 font-medium bg-white rounded-2xl border border-dashed border-slate-300">
        Bạn chưa có khóa học nào. Hãy tạo khóa học đầu tiên nhé!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {coursesList.map((course) => {
        const rejectionReason = getRejectionReason(course);

        return (
          <Card
            key={course.id}
            className="w-full p-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all flex flex-col group"
          >
          <div className="w-full aspect-video bg-slate-100 overflow-hidden relative">
            <Image
              src={
                course.thumbnail_url ||
                "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80"
              }
              alt={course.title}
              fill
              // Thêm sizes để khắc phục lỗi thiếu thuộc tính sizes.
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              // Thêm priority để cải thiện LCP cho ảnh khóa học.
              priority={true}
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold rounded-md uppercase">
              {formatStatus(course.status)}
            </div>
          </div>
          <CardHeader className="p-4 pb-2 grow">
            {/* Hiển thị thông báo khi khóa học cần chỉnh sửa. */}
            {rejectionReason && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-bold text-red-800">
                  Khóa học cần chỉnh sửa
                </p>
                <p
                  className="text-xs text-red-600 mt-1 line-clamp-2"
                  title={rejectionReason}
                >
                  {rejectionReason}
                </p>
                <p className="text-[10px] text-red-500 mt-1 italic">
                  Vui lòng cập nhật nội dung khóa học rồi gửi lại để xét duyệt.
                </p>
              </div>
            )}

            <CardTitle
              className="text-lg font-bold text-slate-900 leading-tight line-clamp-2"
              title={course.title}
            >
              {course.title}
            </CardTitle>
            <CardDescription
              className="text-sm font-medium text-slate-600 mt-1 line-clamp-2"
              title={course.description || ""}
            >
              {course.description}
            </CardDescription>
          </CardHeader>
          <CardFooter className="p-4 pt-2 flex items-center justify-between bg-white border-t border-slate-50 mt-auto">
            <div className="font-bold text-[#5FAFFF]">
              {formatPrice(course.price)}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEditCourse(course)}
                className="p-2 text-slate-500 hover:text-[#00C4D4] hover:bg-[#5FE8EF]/10 rounded-md transition-colors cursor-pointer"
                title="Cài đặt thông tin khóa học"
              >
                <Settings size={18} strokeWidth={2.5} />
              </button>
              <Link href={`/courses/${course.id}`}>
                <button
                  className="p-2 text-slate-500 hover:text-[#00C4D4] hover:bg-[#5FE8EF]/10 rounded-md transition-colors cursor-pointer"
                  title="Xây dựng nội dung khóa học"
                >
                  <Pencil size={18} strokeWidth={2.5} />
                </button>
              </Link>
              <button
                onClick={() => setCourseToDelete(course)}
                disabled={isPending}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                title="Đưa khóa học vào thùng rác"
              >
                {isPending && courseToDelete?.id === course.id ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Trash2 size={18} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
