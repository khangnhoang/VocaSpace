// File: app/admin/user-management/_components/DeleteConfirmModal.tsx
import React from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { AppUser } from "./types";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userToDelete: AppUser | null;
  setUserToDelete: (user: AppUser | null) => void;
  handleConfirmDelete: () => void;
  isSubmitting: boolean;
}

export default function DeleteConfirmModal({ isOpen, setIsOpen, userToDelete, setUserToDelete, handleConfirmDelete, isSubmitting }: DeleteConfirmModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setUserToDelete(null); }}>
      <AlertDialogContent className="bg-[#050B14] border border-[#1EE3CF]/30 text-white max-w-[90%] sm:max-w-md rounded-3xl p-6 shadow-2xl shadow-[#1EE3CF]/5 transition-all outline-none">
        <AlertDialogHeader>
          <div className="flex flex-col items-center text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4"><AlertTriangle className="h-8 w-8 text-rose-500" /></div>
            <AlertDialogTitle className="text-xl font-bold">Xác nhận xóa tài khoản</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 mt-2">
              Bạn có chắc chắn muốn xóa tài khoản của <span className="text-white font-semibold">{userToDelete?.name}</span> không? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <div className="mt-8 grid grid-cols-2 gap-3 w-full">
          <button onClick={() => setIsOpen(false)} className="w-full cursor-pointer px-4 py-2.5 bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all rounded-xl font-medium">Hủy bỏ</button>
          <button onClick={handleConfirmDelete} disabled={isSubmitting} className="w-full cursor-pointer px-4 py-2.5 bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-900/20 active:scale-95 transition-all rounded-xl font-medium">{isSubmitting ? "Đang xử lý..." : "Xóa tài khoản"}</button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}