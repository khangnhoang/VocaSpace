"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseSchema, CourseFormValues } from "@/lib/schemas/course";
import { createCourse, getCoursesForTeacher, deleteCourse } from "@/app/actions/course";

// Import các mảnh ghép Component
import CourseForm from "./_components/CourseForm";
import CourseList from "./_components/CourseList";
import DeleteCourseModal from "./_components/DeleteCourseModal";

import { TeacherCourse } from "./_components/types";

export default function CreateCoursePage() {
  const [showForm, setShowForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [coursesList, setCoursesList] = useState<TeacherCourse[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: "", slug: "", description: "", price: "", thumbnail_file: null },
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
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function onSubmit(values: CourseFormValues) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("title", values.title);
      formData.append("slug", values.slug);
      formData.append("description", values.description);
      formData.append("price", values.price || "0");
      if (values.thumbnail_file) formData.append("thumbnail_file", values.thumbnail_file);

      const res = await createCourse(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message);
        setShowForm(false);
        form.reset();
        setPreviewUrl(null);
        fetchMyCourses();
      }
    });
  }

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;
    startTransition(async () => {
      const res = await deleteCourse(courseToDelete);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        fetchMyCourses();
      }
      setCourseToDelete(null);
    });
  };

  // NẾU ĐANG BẬT FORM -> RENDER FORM
  if (showForm) {
    return (
      <CourseForm 
        form={form} onSubmit={onSubmit} isPending={isPending} 
        previewUrl={previewUrl} setPreviewUrl={setPreviewUrl} onCancel={() => setShowForm(false)}
      />
    );
  }

  // MẶC ĐỊNH -> RENDER LIST VÀ MODAL
  return (
    <div className="text-black flex flex-col p-6 min-h-screen w-full bg-[#F9FAFB] font-sans dark">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Khóa học của tôi</h1>
        <button onClick={() => setShowForm(true)} className="border text-slate-900 text-sm px-4 py-2 rounded-md font-bold bg-[#5FE8EF] hover:bg-[#42d2da] transition-colors shadow-sm cursor-pointer">
          + Thêm khóa học
        </button>
      </div>

      <CourseList 
        coursesList={coursesList} isLoadingData={isLoadingData} isPending={isPending} 
        courseToDelete={courseToDelete} setCourseToDelete={setCourseToDelete} 
      />

      <DeleteCourseModal 
        courseToDelete={courseToDelete} setCourseToDelete={setCourseToDelete} 
        handleConfirmDelete={handleConfirmDelete} isPending={isPending} 
      />
    </div>
  );
}