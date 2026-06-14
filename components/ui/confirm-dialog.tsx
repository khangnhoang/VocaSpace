"use client";
import type { ReactNode } from "react";
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
  loadingText?: string;
  details?: ReactNode;
}

export function ConfirmDialog({
  isOpen,
  setIsOpen,
  title = "Xác nhận hành động",
  description,
  onConfirm,
  isLoading = false,
  confirmText = "Xác nhận",
  loadingText,
  details,
}: ConfirmDialogProps) {
  const pendingText = loadingText ?? confirmText;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:max-w-lg sm:p-6">
        <DialogHeader className="gap-3 pr-8">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle className="min-w-0 text-lg font-bold leading-snug text-slate-950 sm:text-xl">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        {details ? <div className="mt-1">{details}</div> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setIsOpen(false)}
            className="w-full rounded-lg sm:w-auto"
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isLoading}
            onClick={onConfirm}
            className="w-full rounded-lg bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/30 sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {pendingText}
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
