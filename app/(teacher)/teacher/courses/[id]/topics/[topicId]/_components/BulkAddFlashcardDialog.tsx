"use client";
import React, { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { createBulkCards } from "@/app/actions/card";
import { CardFormValues } from "@/lib/schemas/card";

interface BulkAddFlashcardDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  topicId: string;
  onSuccess: () => void;
}

export default function BulkAddFlashcardDialog({ isOpen, setIsOpen, topicId, onSuccess }: BulkAddFlashcardDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [rawText, setRawText] = useState("");

  const handleProcessAndSubmit = () => {
    if (!rawText.trim()) {
      toast.error("Vui lòng nhập dữ liệu!");
      return;
    }

    // Tách văn bản theo từng dòng
    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    const parsedCards: CardFormValues[] = [];

    for (let i = 0; i < lines.length; i++) {
      // Tách từng cột bằng dấu |
      const parts = lines[i].split('|').map(part => part.trim());
      
      // Kiểm tra tối thiểu phải có Từ vựng (cột 1) và Nghĩa (cột 2)
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        toast.error(`Lỗi ở dòng ${i + 1}: Thiếu từ vựng hoặc nghĩa.`);
        return;
      }

      parsedCards.push({
        word: parts[0],
        translation: parts[1],
        pos: parts[2] || undefined,
        phonetic: parts[3] || undefined,
        example: parts[4] || undefined,
        exampleTranslation: parts[5] || undefined,
        hint: parts[6] || undefined,
      });
    }

    startTransition(async () => {
      const res = await createBulkCards(topicId, parsedCards);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message);
        setRawText("");
        setIsOpen(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl bg-white rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-full text-emerald-600"><FileUp size={24} /></div>
            <DialogTitle className="text-xl font-bold">Thêm hàng loạt từ vựng</DialogTitle>
          </div>
          <DialogDescription className="text-slate-500 mt-2">
            Sao chép từ Excel hoặc gõ văn bản theo cấu trúc: <br/>
            <strong className="text-blue-600 font-sans text-xs">Từ vựng | Nghĩa tiếng Việt | Từ loại | Phiên âm | Câu ví dụ | Dịch ví dụ | Mẹo nhớ</strong><br/>
            (Chỉ có Từ vựng và Nghĩa là bắt buộc, các cột sau có thể bỏ trống).
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <Textarea 
            placeholder="Ví dụ:&#10;Abandon | Từ bỏ | verb | /əˈbæn.dən/ | He abandoned his car. | Anh ta bỏ lại xe. | A(bạn)đần&#10;Absolute | Tuyệt đối | adj" 
            className="min-h-75 font-sans text-sm bg-slate-50 border-slate-200 rounded-xl p-4"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Hủy</Button>
          <Button disabled={isPending} onClick={handleProcessAndSubmit} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl">
            {isPending ? <Loader2 className="animate-spin mr-2" size={18}/> : "Xử lý & Lưu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}