"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseSchema, CourseFormValues } from "@/lib/schemas/course";
import {
  getCoursesForTeacher,
  deleteCourse,
  updateCourse,
} from "@/app/actions/course";

// Import các mảnh ghép Component
import CourseForm from "./_components/CourseForm";
import CourseList from "./_components/CourseList";
import DeleteCourseModal from "./_components/DeleteCourseModal";

import type { TeacherCourse } from "@/lib/schemas/course";

export default function CreateCoursePage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [coursesList, setCoursesList] = useState<TeacherCourse[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [courseToDelete, setCourseToDelete] = useState<TeacherCourse | null>(
    null,
  );
  const [editingCourse, setEditingCourse] = useState<TeacherCourse | null>(
    null,
  );

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    criteriaMode: "firstError",
    shouldFocusError: true,
    shouldUseNativeValidation: false,
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      price: "",
      thumbnail_file: null,
    },
  });

  const fetchMyCourses = async () => {
    setIsLoadingData(true);
    const res = await getCoursesForTeacher();
    if (res.data) setCoursesList(res.data);
    else if (res.error) toast.error("Lỗi tải danh sách: " + res.error);
    setIsLoadingData(false);
  };

  useEffect(() => {
    const loadInitialCourses = async () => await fetchMyCourses();
    loadInitialCourses();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleEditCourse = (course: TeacherCourse) => {
    setEditingCourse(course); // Đánh dấu là đang sửa khóa học

    // Đổ dữ liệu cũ vào form
    form.reset({
      title: course.title,
      slug: course.slug,
      description: course.description || "",
      price: course.price.toString(),
      thumbnail_file: null, // File ảnh không thể set sẵn, dùng previewUrl để hiển thị thay thế
    });

    setPreviewUrl(course.thumbnail_url); // Hiện ảnh bìa cũ
  };

  const handleCancelForm = () => {
    setEditingCourse(null); // Xóa trạng thái đang sửa
    form.reset({
      title: "",
      slug: "",
      description: "",
      price: "",
      thumbnail_file: null,
    });
    setPreviewUrl(null);
  };

  function onSubmit(values: CourseFormValues) {
    if (!editingCourse) {
      toast.error("Không tìm thấy khóa học cần cập nhật.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("title", values.title);
      formData.append("slug", values.slug);
      formData.append("description", values.description);
      formData.append("price", values.price || "0");
      if (values.thumbnail_file)
        formData.append("thumbnail_file", values.thumbnail_file);

      const res = await updateCourse(editingCourse.id, formData);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message);
        form.reset();
        setPreviewUrl(null);
        setEditingCourse(null); // Nhớ clear state sau khi xong
        fetchMyCourses();
      }
    });
  }

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;
    startTransition(async () => {
      const res = await deleteCourse(courseToDelete.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        fetchMyCourses();
      }
      setCourseToDelete(null);
    });
  };

  // Form trên trang danh sách chỉ còn dùng để chỉnh sửa course hiện có.
  if (editingCourse) {
    return (
      <CourseForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        previewUrl={previewUrl}
        setPreviewUrl={setPreviewUrl}
        onCancel={handleCancelForm}
        isEditMode
      />
    );
  }

  // MẶC ĐỊNH -> RENDER LIST VÀ MODAL
  return (
    <div className="text-black flex flex-col p-6 min-h-screen w-full bg-[#F9FAFB] font-sans dark">
      <div className="mb-8 flex flex-col gap-4 md:grid md:grid-cols-[auto_1fr_auto] md:items-center">
        {/* ĐÃ THÊM ICON PREV QUAY VỀ TRANG CHỦ Ở ĐÂY */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer text-slate-600 shadow-sm">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <h1 className="text-2xl font-bold md:hidden">Khóa học của tôi</h1>
        </div>

        <h1 className="hidden text-center text-2xl font-bold md:block">Khóa học của tôi</h1>
        <Link
          href="/courses/new"
          className="flex min-h-11 w-full items-center justify-center rounded-md border bg-[#5FE8EF] px-4 py-2 text-center text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#42d2da] md:min-h-0 md:w-auto"
        >
          + Thêm khóa học
        </Link>
      </div>

      <CourseList
        coursesList={coursesList}
        isLoadingData={isLoadingData}
        isPending={isPending}
        courseToDelete={courseToDelete}
        setCourseToDelete={setCourseToDelete}
        onEditCourse={handleEditCourse} // Thêm dòng này để bánh răng gọi được
      />

      <DeleteCourseModal
        courseToDelete={courseToDelete}
        setCourseToDelete={setCourseToDelete}
        handleConfirmDelete={handleConfirmDelete}
        isPending={isPending}
      />
    </div>
  );
}
