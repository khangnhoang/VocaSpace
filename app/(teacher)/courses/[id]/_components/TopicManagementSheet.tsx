// File: app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx
import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  FileText,
  ArrowLeft,
  Clock,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Chapter, Topic } from "./types";
import { toast } from "sonner";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTopicSchema, type TopicFormValues } from "@/lib/schemas/topic";
import { getTopicsByChapterId, createTopic } from "@/app/actions/topic";

import FlashcardPreviewSheet from "./FlashcardPreviewSheet";

interface TopicManagementSheetProps {
  chapter: Chapter | null;
  onClose: () => void;
}

export default function TopicManagementSheet({
  chapter,
  onClose,
}: TopicManagementSheetProps) {
  const router = useRouter();
  const params = useParams(); // Lấy courseId từ URL hiện tại
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [previewTopic, setPreviewTopic] = useState<Topic | null>(null);

  // 1. STATE REFRESH KEY (Để fetch lại data mà không bị báo lỗi ESLint)
  const [refreshKey, setRefreshKey] = useState(0);

  const maxOrder =
    topics.length > 0 ? Math.max(...topics.map((t) => t.order_index)) : 0;

  // 2. ÉP KIỂU "as any" CHO RESOLVER ĐỂ FIX TRIỆT ĐỂ LỖI TYPE CỦA ZOD & HOOK FORM
  const form = useForm<TopicFormValues>({
    resolver: zodResolver(createTopicSchema(maxOrder)) as any,
    defaultValues: { title: "", order_index: maxOrder + 1, status: "draft" },
  });

  useEffect(() => {
    form.setValue("order_index", maxOrder + 1);
  }, [maxOrder, form]);

  // 3. ĐƯA HÀM FETCH VÀO TRONG useEffect CÙNG isMounted ĐỂ CHỐNG CASCADING RENDER
  useEffect(() => {
    let isMounted = true;

    const loadTopics = async () => {
      if (!chapter) return;
      setIsLoading(true);
      const res = await getTopicsByChapterId(chapter.id);

      if (isMounted) {
        if (res.data) setTopics(res.data);
        setIsLoading(false);
      }
    };

    loadTopics();

    return () => {
      isMounted = false;
    };
  }, [chapter, refreshKey]); // Gọi lại khi mở chapter mới HOẶC khi refreshKey thay đổi

  const onSubmit = (values: TopicFormValues) => {
    startTransition(async () => {
      const res = await createTopic(chapter!.id, values);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message);
        setIsAddDialogOpen(false);
        form.reset();

        // 4. CỘNG REFRESH KEY ĐỂ LOAD LẠI LIST THAY VÌ GỌI HÀM FETCH NHƯ CŨ
        setRefreshKey((prev) => prev + 1);
      }
    });
  };

  if (!chapter) return null;

  return (
    <>
      <Sheet open={!!chapter} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="bg-[#F9FAFB] border-none w-full! sm:max-w-full! h-full p-0 overflow-y-auto"
        >
          <div className="max-w-6xl mx-auto w-full p-6 md:p-10 flex flex-col">
            <button
              onClick={onClose}
              className="flex w-fit items-center text-slate-500 hover:text-slate-900 transition-colors font-semibold mb-8 cursor-pointer group"
            >
              <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm mr-3 group-hover:bg-slate-100 transition-colors">
                <ArrowLeft size={20} className="text-slate-700" />
              </div>
              Quay về khung chương trình
            </button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <SheetHeader className="text-left">
                <SheetTitle className="text-3xl font-bold text-slate-900">
                  Quản lý Bài học (Topics)
                </SheetTitle>
                <SheetDescription className="text-base mt-2">
                  Chương:{" "}
                  <span className="font-bold text-[#3B82F6]">
                    {chapter.title}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="w-full md:w-auto bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl h-12 px-6 text-md font-bold shadow-md transition-all active:scale-95 cursor-pointer text-white"
              >
                <Plus size={20} className="mr-2" /> Thêm Bài học mới
              </Button>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-0 overflow-hidden">
                  <DialogHeader className="px-6 py-5 border-b border-slate-100">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                      <Plus
                        className="text-[#3B82F6]"
                        size={24}
                        strokeWidth={3}
                      />
                      Thêm Bài học mới
                    </DialogTitle>
                  </DialogHeader>

                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="p-6 space-y-5"
                    >
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Tên bài học
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Nhập tên bài học..."
                                className="h-12 border-slate-200 focus-visible:ring-[#3B82F6] rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-rose-500 text-xs font-medium" />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="order_index"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Thứ tự hiển thị
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  className="h-12 border-slate-200 focus-visible:ring-[#3B82F6] rounded-xl"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="text-rose-500 text-xs font-medium" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Trạng thái
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full h-12 border-slate-200 focus:ring-[#3B82F6] rounded-xl">
                                    <SelectValue placeholder="Chọn trạng thái" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                                  <SelectItem
                                    value="draft"
                                    className="cursor-pointer py-2.5 font-medium"
                                  >
                                    Bản nháp
                                  </SelectItem>
                                  <SelectItem
                                    value="pending"
                                    className="cursor-pointer py-2.5 font-medium text-amber-600"
                                  >
                                    Chờ duyệt
                                  </SelectItem>
                                  <SelectItem
                                    value="published"
                                    className="cursor-pointer py-2.5 font-medium text-emerald-600"
                                  >
                                    Xuất bản
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-rose-500 text-xs font-medium" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <DialogFooter className="pt-4 flex gap-3 justify-end border-t border-slate-100 mt-6">
                        <DialogClose asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-5 h-11 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                          >
                            Hủy bỏ
                          </Button>
                        </DialogClose>
                        <Button
                          type="submit"
                          disabled={isPending}
                          className="px-6 h-11 text-sm font-semibold text-white bg-[#3B82F6] rounded-xl shadow-md hover:bg-[#2563EB]"
                        >
                          {isPending ? (
                            <Loader2 className="animate-spin mr-2" size={18} />
                          ) : (
                            "Tạo Bài học"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20 text-blue-500">
                <Loader2 className="h-10 w-10 animate-spin" />
              </div>
            ) : topics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {topics
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((topic) => (
                    <div
                      key={topic.id}
                      onClick={() =>
                        router.push(`/courses/${params.id}/topics/${topic.id}`)
                      }
                      className="flex flex-col p-5 border border-slate-200 rounded-2xl bg-white hover:border-blue-300 hover:shadow-lg transition-all group cursor-pointer h-full"
                    >
                      <div className="flex justify-between items-start mb-5">
                        <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl group-hover:scale-110 transition-all">
                          <FileText size={24} strokeWidth={2} />
                        </div>
                        <span
                          className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg ${topic.status === "published" ? "bg-emerald-100 text-emerald-700" : topic.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {topic.status === "published"
                            ? "Xuất bản"
                            : topic.status === "pending"
                              ? "Chờ duyệt"
                              : "Bản nháp"}
                        </span>
                      </div>

                      <div className="mb-6 flex-1">
                        <h4 className="font-bold text-slate-900 group-hover:text-blue-600 text-lg line-clamp-2">
                          {topic.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3 font-medium">
                          <Clock size={14} /> Ngày tạo:{" "}
                          {new Date(topic.created_at).toLocaleDateString(
                            "vi-VN",
                          )}
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between opacity-80 group-hover:opacity-100">
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md">
                          Thứ tự: {topic.order_index}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation(); // <-- THÊM DÒNG NÀY ĐỂ FIX
                              router.push(
                                `/courses/${params.id}/topics/${topic.id}`,
                              );
                            }}
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 h-9 w-9 rounded-lg"
                          >
                            <Eye size={18} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 h-9 w-9 rounded-lg"
                          >
                            <Pencil size={18} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-9 w-9 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-20 px-4 border border-dashed border-slate-300 rounded-2xl bg-white shadow-sm mt-4">
                <div className="bg-slate-50 text-slate-300 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText size={32} />
                </div>
                <p className="text-slate-500 font-medium text-lg">
                  Chương này chưa có bài học nào.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <FlashcardPreviewSheet
        topic={previewTopic}
        onClose={() => setPreviewTopic(null)}
      />
    </>
  );
}
