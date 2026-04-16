// File: app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx
import React, { useState, useEffect } from "react";
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  FileText,
  ArrowLeft,
  Clock,
  Loader2, // Thêm Loader2
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Chapter, Topic } from "./types";

// GỌI API THẬT
import { getTopicsByChapterId } from "@/app/actions/topic";

interface TopicManagementSheetProps {
  chapter: Chapter | null;
  onClose: () => void;
}

export default function TopicManagementSheet({
  chapter,
  onClose,
}: TopicManagementSheetProps) {
  // STATE LƯU TRỮ TOPIC THẬT
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // FETCH DỮ LIỆU KHI BẬT SHEET HOẶC ĐỔI CHAPTER
  useEffect(() => {
    if (!chapter) return;
    const fetchTopics = async () => {
      setIsLoading(true);
      const res = await getTopicsByChapterId(chapter.id);
      if (res.data) setTopics(res.data);
      setIsLoading(false);
    };
    fetchTopics();
  }, [chapter]);

  if (!chapter) return null;

  return (
    <Sheet open={!!chapter} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="bg-[#F9FAFB] border-none w-full! sm:max-w-full! h-full p-0 overflow-y-auto"
      >
        <div className="max-w-6xl mx-auto w-full p-6 md:p-10 flex flex-col">
          {/* NÚT QUAY VỀ */}
          <button
            onClick={onClose}
            className="flex w-fit items-center text-slate-500 hover:text-slate-900 transition-colors font-semibold mb-8 cursor-pointer group"
          >
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm mr-3 group-hover:bg-slate-100 transition-colors">
              <ArrowLeft size={20} className="text-slate-700" />
            </div>
            Quay về khung chương trình
          </button>

          {/* HEADER & NÚT THÊM MỚI */}
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

            <Button className="w-full md:w-auto bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl h-12 px-6 text-md font-bold shadow-md transition-all active:scale-95 cursor-pointer text-white">
              <Plus size={20} className="mr-2" /> Thêm Bài học mới
            </Button>
          </div>

          {/* TRẠNG THÁI LOADING */}
          {isLoading ? (
            <div className="flex justify-center items-center py-20 text-blue-500">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
          ) : (
            <>
              {/* DANH SÁCH BÀI HỌC (DẠNG LƯỚI / HÀNG NGANG) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex flex-col p-5 border border-slate-200 rounded-2xl bg-white hover:border-blue-300 hover:shadow-lg transition-all group cursor-pointer h-full"
                    onClick={() =>
                      console.log("Mở nội dung topic: ", topic.title)
                    }
                  >
                    <div className="flex justify-between items-start mb-5">
                      <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <FileText size={24} strokeWidth={2} />
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg ${topic.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {topic.status === "published" ? "Xuất bản" : "Bản nháp"}
                      </span>
                    </div>

                    <div className="mb-6 flex-1">
                      <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-lg line-clamp-2 leading-snug">
                        {topic.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3 font-medium">
                        <Clock size={14} />
                        Ngày tạo:{" "}
                        {new Date(topic.created_at).toLocaleDateString("vi-VN")}
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md">
                        Thứ tự: {topic.order_index}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 h-9 w-9 rounded-lg cursor-pointer"
                          title="Xem trước"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 h-9 w-9 rounded-lg cursor-pointer"
                          title="Chỉnh sửa"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Pencil size={18} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-9 w-9 rounded-lg cursor-pointer"
                          title="Xóa bài học"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trạng thái trống (Empty State) */}
              {topics.length === 0 && (
                <div className="text-center py-20 px-4 border border-dashed border-slate-300 rounded-2xl bg-white shadow-sm mt-4">
                  <div className="bg-slate-50 text-slate-300 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={32} />
                  </div>
                  <p className="text-slate-500 font-medium text-lg">
                    Chương này chưa có bài học nào.
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    Hãy bấm Thêm Bài học mới để bắt đầu xây dựng nội dung.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
