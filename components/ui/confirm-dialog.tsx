"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  title?: string;
  description: string;
  onConfirm: () => void;
  isLoading?: boolean;
  confirmText?: string;
}

export function ConfirmDialog({
  isOpen,
  setIsOpen,
  title = "Xác nhận hành động",
  description,
  onConfirm,
  isLoading = false,
  confirmText = "Xác nhận",
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-100 rounded-full text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-slate-600 text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">
            Hủy bỏ
          </Button>
          <Button
            disabled={isLoading}
            onClick={onConfirm}
            className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
          >
            {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}