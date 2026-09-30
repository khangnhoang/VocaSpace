"use client";

import { useLayoutEffect, useRef } from "react";

// Hộp thoại mở bằng state (không qua DialogTrigger) nên Radix không biết nút nào đã mở nó
// và trả focus về <body> khi đóng. Ghi lại phần tử đang focus lúc mở để trả focus đúng chỗ.
// `getTarget` cho phép chọn nơi khác sau khi thao tác thành công (ví dụ heading của chương
// kế tiếp khi nút mở đã biến mất); focus trap của hộp thoại chặn việc chuyển focus sớm hơn.
export function useDialogReturnFocus(
  open: boolean,
  getTarget?: () => HTMLElement | null,
) {
  const invokerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      invokerRef.current = document.activeElement;
    }
  }, [open]);

  return (event: Event) => {
    const invoker = invokerRef.current;
    invokerRef.current = null;
    const target = getTarget?.() ?? invoker;
    if (!target?.isConnected) return;
    event.preventDefault();
    target.focus();
  };
}
