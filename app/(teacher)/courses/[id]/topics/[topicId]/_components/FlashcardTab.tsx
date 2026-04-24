import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BookType,
} from "lucide-react";
import { Topic, Card } from "@/app/(teacher)/courses/[id]/_components/types";
import { getCardsByTopicId } from "@/app/actions/card";
import AddFlashcardDialog from "@/app/(teacher)/courses/[id]/_components/AddFlashcardDialog";

interface FlashcardPreviewSheetProps {
  topic: Topic | null;
  onClose: () => void;
}

export default function FlashcardPreviewSheet({
  topic,
  onClose,
}: FlashcardPreviewSheetProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // 1. STATE KÍCH HOẠT FETCH LẠI DỮ LIỆU
  const [refreshKey, setRefreshKey] = useState(0);

  // 2. NHÉT HẾT LOGIC VÀO TRONG useEffect
  useEffect(() => {
    let isMounted = true; // Chống rò rỉ bộ nhớ (Memory leak)

    const loadCards = async () => {
      if (!topic) return;
      setIsLoading(true);
      const res = await getCardsByTopicId(topic.id);

      if (isMounted) {
        if (res.data) setCards(res.data);
        setIsLoading(false);
      }
    };

    loadCards();

    return () => {
      isMounted = false; // Khi tắt Sheet, hủy bỏ việc cập nhật state
    };
  }, [topic, refreshKey]); // Khi refreshKey tăng 1 -> Tự chạy lại loadCards

  if (!topic) return null;

  return (
    <>
      <Sheet open={!!topic} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          showCloseButton={false}
          className="bg-slate-50 border-slate-200 w-[90vw]! sm:max-w-[90vw]! h-[90vh]! top-[5vh]! right-[5vw]! rounded-2xl p-0 flex flex-col overflow-hidden"
        >
          <div className="bg-white px-4 py-3 border-b flex items-center justify-between z-10">
            <Button variant="ghost" onClick={onClose}>
              <ArrowLeft size={22} />
            </Button>
            <SheetTitle className="text-xl font-bold">{topic.title}</SheetTitle>
            <Button
              onClick={() => setIsAddCardOpen(true)}
              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl"
            >
              <Plus size={18} className="mr-2" /> Thêm thẻ
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <BookType size={40} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">
                  Chưa có từ vựng nào. Bấm Thêm thẻ để bắt đầu!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden hover:shadow-md hover:border-blue-300 transition-all group"
                  >
                    <div className="p-8 flex-1 flex flex-col justify-center items-center text-center space-y-4">
                      {/* Dữ liệu thật được truy xuất từ JSONB */}
                      <div className="text-2xl font-black text-slate-800">
                        {card.front_content.word}{" "}
                        <span className="text-sm text-slate-400 italic">
                          ({card.front_content.pos})
                        </span>
                      </div>
                      <div className="text-base text-slate-500 bg-slate-50 px-3 py-1 rounded-md font-mono">
                        {card.front_content.phonetic}
                      </div>
                      <div className="text-lg font-bold text-blue-600 mt-2">
                        {card.back_content.translation}
                      </div>
                    </div>
                    <div className="bg-slate-50 border-t p-3 flex justify-center gap-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-blue-600"
                      >
                        <Pencil size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Gọi Modal Thêm Thẻ ra đây */}
      <AddFlashcardDialog
        isOpen={isAddCardOpen}
        setIsOpen={setIsAddCardOpen}
        topicId={topic.id}
        onSuccess={() => setRefreshKey((prev) => prev + 1)} // Load lại data ngay sau khi thêm
      />
    </>
  );
}
