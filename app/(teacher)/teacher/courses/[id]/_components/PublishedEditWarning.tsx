"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface PublishedEditWarning {
  title: string;
  description: string;
  confirmText: string;
}

interface PendingWarning extends PublishedEditWarning {
  resolve: (confirmed: boolean) => void;
}

// Cảnh báo là UX phía client: server không cần xác nhận cho sửa nội dung (TFEAT1 G4), nên người gọi
// phải `await confirm(...)` TRƯỚC khi gọi server action và dừng hẳn khi nhận `false`.
export function usePublishedEditWarning(): {
  confirm: (warning: PublishedEditWarning) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingWarning | null>(null);
  const pendingRef = useRef<PendingWarning | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(confirmed);
  }, []);

  const confirm = useCallback((warning: PublishedEditWarning) => {
    // Một cảnh báo mới thay cảnh báo đang mở: cảnh báo cũ coi như bị hủy.
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { ...warning, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  // Rời màn hình khi cảnh báo còn mở thì coi là hủy, để caller không treo vô hạn.
  useEffect(
    () => () => {
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    },
    [],
  );

  const dialog = (
    <ConfirmDialog
      isOpen={pending !== null}
      setIsOpen={(open) => {
        if (!open) settle(false);
      }}
      title={pending?.title}
      description={pending?.description ?? ""}
      confirmText={pending?.confirmText}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}

// Dùng trong hộp thoại xóa có sẵn của bài học đã xuất bản, để không phải hiện thêm lời nhắc thứ hai.
export function PublishedImpactNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900"
    >
      <AlertTriangle aria-hidden="true" className="mt-1 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
