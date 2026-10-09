"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Matches the `lg:top-4` offset below; the column must fit with this gap above and below. */
const STICKY_GAP = 16;

interface StickyColumnProps {
  /** Only the two-column layout pins a column; stacked layouts scroll as one page. */
  enabled: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * One column of the exercise layout that stays in view while the other, longer
 * column (a passage, usually) scrolls with the page. A pinned element taller
 * than the viewport would hide its own lower part, so the column is pinned only
 * while it measurably fits; otherwise it scrolls normally. The result is a
 * `data-sticky` attribute set from the measurement, which the wide-screen
 * classes read, so a resize or new content re-decides without re-rendering.
 */
export default function StickyColumn({ enabled, className = "", children }: StickyColumnProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const measure = () => {
      element.dataset.sticky =
        element.offsetHeight + STICKY_GAP * 2 <= window.innerHeight ? "true" : "false";
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [enabled]);

  return (
    <div
      ref={ref}
      className={`${className} ${
        enabled ? "lg:data-[sticky=true]:sticky lg:data-[sticky=true]:top-4" : ""
      }`}
    >
      {children}
    </div>
  );
}
