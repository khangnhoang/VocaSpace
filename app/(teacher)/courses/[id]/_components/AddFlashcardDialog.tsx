import React, { useTransition } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cardSchema, type CardFormValues } from "@/lib/schemas/card";
import { createCard } from "@/app/actions/card";

interface AddFlashcardDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  topicId: string;
  onSuccess: () => void; // Gọi hàm này để báo component cha load lại list
}

export default function AddFlashcardDialog({ isOpen, setIsOpen, topicId, onSuccess }: AddFlashcardDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: { word: "", pos: "", phonetic: "", translation: "", explanation: "", example: "", exampleTranslation: "", hint: "" }
  });

  const onSubmit = (values: CardFormValues) => {
    startTransition(async () => {
      const res = await createCard(topicId, values);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message);
        form.reset();
        setIsOpen(false);
        onSuccess(); // Load lại danh sách thẻ
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent showCloseButton={false} className="bg-white border-slate-200 shadow-2xl w-[90vw]! sm:max-w-[90vw]! h-[90vh]! top-[5vh]! right-[5vw]! !left-auto !translate-x-0 !translate-y-0 rounded-2xl p-0 flex flex-col z-[60]">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setIsOpen(false)}><ArrowLeft size={22} /></Button>
          <DialogTitle>Thêm từ vựng mới</DialogTitle>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-8 items-start">
            {/* FRONT CONTENT */}
            <div className="flex flex-col gap-4">
              <div>
                <Input placeholder="Từ vựng... (*)" className="h-12 border-slate-200 rounded-xl" {...form.register("word")} />
                {form.formState.errors.word && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.word.message}</p>}
              </div>
              <Input placeholder="Phiên âm" className="h-12 border-slate-200 rounded-xl" {...form.register("phonetic")} />
              <Input placeholder="Loại từ (vd: v, n...)" className="h-12 border-slate-200 rounded-xl" {...form.register("pos")} />
            </div>

            {/* BACK CONTENT */}
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