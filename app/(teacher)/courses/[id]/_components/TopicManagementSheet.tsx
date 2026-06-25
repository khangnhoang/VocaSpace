import React, { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Chapter, Topic } from "./types";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { topicSchema, type TopicFormValues } from "@/lib/schemas/topic";
import {
  createTopic,
  deleteTopic,
  getTopicsByChapterId,
  updateTopic,
} from "@/app/actions/topic";
import { getTopicBuilderPath } from "@/lib/course-authoring/routes";
import type { CourseAuthoringSuccessEvent } from "@/lib/course-authoring/issue-success";

interface TopicManagementSheetProps {
  chapter: Chapter | null;
  onClose: () => void;
  onTopicsChanged?: (chapterId: string) => Promise<void> | void;
  onAuthoringSuccess?: (event: CourseAuthoringSuccessEvent) => boolean;
}

const topicStatusLabels: Record<Topic["status"], string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Xuất bản",
};

export default function TopicManagementSheet({
  chapter,
  onClose,
  onTopicsChanged,
  onAuthoringSuccess,
}: TopicManagementSheetProps) {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [topicToEdit, setTopicToEdit] = useState<Topic | null>(null);
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasTopicChanges, setHasTopicChanges] = useState(false);

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicSchema),
    defaultValues: { title: "", status: "draft" },
  });

  useEffect(() => {
    let isMounted = true;

    const loadTopics = async () => {
      if (!chapter) return;
      setIsLoading(true);
      setLoadError(null);
      const res = await getTopicsByChapterId(chapter.id);

      if (!isMounted) return;

      if (res.error) {
        setLoadError(res.error);
        toast.error(res.error);
        setTopics([]);
      } else {
        setTopics(res.data ?? []);
      }
      setIsLoading(false);
    };

    loadTopics();

    return () => {
      isMounted = false;
    };
  }, [chapter, refreshKey]);

  const openCreateTopicDialog = () => {
    setTopicToEdit(null);
    form.reset({ title: "", status: "draft" });
    setIsTopicDialogOpen(true);
  };

  const openEditTopicDialog = (topic: Topic) => {
    setTopicToEdit(topic);
    form.reset({ title: topic.title, status: topic.status });
    setIsTopicDialogOpen(true);
  };

  const refreshTopics = () => setRefreshKey((prev) => prev + 1);

  const returnToStructure = async () => {
    if (chapter && hasTopicChanges) {
      // Chỉ báo trang cha khi sheet thật sự đã đổi bài học.
      // Việc này giúp structure refresh số lượng và dọn lời nhắc dashboard đúng lúc quay về.
      await onTopicsChanged?.(chapter.id);
      setHasTopicChanges(false);
    }

    onClose();
  };

  const onSubmit = (values: TopicFormValues) => {
    if (!chapter) return;

    startTransition(async () => {
      const res = topicToEdit
        ? await updateTopic({
            topicId: topicToEdit.id,
            title: values.title,
            status: values.status,
          })
        : await createTopic({
            courseId,
            chapterId: chapter.id,
            title: values.title,
            status: values.status,
          });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      const handledByDashboardFeedback =
        !topicToEdit &&
        res.data &&
        onAuthoringSuccess?.({
          type: "topic_created",
          courseId,
          chapterId: chapter.id,
          topicId: res.data.id,
        });

      if (!handledByDashboardFeedback) {
        toast.success(res.message);
      }

      setIsTopicDialogOpen(false);
      setTopicToEdit(null);
      form.reset({ title: "", status: "draft" });
      refreshTopics();
      setHasTopicChanges(true);
    });
  };

  const handleConfirmDelete = () => {
    if (!topicToDelete) return;

    startTransition(async () => {
      const res = await deleteTopic({ topicId: topicToDelete.id });
      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      setTopicToDelete(null);
      refreshTopics();
      setHasTopicChanges(true);
    });
  };

  if (!chapter) return null;

  return (
    <>
      <Sheet
        open={!!chapter}
        onOpenChange={(open) => {
          if (!open) void returnToStructure();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="bg-[#F9FAFB] border-none w-full! sm:max-w-full! h-full p-0 overflow-y-auto"
        >
          <div className="max-w-6xl mx-auto w-full p-6 md:p-10 flex flex-col">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void returnToStructure()}
              className="mb-8 flex w-fit items-center rounded-lg text-slate-600 hover:text-slate-900"
            >
              Quay về khung chương trình
            </Button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <SheetHeader className="text-left">
                <SheetTitle className="text-3xl font-bold text-slate-900">
                  Quản lý bài học
                </SheetTitle>
                <SheetDescription className="text-base mt-2">
                  Chương:{" "}
                  <span className="font-bold text-[#3B82F6]">
                    {chapter.title}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <Button
                type="button"
                onClick={openCreateTopicDialog}
                className="w-full md:w-auto bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl h-12 px-6 text-md font-bold shadow-md transition-all active:scale-95 cursor-pointer text-white"
              >
                <Plus size={20} className="mr-2" /> Thêm bài học
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20 text-blue-500">
                <Loader2 className="h-10 w-10 animate-spin" />
              </div>
            ) : loadError ? (
              <div className="text-center py-16 px-4 border border-dashed border-rose-200 rounded-2xl bg-white shadow-sm">
                <p className="text-rose-600 font-medium">{loadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-lg"
                  onClick={refreshTopics}
                >
                  Thử tải lại
                </Button>
              </div>
            ) : topics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {topics.map((topic) => (
                  <article
                    key={topic.id}
                    className="flex flex-col p-5 border border-slate-200 rounded-2xl bg-white hover:border-blue-300 hover:shadow-lg transition-all h-full"
                  >
                    <div className="flex justify-between items-start mb-5">
                      <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl">
                        <FileText size={24} strokeWidth={2} />
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg ${
                          topic.status === "published"
                            ? "bg-emerald-100 text-emerald-700"
                            : topic.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {topicStatusLabels[topic.status]}
                      </span>
                    </div>

                    <div className="mb-6 flex-1">
                      <h4 className="font-bold text-slate-900 text-lg line-clamp-2">
                        {topic.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3 font-medium">
                        <Clock size={14} /> Tạo ngày:{" "}
                        {new Date(topic.created_at).toLocaleDateString("vi-VN")}
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
                      <span className="w-fit text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md">
                        Thứ tự: {topic.order_index}
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          onClick={() =>
                            router.push(getTopicBuilderPath(courseId, topic.id))
                          }
                          variant="ghost"
                          size="icon"
                          aria-label={`Mở trình soạn nội dung bài học ${topic.title}`}
                          className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 h-9 w-9 rounded-lg"
                        >
                          <Eye size={18} />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => openEditTopicDialog(topic)}
                          variant="ghost"
                          size="icon"
                          aria-label={`Sửa bài học ${topic.title}`}
                          className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 h-9 w-9 rounded-lg"
                        >
                          <Pencil size={18} />
                        </Button>
                        <Button
                          type="button"
                          onClick={() =>
                            router.push(
                              getTopicBuilderPath(
                                courseId,
                                topic.id,
                                "settings",
                              ),
                            )
                          }
                          variant="ghost"
                          size="icon"
                          aria-label={`Mở cài đặt bài học ${topic.title}`}
                          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 h-9 w-9 rounded-lg"
                        >
                          <Settings size={18} />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setTopicToDelete(topic)}
                          variant="ghost"
                          size="icon"
                          aria-label={`Ẩn bài học ${topic.title}`}
                          className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-9 w-9 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>
                  </article>
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

      <Dialog
        open={isTopicDialogOpen}
        onOpenChange={(open) => {
          setIsTopicDialogOpen(open);
          if (!open) setTopicToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-5 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Plus className="text-[#3B82F6]" size={24} strokeWidth={3} />
              {topicToEdit ? "Sửa bài học" : "Thêm bài học"}
            </DialogTitle>
            <DialogDescription className="hidden">
              Nhập tên và trạng thái hiển thị cho bài học trong chương này.
            </DialogDescription>
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

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Trạng thái
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full h-12 border-slate-200 focus:ring-[#3B82F6] rounded-xl">
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white rounded-xl shadow-xl border-slate-100">
                        <SelectItem value="draft">Bản nháp</SelectItem>
                        <SelectItem value="pending">Chờ duyệt</SelectItem>
                        <SelectItem value="published">Xuất bản</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-rose-500 text-xs font-medium" />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4 flex gap-3 justify-end border-t border-slate-100 mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-5 h-11 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  onClick={() => setIsTopicDialogOpen(false)}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="px-6 h-11 text-sm font-semibold text-white bg-[#3B82F6] rounded-xl shadow-md hover:bg-[#2563EB]"
                >
                  {isPending ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : topicToEdit ? (
                    "Lưu thay đổi"
                  ) : (
                    "Tạo bài học"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!topicToDelete}
        setIsOpen={(open) => {
          if (!open) setTopicToDelete(null);
        }}
        title="Ẩn bài học?"
        description="Bài học này sẽ được ẩn khỏi cấu trúc đang hoạt động. Nội dung bên trong không bị xóa vĩnh viễn."
        details={
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Bài học
            </p>
            <p
              className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900"
              title={topicToDelete?.title ?? "bài học này"}
            >
              {topicToDelete?.title ?? "bài học này"}
            </p>
          </div>
        }
        confirmText="Ẩn bài học"
        loadingText="Đang ẩn bài học..."
        onConfirm={handleConfirmDelete}
        isLoading={isPending}
      />
    </>
  );
}
