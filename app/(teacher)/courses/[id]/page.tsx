"use client";

import React, { useState, useEffect, useTransition, use } from "react";
import { Chapter } from "./_components/types";
import { Plus, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { chapterSchema, type ChapterFormValues } from "@/lib/schemas/chapter";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation"; // Thêm cái này
import { verifyCourseAccess } from "@/app/actions/course"; // Thêm cái này

import { getChaptersByCourseId, createChapter, deleteChapter } from "@/app/actions/chapter";

// Import Components
import ChapterList from "./_components/ChapterList";
import ChapterFormModal from "./_components/ChapterFormModal";
import DeleteChapterModal from "./_components/DeleteChapterModal";

export default function CourseBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;
  const router = useRouter();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [isPending, startTransition] = useTransition();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);

  const form = useForm<ChapterFormValues>({
    resolver: zodResolver(chapterSchema),
    defaultValues: { title: "", order_index: 1 },
  });

  useEffect(() => {
    const fetchInit = async () => {
      // 1. GỌI TRẠM GÁC: Kiểm tra quyền và trạng thái sống/chết của khóa học
      const access = await verifyCourseAccess(courseId);
      
      if (!access.isValid) {
        toast.error(access.error);
        router.push("/courses"); // Đá văng về trang danh sách
        return; // Dừng lập tức, không fetch data chương nữa
      }

      // 2. NẾU QUA CỬA AN TOÀN: Fetch data bình thường
      const res = await getChaptersByCourseId(courseId);
      if (res.error) toast.error(res.error);
      else {
        setChapters(res.data || []);
        if (res.data) form.setValue("order_index", res.data.length + 1);
      }
      setIsLoading(false);
    };
    fetchInit();
  }, [courseId, form, router]);

  const refreshChapters = async () => {
    const res = await getChaptersByCourseId(courseId);
    if (res.data) {
      setChapters(res.data);
      form.setValue("order_index", res.data.length + 1);
    }
  };

  const onSubmitForm = (values: ChapterFormValues) => {
    startTransition(async () => {
      const res = await createChapter(courseId, values.title, values.order_index);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setIsAddDialogOpen(false);
        form.reset();
        refreshChapters();
      }
    });
  };

  const handleConfirmDelete = async () => {
    if (!chapterToDelete) return;
    startTransition(async () => {
      const res = await deleteChapter(chapterToDelete);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setChapterToDelete(null);
        refreshChapters();
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        <DeleteChapterModal 
          chapterToDelete={chapterToDelete} setChapterToDelete={setChapterToDelete} 
          handleConfirmDelete={handleConfirmDelete} isPending={isPending} 
        />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl"><BookOpen size={32} /></div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Khung Chương Trình</h1>
              <p className="text-slate-500 font-medium mt-1">Xây dựng cấu trúc cho khóa học của bạn</p>
            </div>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold h-12 px-6 rounded-xl shadow-md">
            <Plus className="mr-2" size={20} /> Thêm Chương
          </Button>
        </div>

        <ChapterFormModal 
          isOpen={isAddDialogOpen} setIsOpen={setIsAddDialogOpen} 
          form={form} onSubmitForm={onSubmitForm} isPending={isPending} 
        />

        <ChapterList 
          chapters={chapters} isLoading={isLoading} setChapterToDelete={setChapterToDelete} 
        />
      </div>
    </div>
  );
}