"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { touchStrongFineQuiet } from "./touch-action-classes";

interface TitleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** Ô nhập tên có nhãn; form hoặc state bên ngoài sở hữu giá trị và lỗi. */
  children: React.ReactNode;
}

// Hộp thoại chung cho tạo chương, tạo bài học và đổi tên bài học trên điện thoại.
export default function TitleFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
  onCloseAutoFocus,
  children,
}: TitleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              className={cn("h-11 [@media(hover:hover)_and_(pointer:fine)]:h-9", touchStrongFineQuiet)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              aria-busy={isPending || undefined}
              className="h-11 [@media(hover:hover)_and_(pointer:fine)]:h-9"
            >
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {isPending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
