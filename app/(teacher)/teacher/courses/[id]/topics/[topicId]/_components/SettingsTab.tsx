"use client";
import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getTopicById, updateTopic, deleteTopicFromBuilder } from "@/app/actions/topic";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Topic } from "@/types/database";
import { confirmPublishedTopicMutation } from "@/lib/course-authoring/topic-workflow";

interface SettingsTabProps {
  topicId: string;
  readOnly?: boolean;
  isPublished?: boolean;
  onSaved?: () => void;
}

export default function SettingsTab({ topicId, readOnly = false, isPublished = false, onSaved }: SettingsTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  
  // States quản lý Form
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Topic["status"]>("draft");
  const [isDeleting, setIsDeleting] = useState(false);

  // State quản lý Modal Xóa
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (isDeleting) return;
      const res = await getTopicById(topicId);
      if (res.data) {
        setTitle(res.data.title);
        setStatus(res.data.status as Topic["status"]);
      }
      setIsLoading(false);
    };
    loadData();
  }, [isDeleting, topicId]);

  const handleSave = () => {
    if (readOnly) return;
    const confirmPublished = isPublished
      ? confirmPublishedTopicMutation("Việc đổi tên bài học")
      : false;
    if (isPublished && !confirmPublished) return;
    startTransition(async () => {
      const res = await updateTopic({ topicId, title, confirmPublished });
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        onSaved?.();
      }
    });
  };

  const handleDelete = () => {
    if (readOnly) return;
    const confirmPublished = isPublished
      ? confirmPublishedTopicMutation("Việc ẩn bài học")
      : false;
    if (isPublished && !confirmPublished) return;
    setIsDeleting(true);
    startTransition(async () => {
      const res = await deleteTopicFromBuilder({ topicId, confirmPublished });
      if (res?.error) {
        toast.error(res.error);
        setIsDeleteDialogOpen(false);
        setIsDeleting(false);
      }
    });
  };

  const topicTitle = title.trim() || "bài học này";

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-in fade-in duration-500">
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-4">Cài đặt chung</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tên bài học</label>
            <Input
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              disabled={readOnly}
              className="h-14 w-full rounded-2xl text-lg font-medium"
            />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Trạng thái hiện tại
            </p>
            <p className="mt-1 font-semibold text-slate-800">
              {status === "published"
                ? "Đã xuất bản"
                : status === "pending"
                  ? "Đang chờ duyệt"
                  : "Bản nháp"}
            </p>
            <p className="mt-1">
              Trạng thái được quản lý qua quy trình duyệt; cài đặt này chỉ cập
              nhật thông tin bài học.
            </p>
          </div>
        </div>

        <div className="flex justify-stretch pt-4 sm:justify-end">
          <Button disabled={isPending || readOnly} onClick={handleSave} className="h-12 w-full rounded-xl bg-[#3B82F6] px-8 font-bold text-white hover:bg-[#2563EB] sm:w-auto">
            {isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
            Lưu cài đặt
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-5 rounded-2xl border border-rose-100 bg-rose-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-8">
        <div className="min-w-0 flex-1">
          <h3 className="text-rose-800 font-bold text-lg">Khu vực nguy hiểm</h3>
          <p className="text-rose-600/80 text-sm mt-1">Bài học sẽ được ẩn khỏi cấu trúc khóa học. Nội dung bên trong vẫn được giữ lại và không bị xóa vĩnh viễn.</p>
        </div>
        <Button
          variant="destructive" 
          disabled={readOnly}
          onClick={() => setIsDeleteDialogOpen(true)} 
          className="h-12 w-full rounded-xl px-6 font-bold shadow-sm sm:w-auto"
        >
          <Trash2 className="mr-2" size={18} /> Ẩn bài học này
        </Button>
      </div>

      {/* Gọi Component Xác nhận cực kỳ thanh lịch */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        title="Ẩn bài học?"
        description="Học viên sẽ không thể truy cập bài học này, nhưng dữ liệu bên trong vẫn được giữ lại."
        details={
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Bài học
            </p>
            <p
              className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900"
              title={topicTitle}
            >
              {topicTitle}
            </p>
          </div>
        }
        confirmText="Ẩn bài học"
        loadingText="Đang ẩn bài học..."
        onConfirm={handleDelete}
        isLoading={isPending}
      />
    </div>
  );
}
