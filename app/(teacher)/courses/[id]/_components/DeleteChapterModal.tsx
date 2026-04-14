import React from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteChapterModalProps {
  chapterToDelete: string | null;
  setChapterToDelete: (id: string | null) => void;
  handleConfirmDelete: () => void;
  isPending: boolean;
}

export default function DeleteChapterModal({ chapterToDelete, setChapterToDelete, handleConfirmDelete, isPending }: DeleteChapterModalProps) {
  return (
    <Dialog open={!!chapterToDelete} onOpenChange={(open) => !open && setChapterToDelete(null)}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-100 rounded-full"><Trash2 className="text-rose-600" size={24} /></div>
            <DialogTitle className="text-xl font-bold">Xóa Chương</DialogTitle>
          </div>
        </DialogHeader>
        <DialogDescription className="text-slate-600 mt-2">Hành động này sẽ ẩn chương này khỏi khóa học. Bạn có chắc chắn?</DialogDescription>
        <DialogFooter className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => setChapterToDelete(null)}>Hủy bỏ</Button>
          <Button disabled={isPending} onClick={handleConfirmDelete} className="bg-rose-600 hover:bg-rose-700">
            {isPending ? "Đang xóa..." : "Xóa vĩnh viễn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}