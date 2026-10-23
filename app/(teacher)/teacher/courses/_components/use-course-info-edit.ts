"use client";

import { useEffect, useState, useTransition, type RefObject } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateCourse } from "@/app/actions/course";
import { courseSchema, type CourseFormValues, type TeacherCourse } from "@/lib/schemas/course";

export type EditableCourseInfo = Pick<TeacherCourse, "id" | "title" | "slug" | "description" | "thumbnail_url"> & {
  price: number | null;
};

interface UseCourseInfoEditOptions {
  // Portfolio dùng chung khóa này với thao tác xóa để hai mutation không chạy chồng nhau.
  mutationLock: RefObject<boolean>;
  onSaved: () => void;
  onClosed?: () => void;
}

// Luồng sửa thông tin khóa học dùng chung cho /teacher/courses và trang Tổng quan: cùng form, cùng
// FormData gửi `updateCourse`, cùng khóa chống gửi trùng. Lưu lỗi thì giữ nguyên dữ liệu đã nhập.
export function useCourseInfoEdit({ mutationLock, onSaved, onClosed }: UseCourseInfoEditOptions) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableCourseInfo | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Lỗi lưu gần nhất để nơi hiển thị trong dialog đọc được; toast trong dialog modal bị ẩn khỏi trình đọc màn hình.
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: "", slug: "", description: "", price: "", thumbnail_file: null },
  });

  function open(course: EditableCourseInfo) {
    setSaveError(null);
    setEditing(course);
    setPreview(course.thumbnail_url);
    form.reset({ title: course.title, slug: course.slug, description: course.description ?? "", price: String(course.price ?? 0), thumbnail_file: null });
    requestAnimationFrame(() => form.setFocus("title"));
  }

  function close() {
    setPreview(null);
    setEditing(null);
    form.reset();
    onClosed?.();
  }

  function submit(values: CourseFormValues) {
    if (!editing || mutationLock.current) return;
    const courseId = editing.id;
    mutationLock.current = true;
    setSaveError(null);
    startTransition(async () => {
      try {
        const payload = new FormData();
        payload.append("title", values.title);
        payload.append("slug", values.slug);
        payload.append("description", values.description);
        payload.append("price", values.price || "0");
        if (values.thumbnail_file) payload.append("thumbnail_file", values.thumbnail_file);
        const response = await updateCourse(courseId, payload);
        if (response.error) { toast.error(response.error); setSaveError(response.error); }
        else { toast.success(response.message); close(); onSaved(); }
      } catch {
        const message = "Chưa lưu được khóa học. Dữ liệu bạn nhập vẫn được giữ lại, vui lòng thử lại.";
        toast.error(message);
        setSaveError(message);
      }
      finally { mutationLock.current = false; }
    });
  }

  return { form, editing, preview, setPreview, isPending, saveError, open, close, submit };
}
