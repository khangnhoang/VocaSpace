"use client";

import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { AnimatePresence, useIsPresent, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;

type CatalogAnimatedGridProps = {
  pageKey: number;
  fadeIn: boolean;
  id: string;
  className: string;
  items: { key: string; node: ReactNode }[];
};

/**
 * Lưới khóa học của /courses (U2 AC10). Ba lớp tách riêng để không tranh cùng một thuộc tính: m.div lo layout/enter/exit
 * (transform của Motion), div reveal lo hiện dần khi cuộn (transform CSS), còn thẻ bên trong dùng `translate` cho hover.
 */
export function CatalogAnimatedGrid({ pageKey, fadeIn, id, className, items }: CatalogAnimatedGridProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  useScrollReveal(containerRef, pageKey, reduceMotion);

  return (
    <m.div
      key={pageKey}
      ref={containerRef}
      id={id}
      className={cn("relative", className)}
      // Lần render đầu giữ nguyên nội dung server-rendered; chỉ trang do người dùng chuyển tới mới fade-in.
      initial={fadeIn && !reduceMotion ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) => (
          <GridItem key={item.key} reduceMotion={reduceMotion}>
            {item.node}
          </GridItem>
        ))}
      </AnimatePresence>
    </m.div>
  );
}

function GridItem({
  children,
  reduceMotion,
  ref,
}: {
  children: ReactNode;
  reduceMotion: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  // Thẻ đang rời đi không còn là kết quả: chặn focus/click và ẩn khỏi trình đọc màn hình ngay lập tức.
  const isPresent = useIsPresent();
  return (
    <m.div
      ref={ref}
      layout={reduceMotion ? false : "position"}
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
      transition={{
        layout: { duration: 0.52, ease: EASE },
        opacity: { duration: reduceMotion ? 0 : 0.36, ease: EASE },
        scale: { duration: 0.42, ease: EASE },
      }}
      inert={!isPresent}
      aria-hidden={isPresent ? undefined : true}
      className="h-full"
    >
      <div
        data-reveal-item=""
        className="h-full transition-[opacity,transform] duration-[700ms] ease-[cubic-bezier(0.4,0,0.2,1)] data-[reveal=pending]:[transform:translateY(18px)] data-[reveal=pending]:opacity-0"
      >
        {children}
      </div>
    </m.div>
  );
}

/**
 * Hiện dần khi cuộn (Owner decision 6): chỉ gắn sau khi hydrate và chỉ cho thẻ đang nằm dưới màn hình lúc đó, nên nội dung
 * server-rendered và thẻ trong màn hình đầu không bao giờ bị ẩn (G7). Gỡ hiệu ứng thì mọi thẻ còn chờ hiện ngay.
 */
function useScrollReveal(containerRef: { current: HTMLDivElement | null }, pageKey: number, reduceMotion: boolean) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || reduceMotion || typeof IntersectionObserver === "undefined") return;
    const pending = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal-item]")).filter(
      (element) => element.getBoundingClientRect().top > window.innerHeight,
    );
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              left.boundingClientRect.top - right.boundingClientRect.top ||
              left.boundingClientRect.left - right.boundingClientRect.left,
          )
          .forEach((entry, index) => {
            const element = entry.target as HTMLElement;
            element.style.transitionDelay = `${Math.min(index, 7) * 70}ms`;
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

    return () => {
      observer.disconnect();
      pending.forEach((element) => {
        element.dataset.reveal = "in";
        element.style.transitionDelay = "";
      });
    };
  }, [containerRef, pageKey, reduceMotion]);
}
