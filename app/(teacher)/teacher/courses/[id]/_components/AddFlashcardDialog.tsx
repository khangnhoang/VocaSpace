"use client";
import React, { useEffect, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cardSchema, type CardFormValues } from "@/lib/schemas/card";
import { createCard, updateCard } from "@/app/actions/card";
import { Card } from "./types";

interface AddFlashcardDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  topicId: string;
  initialData?: Card | null; // NẾU CÓ DATA -> CHẾ ĐỘ SỬA
  onSuccess: () => void;
  onCreateSuccess?: () => boolean;
}

export default function AddFlashcardDialog({ isOpen, setIsOpen, topicId, initialData, onSuccess, onCreateSuccess }: AddFlashcardDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: { word: "", pos: "", phonetic: "", translation: "", explanation: "", example: "", exampleTranslation: "", hint: "" }
  });

  // Tự động điền dữ liệu nếu là chế độ Sửa
  useEffect(() => {
    if (initialData && isOpen) {
      form.reset({
        word: initialData.front_content.word || "",
        pos: initialData.front_content.pos || "",
        phonetic: initialData.front_content.phonetic || "",
        translation: initialData.back_content.translation || "",
        explanation: initialData.back_content.explanation || "",
        example: initialData.back_content.example || "",
        exampleTranslation: initialData.back_content.exampleTranslation || "",
        hint: initialData.back_content.hint || "",
      });
    } else if (!isOpen) {
      // Clear form khi đóng
      form.reset({ word: "", pos: "", phonetic: "", translation: "", explanation: "", example: "", exampleTranslation: "", hint: "" });
    }
  }, [initialData, isOpen, form]);

  const onSubmit = (values: CardFormValues) => {
    startTransition(async () => {
      // Quyết định gọi API Sửa hay Thêm dựa vào initialData
      const res = initialData 
        ? await updateCard(initialData.id, values) 
        : await createCard(topicId, values);
        
      if (res.error) toast.error(res.error);
      else {
        // Parent chỉ trả true khi thẻ mới khớp vấn đề từ dashboard,
        // lúc đó tránh hiện thêm toast success trùng với thông báo inline.
        const handledByDashboardFeedback = !initialData && onCreateSuccess?.();

        if (!handledByDashboardFeedback) {
          toast.success(res.message);
        }

        setIsOpen(false);
        onSuccess(); 
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent showCloseButton={false} className="bg-white border-slate-200 shadow-2xl w-[90vw]! sm:max-w-[90vw]! h-[90vh]! top-[5vh]! right-[5vw]! left-auto! translate-x-0! translate-y-0! rounded-2xl p-0 flex flex-col z-60">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setIsOpen(false)}><ArrowLeft size={22} /></Button>
          <DialogTitle>{initialData ? "Sửa thẻ từ vựng" : "Thêm thẻ từ vựng mới"}</DialogTitle>
          <DialogDescription className="sr-only">
            {initialData
              ? "Cập nhật thông tin cho thẻ từ vựng trước khi lưu vào bài học."
              : "Nhập thông tin cho thẻ từ vựng trước khi lưu vào bài học."}
          </DialogDescription>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-4">
              <div>
                <Input placeholder="Từ vựng... (*)" className="h-12 border-slate-200 rounded-xl" {...form.register("word")} />
                {form.formState.errors.word && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.word.message}</p>}
              </div>
              <Input placeholder="Phiên âm" className="h-12 border-slate-200 rounded-xl" {...form.register("phonetic")} />
              <Input placeholder="Loại từ (vd: v, n...)" className="h-12 border-slate-200 rounded-xl" {...form.register("pos")} />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <Input placeholder="Định nghĩa (*)" className="h-12 border-slate-200 rounded-xl" {...form.register("translation")} />
                {form.formState.errors.translation && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.translation.message}</p>}
              </div>
              <Input placeholder="Giải thích từ" className="h-12 border-slate-200 rounded-xl" {...form.register("explanation")} />
              <Input placeholder="Câu ví dụ" className="h-12 border-slate-200 rounded-xl" {...form.register("example")} />
              <Input placeholder="Dịch câu ví dụ" className="h-12 border-slate-200 rounded-xl" {...form.register("exampleTranslation")} />
              <Input placeholder="Mẹo ghi nhớ" className="h-12 border-slate-200 rounded-xl" {...form.register("hint")} />
            </div>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-slate-100 mb-2">
          <Button disabled={isPending} onClick={form.handleSubmit(onSubmit)} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl h-11 px-8 text-base font-semibold">
            {isPending ? <Loader2 className="animate-spin mr-2" /> : "Xác nhận lưu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
