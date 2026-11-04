"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type StepsRailProps = {
  className?: string;
  children: ReactNode;
};

// Đường nối ba bước được vẽ một lần khi khối cuộn vào màn hình. HTML server luôn có đường đầy đủ, nên khi không có JS,
// khi người dùng giảm chuyển động hoặc khi khối đã nằm trong màn hình lúc tải, đường vẫn hiện sẵn và không bị thu lại.
export default function StepsRail({ className, children }: StepsRailProps) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (list.getBoundingClientRect().top < window.innerHeight) return;

    list.dataset.drawn = "false";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        list.dataset.drawn = "true";
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <ol ref={listRef} className={cn("group/steps", className)}>
      {children}
    </ol>
  );
}
