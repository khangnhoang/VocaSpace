"use client";
import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getTopicById, updateTopic, deleteTopic } from "@/app/actions/topic";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getCourseStructurePath } from "../../../_components/topic-builder-path";
import type { TopicFormValues } from "@/lib/schemas/topic";

interface SettingsTabProps {
  courseId: string;
  topicId: string;
}

export default function SettingsTab({ courseId, topicId }: SettingsTabProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  
  // States quản lý Form
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TopicFormValues["status"]>("draft");

  // State quản lý Modal Xóa
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const res = await getTopicById(topicId);
      if (res.data) {
        setTitle(res.data.title);
        setStatus(res.data.status as TopicFormValues["status"]);
      }
      setIsLoading(false);
    };
    loadData();
  }, [topicId]);

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateTopic({ topicId, title, status });
      if (res.error) toast.error(res.error);
      else toast.success(res.message);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTopic({ topicId });
      if (res.error) {
        toast.error(res.error);
        setIsDeleteDialogOpen(false);
      } else {
        toast.success(res.message);
        setIsDeleteDialogOpen(false);
        router.push(getCourseStructurePath(courseId));
      }
    });
  };

  const topicTitle = title.trim() || "bài học này";

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-4">Cài đặt chung</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tên bài học</label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="h-14 rounded-2xl text-lg font-medium" 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Trạng thái hiển thị</label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as TopicFormValues["status"])
              }
            >
              <SelectTrigger className="h-14 rounded-2xl text-base font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Bản nháp (Học viên không thấy)</SelectItem>
                <SelectItem value="pending">Chờ duyệt (Pending)</SelectItem>
                <SelectItem value="published">Đã xuất bản (Học viên có thể học)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button disabled={isPending} onClick={handleSave} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl h-12 px-8 font-bold">
            {isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
            Lưu cài đặt
          </Button>
        </div>
      </div>

      <div className="bg-rose-50 p-8 rounded-3xl border border-rose-100 flex items-center justify-between">
        <div>
          <h3 className="text-rose-800 font-bold text-lg">Khu vực nguy hiểm</h3>
          <p className="text-rose-600/80 text-sm mt-1">Hành động này chỉ ẩn bài học khỏi cấu trúc đang hoạt động. Nội dung bên trong vẫn được giữ theo cơ chế soft-delete.</p>
        </div>
        <Button 
          variant="destructive" 
          onClick={() => setIsDeleteDialogOpen(true)} 
          className="rounded-xl h-12 px-6 font-bold shadow-sm"
        >
          <Trash2 className="mr-2" size={18} /> Ẩn bài học này
        </Button>
      </div>

      {/* Gọi Component Xác nhận cực kỳ thanh lịch */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        title="Ẩn bài học?"
        description="Học viên sẽ không thể truy cập nội dung này nữa, nhưng dữ liệu vẫn được giữ theo cơ chế soft-delete."
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
