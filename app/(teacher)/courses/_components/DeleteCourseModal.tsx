import React from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface DeleteCourseModalProps {
  courseToDelete: string | null;
  setCourseToDelete: (id: string | null) => void;
  handleConfirmDelete: () => void;
  isPending: boolean;
}

export default function DeleteCourseModal({ courseToDelete, setCourseToDelete, handleConfirmDelete, isPending }: DeleteCourseModalProps) {
  return (
    <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
      <AlertDialogContent className="bg-white border border-blue-100 text-slate-800 max-w-[90%] sm:max-w-md rounded-3xl p-6 shadow-2xl shadow-blue-900/10 outline-none">
        <AlertDialogHeader>
          <div className="flex flex-col items-center text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-4"><Trash2 className="h-8 w-8 text-blue-500" /></div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">Xác nhận chuyển vào thùng rác</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 mt-2 font-medium">Bạn có chắc chắn muốn xóa khóa học này không? Khóa học sẽ được ẩn đi nhưng vẫn có thể khôi phục lại sau nếu cần.</AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <div className="mt-6 flex gap-3 w-full">
          <button onClick={() => setCourseToDelete(null)} className="flex-1 cursor-pointer px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all rounded-xl font-bold">Hủy bỏ</button>
          <button onClick={handleConfirmDelete} disabled={isPending} className="flex-1 cursor-pointer px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-95 transition-all rounded-xl font-bold flex justify-center items-center">
            {isPending ? "Đang xử lý..." : "Đồng ý xóa"}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}