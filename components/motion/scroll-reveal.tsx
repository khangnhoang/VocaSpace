"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { REVEAL_ITEM_ATTRIBUTE } from "./reveal-item";

type ScrollRevealGroupProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Hiện dần các phần tử `revealItemProps` khi cuộn tới, theo cùng quy tắc với lưới /courses (U2 G7): chỉ gắn sau khi hydrate,
 * chỉ cho phần tử đang nằm dưới màn hình lúc đó, focus vào phần tử chưa hiện thì hiện ngay, và gỡ hiệu ứng thì mọi phần tử
 * còn chờ hiện ngay. Giảm chuyển động thì không gắn gì cả.
 */
export function ScrollRevealGroup({ children, className }: ScrollRevealGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reduceMotion || typeof IntersectionObserver === "undefined") return;
    const pending = Array.from(container.querySelectorAll<HTMLElement>(`[${REVEAL_ITEM_ATTRIBUTE}]`)).filter(
      (element) => element.getBoundingClientRect().top > window.innerHeight,
    );
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)
          .forEach((entry, index) => {
            const element = entry.target as HTMLElement;
            element.style.transitionDelay = `${Math.min(index, 5) * 80}ms`;
            element.dataset.reveal = "in";
            observer.unobserve(element);
          });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    pending.forEach((element) => {
      element.dataset.reveal = "pending";
      observer.observe(element);
    });
    const revealOnFocus = (event: FocusEvent) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>('[data-reveal="pending"]');
      if (!element) return;
      element.style.transitionDelay = "0ms";
      element.dataset.reveal = "in";
      observer.unobserve(element);
    };
    container.addEventListener("focusin", revealOnFocus);

    return () => {
      container.removeEventListener("focusin", revealOnFocus);
      observer.disconnect();
      pending.forEach((element) => {
        element.dataset.reveal = "in";
        element.style.transitionDelay = "";
      });
    };
  }, [reduceMotion]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
