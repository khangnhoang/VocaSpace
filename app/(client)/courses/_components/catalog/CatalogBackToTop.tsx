"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, useIsPresent, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUp } from "lucide-react";

type CatalogBackToTopProps = {
  gridId: string;
  /** Hiện nút khi thẻ thứ mấy (tính từ 1) đã trôi lên khỏi mép trên màn hình. */
  afterCard: number;
  focusTargetId: string;
};

/**
 * Nút "Lên đầu trang" cho màn hình dưới lg (Owner QA 2026-11-05): danh sách một cột trên mobile rất dài, nên sau khi
 * lướt qua khoảng hai khóa thì có đường quay lại thanh tìm kiếm/bộ lọc ở đầu trang.
 */
export function CatalogBackToTop({ gridId, afterCard, focusTargetId }: CatalogBackToTopProps) {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const card = document.getElementById(gridId)?.children.item(afterCard - 1);
      setVisible(card ? card.getBoundingClientRect().top < 0 : false);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [gridId, afterCard]);

  function backToTop() {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // Đưa focus về tiêu đề trang (không phải ô tìm kiếm) để không bật bàn phím ảo trên mobile.
    document.getElementById(focusTargetId)?.focus({ preventScroll: true });
  }

  return (
    <AnimatePresence>
      {visible ? <BackToTopButton key="back-to-top" reduceMotion={reduceMotion} onClick={backToTop} /> : null}
    </AnimatePresence>
  );
}

function BackToTopButton({ reduceMotion, onClick }: { reduceMotion: boolean; onClick: () => void }) {
  // Đang ẩn đi thì không còn là thao tác khả dụng: chặn focus/click và ẩn khỏi trình đọc màn hình ngay.
  const isPresent = useIsPresent();
  return (
    <m.button
      type="button"
      onClick={onClick}
      aria-label="Lên đầu trang"
      inert={!isPresent}
      aria-hidden={isPresent ? undefined : true}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.4, 0, 0.2, 1] }}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex size-12 items-center justify-center rounded-full border border-slate-500 bg-white text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.16)] transition-colors duration-150 hover:border-route hover:text-route focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route lg:hidden"
    >
      <ArrowUp aria-hidden="true" className="size-5" />
    </m.button>
  );
}
