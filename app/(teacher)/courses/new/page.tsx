"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createCourse } from "@/app/actions/course";
import {
  courseSchema,
  type CourseFormValues,
} from "@/lib/schemas/course";
import CourseForm from "../_components/CourseForm";

// Route tạo mới dùng lại CourseForm để giữ cùng validation và Server Action với flow hiện tại ở /courses.
export default function NewCoursePage() {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleCancel = () => {
    router.push("/courses");
  };

  function onSubmit(values: CourseFormValues) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("title", values.title);
      formData.append("slug", values.slug);
      formData.append("description", values.description);
      formData.append("price", values.price || "0");

      if (values.thumbnail_file) {
        formData.append("thumbnail_file", values.thumbnail_file);
      }

      const res = await createCourse(formData);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      router.push("/courses");
      router.refresh();
    });
  }

  return (
    <CourseForm
      form={form}
      onSubmit={onSubmit}
      isPending={isPending}
      previewUrl={previewUrl}
      setPreviewUrl={setPreviewUrl}
      onCancel={handleCancel}
    />
  );
}
