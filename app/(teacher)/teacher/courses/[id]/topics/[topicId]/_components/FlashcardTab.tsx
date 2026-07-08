"use client";
import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2, BookType, CopyPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Card } from "@/app/(teacher)/teacher/courses/[id]/_components/types";
import { getCardsByTopicId, deleteCard } from "@/app/actions/card";
import AddFlashcardDialog from "@/app/(teacher)/teacher/courses/[id]/_components/AddFlashcardDialog";
import BulkAddFlashcardDialog from "./BulkAddFlashcardDialog";
import type { CourseAuthoringSuccessEvent } from "@/lib/course-authoring/issue-success";

interface FlashcardTabProps {
  topicId: string;
  onAuthoringSuccess?: (event: CourseAuthoringSuccessEvent) => boolean;
}

export default function FlashcardTab({
  topicId,
  onAuthoringSuccess,
}: FlashcardTabProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // States cho Form (Thêm/Sửa)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  // States cho Modal Xóa
  const [deletingCard, setDeletingCard] = useState<Card | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  // State quản lý Modal thêm hàng loạt
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadCards = async () => {
      setIsLoading(true);
      const res = await getCardsByTopicId(topicId);
      if (isMounted) {
        if (res.data) setCards(res.data);
        setIsLoading(false);
      }
    };
    loadCards();
    return () => {
      isMounted = false;
    };
  }, [topicId, refreshKey]);

  // Hành động bấm nút Sửa
  const handleEditClick = (card: Card) => {
    setEditingCard(card);
    setIsFormOpen(true);
  };

  // Hành động bấm nút Thêm Mới
  const handleAddClick = () => {
    setEditingCard(null); // Reset data để hiện form trống
    setIsFormOpen(true);
  };

  // Xác nhận Xóa
  const handleConfirmDelete = () => {
    if (!deletingCard) return;
    startDeleteTransition(async () => {
      const res = await deleteCard(deletingCard.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        setDeletingCard(null);
        setRefreshKey((p) => p + 1);
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-150 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Kho từ vựng</h2>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý các thẻ flashcard trong bài học này
          </p>
        </div>
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 md:hidden">
          Tính năng soạn nội dung học phù hợp hơn trên màn hình lớn. Vui lòng dùng máy tính để thêm hoặc chỉnh sửa flashcard/bài tập.
        </p>
        {/* SỬA KHU VỰC BUTTON THÀNH 2 NÚT */}
        <div className="hidden gap-3 md:flex">
          <Button
            onClick={() => setIsBulkOpen(true)}
            variant="outline"
            className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-xl shadow-sm px-5 py-6 font-bold"
          >
            <CopyPlus size={18} className="mr-2" /> Thêm hàng loạt
          </Button>
          <Button
            onClick={handleAddClick}
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl shadow-sm px-5 py-6"
          >
            <Plus size={18} className="mr-2" /> Thêm thẻ mới
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-full min-h-75">
            <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-2xl">
            <BookType size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">
              Chưa có thẻ từ vựng nào
            </h3>
            <p className="mt-2 hidden font-medium text-slate-500 md:block">
              Bấm &quot;Thêm thẻ mới&quot; để bắt đầu xây dựng bài học.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {cards.map((card) => (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden hover:shadow-md hover:border-blue-300 transition-all group"
              >
                <div className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-4 min-h-40">
                  <div className="text-2xl font-black text-slate-800">
                    {card.front_content.word}{" "}
                    <span className="text-sm text-slate-400 italic">
                      ({card.front_content.pos})
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md font-mono border border-slate-100">
                    {card.front_content.phonetic}
                  </div>
                  <div className="text-lg font-bold text-blue-600 mt-2">
                    {card.back_content.translation}
                  </div>
                </div>
                <div className="hidden justify-center gap-6 border-t border-slate-100 bg-slate-50 p-3 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
                  <Button
                    onClick={() => handleEditClick(card)}
                    variant="ghost"
                    size="icon"
                    aria-label="Sửa thẻ từ vựng"
                    className="text-slate-400 hover:text-blue-600 hover:bg-blue-100"
                  >
                    <Pencil size={18} />
                  </Button>
                  <Button
                    onClick={() => setDeletingCard(card)}
                    variant="ghost"
                    size="icon"
                    aria-label="Xóa thẻ từ vựng"
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FORM THÊM/SỬA ĐA NĂNG */}
      <AddFlashcardDialog
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        topicId={topicId}
        initialData={editingCard} // Truyền data sửa vào đây
        onSuccess={() => setRefreshKey((prev) => prev + 1)}
        onCreateSuccess={
          editingCard
            ? undefined
            : () =>
                onAuthoringSuccess?.({
                  type: "flashcard_created",
                  topicId,
                }) ?? false
        }
      />

      <BulkAddFlashcardDialog 
        isOpen={isBulkOpen} 
        setIsOpen={setIsBulkOpen} 
        topicId={topicId} 
        onSuccess={() => setRefreshKey((prev) => prev + 1)} 
      />

      {/* MODAL XÁC NHẬN XÓA */}
      <Dialog
        open={!!deletingCard}
        onOpenChange={(open) => !open && setDeletingCard(null)}
      >
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-full">
                <Trash2 className="text-rose-600" size={24} />
              </div>
              <DialogTitle className="text-xl font-bold">
                Xóa từ vựng
              </DialogTitle>
            </div>
            <DialogDescription className="hidden">Xác nhận xóa thẻ từ vựng</DialogDescription>
          </DialogHeader>
          <p className="text-slate-600 mt-2">
            Bạn có chắc chắn muốn xóa thẻ từ{" "}
            <span className="font-bold text-slate-900">
              {deletingCard?.front_content.word}
            </span>{" "}
            không?
          </p>
          <div className="mt-6 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeletingCard(null)}
              className="rounded-xl"
            >
              Hủy bỏ
            </Button>
            <Button
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              {isDeleting ? (
                <Loader2 className="animate-spin mr-2" size={18} />
              ) : (
                "Xóa vĩnh viễn"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
