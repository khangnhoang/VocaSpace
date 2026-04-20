// File: app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx
import React, { useState } from "react";
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  FileText,
  ArrowLeft,
  Clock,
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
  DialogTrigger,
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
import { Chapter, Topic } from "./types";

interface TopicManagementSheetProps {
  chapter: Chapter | null;
  onClose: () => void;
}

// ==========================================
// MOCK DATA CHO FLASHCARDS (BẢN XEM TRƯỚC)
// ==========================================
const mockCards = [
  {
    id: "c1",
    word: "Abandon",
    pos: "verb",
    phonetic: "/əˈbæn.dən/",
    translation: "Từ bỏ, ruồng bỏ",
  },
  {
    id: "c2",
    word: "Ability",
    pos: "noun",
    phonetic: "/əˈbɪl.ə.ti/",
    translation: "Khả năng, năng lực",
  },
  {
    id: "c3",
    word: "Abolish",
    pos: "verb",
    phonetic: "/əˈbɒl.ɪʃ/",
    translation: "Thủ tiêu, bãi bỏ",
  },
  {
    id: "c4",
    word: "Abruptly",
    pos: "adv",
    phonetic: "/əˈbrʌpt.li/",
    translation: "Một cách đột ngột",
  },
];

export default function TopicManagementSheet({
  chapter,
  onClose,
}: TopicManagementSheetProps) {
  const [topics, setTopics] = useState<Topic[]>([
    {
      id: "mock-1",
      chapter_id: chapter?.id || "unknown",
      title: "Bài 1: Từ vựng TOEIC cốt lõi",
      status: "published",
      order_index: 1,
      created_at: "2026-04-15T08:00:00.000Z",
    },
    {
      id: "mock-2",
      chapter_id: chapter?.id || "unknown",
      title: "Bài 2: Ngữ pháp nền tảng - Các thì cơ bản",
      status: "pending",
      order_index: 2,
      created_at: "2026-04-16T14:30:00.000Z",
    },
    {
      id: "mock-3",
      chapter_id: chapter?.id || "unknown",
      title: "Bài 3: Luyện nghe Part 1 - Mô tả tranh tả người",
      status: "draft",
      order_index: 3,
      created_at: "2026-04-17T09:15:00.000Z",
    },
  ]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [newStatus, setNewStatus] = useState<"draft" | "pending" | "published">(
    "draft",
  );

  const [previewTopic, setPreviewTopic] = useState<Topic | null>(null);

  const handleAddTopic = () => {
    if (!newTitle.trim()) {
      alert("Vui lòng nhập tên bài học!");
      return;
    }

    const newTopic: Topic = {
      id: `topic-${Date.now()}`,
      chapter_id: chapter?.id || "unknown",
      title: newTitle,
      status: newStatus,
      order_index: newOrder ? parseInt(newOrder) : topics.length + 1,
      created_at: new Date().toISOString(),
    };

    setTopics([...topics, newTopic]);
    setNewTitle("");
    setNewOrder("");
    setNewStatus("draft");
    setIsAddDialogOpen(false);
  };

  if (!chapter) return null;

  return (
    <>
      {/* ========================================== */}
      {/* 1. SHEET QUẢN LÝ BÀI HỌC (TOPICS) */}
      {/* ========================================== */}
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

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full md:w-auto bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl h-12 px-6 text-md font-bold shadow-md transition-all active:scale-95 cursor-pointer text-white">
                    <Plus size={20} className="mr-2" /> Thêm Bài học mới
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-120 bg-white rounded-2xl border border-slate-200 shadow-2xl p-0 overflow-hidden">
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

                  <div className="p-6 space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Tên bài học
                      </label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Nhập tên bài học..."
                        className="h-12 border-slate-200 focus-visible:ring-[#3B82F6] rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Thứ tự hiển thị
                        </label>
                        <Input
                          type="number"
                          value={newOrder}
                          onChange={(e) => setNewOrder(e.target.value)}
                          placeholder="Ví dụ: 1"
                          className="h-12 border-slate-200 focus-visible:ring-[#3B82F6] rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Trạng thái
                        </label>
                        <Select
                          value={newStatus}
                          onValueChange={(
                            value: "draft" | "pending" | "published",
                          ) => setNewStatus(value)}
                        >
                          <SelectTrigger className="w-full h-12 border-slate-200 focus:ring-[#3B82F6] rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            sideOffset={4}
                            className="bg-white rounded-xl shadow-xl border-slate-100"
                          >
                            <SelectItem
                              value="draft"
                              className="cursor-pointer py-2.5 font-medium focus:bg-slate-50"
                            >
                              Bản nháp
                            </SelectItem>
                            <SelectItem
                              value="pending"
                              className="cursor-pointer py-2.5 font-medium focus:bg-amber-50 focus:text-amber-600"
                            >
                              Chờ duyệt
                            </SelectItem>
                            <SelectItem
                              value="published"
                              className="cursor-pointer py-2.5 font-medium focus:bg-emerald-50 focus:text-emerald-600"
                            >
                              Xuất bản
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="px-6 py-5 border-t border-slate-100 bg-slate-50/50 flex gap-3 justify-end">
                    <DialogClose asChild>
                      <Button
                        variant="ghost"
                        className="px-5 h-11 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Hủy bỏ
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleAddTopic}
                      className="px-6 h-11 text-sm font-semibold text-white bg-[#3B82F6] rounded-xl shadow-md hover:bg-[#2563EB] active:scale-95 transition-all cursor-pointer"
                    >
                      Tạo Bài học
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {topics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {topics
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((topic) => (
                    <div
                      key={topic.id}
                      className="flex flex-col p-5 border border-slate-200 rounded-2xl bg-white hover:border-blue-300 hover:shadow-lg transition-all group cursor-pointer h-full"
                      onClick={() =>
                        console.log("Mở trình soạn thảo bài học: ", topic.title)
                      }
                    >
                      <div className="flex justify-between items-start mb-5">
                        <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
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
                          {topic.status === "published"
                            ? "Xuất bản"
                            : topic.status === "pending"
                              ? "Chờ duyệt"
                              : "Bản nháp"}
                        </span>
                      </div>

                      <div className="mb-6 flex-1">
                        <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-lg line-clamp-2 leading-snug">
                          {topic.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3 font-medium">
                          <Clock size={14} />
                          Ngày tạo:{" "}
                          {new Date(topic.created_at).toLocaleDateString(
                            "vi-VN",
                          )}
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md">
                          Thứ tự: {topic.order_index}
                        </span>
                        <div className="flex items-center gap-1">
                          {/* NÚT XEM TRƯỚC */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 h-9 w-9 rounded-lg cursor-pointer"
                            title="Xem trước"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewTopic(topic);
                            }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setTopics(
                                topics.filter((t) => t.id !== topic.id),
                              );
                            }}
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
                <p className="text-slate-400 text-sm mt-1">
                  Hãy bấm Thêm Bài học mới để bắt đầu xây dựng nội dung.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ========================================== */}
      {/* 2. SHEET XEM TRƯỚC (REVIEW FLASHCARDS) */}
      {/* ========================================== */}
      <Sheet
        open={!!previewTopic}
        onOpenChange={(open) => !open && setPreviewTopic(null)}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="bg-slate-50 border border-slate-200 shadow-2xl w-[90vw]! sm:max-w-[90vw]! h-[90vh]! top-[5vh]! right-[5vw]! rounded-2xl p-0 flex flex-col overflow-hidden"
        >
          {/* HEADER: Nút Quay lại bên trái, Nút Sửa bên phải */}
          <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between z-10">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl h-10 w-10 cursor-pointer"
              onClick={() => setPreviewTopic(null)}
            >
              <ArrowLeft size={22} />
            </Button>

            {/* Để tránh lỗi cảnh báo Accessiblity của Dialog/Sheet */}
            <SheetTitle className="sr-only">Xem trước bài học</SheetTitle>

            <Button
              variant="outline"
              className="text-slate-700 font-bold border-slate-300 hover:bg-slate-100 rounded-xl h-10 px-5 cursor-pointer"
            >
              <Pencil size={18} className="mr-2" /> Sửa
            </Button>
          </div>

          {/* CONTENT: Lưới các Flashcards */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 relative">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Render các thẻ mockCards ra */}
                {mockCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden hover:shadow-md hover:border-blue-300 transition-all group"
                  >
                    {/* Phần nội dung Thẻ (Mặt trước giả lập) */}
                    <div className="p-8 flex-1 flex flex-col justify-center items-center text-center space-y-4">
                      <div className="text-2xl font-black text-slate-800">
                        {card.word}{" "}
                        <span className="text-sm font-medium text-slate-400 italic font-serif">
                          ({card.pos})
                        </span>
                      </div>

                      <div className="text-base text-slate-500 bg-slate-50 px-3 py-1 rounded-md font-mono">
                        {card.phonetic}
                      </div>

                      <div className="text-lg font-bold text-blue-600 mt-2">
                        {card.translation}
                      </div>
                    </div>

                    {/* Phần Footer (Các nút hành động) */}
                    <div className="bg-slate-50 border-t border-slate-100 p-3 flex justify-center gap-6 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg cursor-pointer"
                        title="Sửa thẻ"
                      >
                        <Pencil size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer"
                        title="Xóa thẻ"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
