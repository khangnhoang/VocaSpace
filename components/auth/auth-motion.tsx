"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

const EASE = [0.2, 0, 0, 1] as const;

// U3 AC13: nội dung mới trượt vào theo hướng đi (tiến/lùi). Lần render đầu không ẩn gì (G10): chỉ khi `motionKey` đổi
// trên client mới có hiệu ứng vào; không có hiệu ứng ra để ô nhập của bước mới dùng được ngay.
export function SlideIn({ motionKey, direction, children }: { motionKey: string; direction: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [previousKey, setPreviousKey] = useState(motionKey);
  const [hasMoved, setHasMoved] = useState(false);
  if (previousKey !== motionKey) {
    setPreviousKey(motionKey);
    setHasMoved(true);
  }

  return (
    <m.div
      key={motionKey}
      initial={hasMoved && !reduceMotion ? { opacity: 0, x: direction * 24 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.36, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

// Khung co giãn mượt theo chiều cao nội dung (đổi bước, hiện lỗi). Khung nới ra 6px mỗi phía (lề âm + đệm) để viền focus
// 2px cách ô 2px không bị `overflow: clip` cắt, kể cả trên trình duyệt không hỗ trợ `overflow-clip-margin`.
export function AutoHeight({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <m.div
      initial={false}
      animate={{ height }}
      transition={{ duration: reduceMotion ? 0 : 0.32, ease: EASE }}
      style={{ overflow: "clip", overflowClipMargin: 8, margin: -6, padding: 6, boxSizing: "content-box" }}
    >
      <div ref={innerRef}>{children}</div>
    </m.div>
  );
}
