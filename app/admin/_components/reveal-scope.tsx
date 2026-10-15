"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentPropsWithoutRef } from "react";

type RevealPhase = "waiting" | "playing" | undefined;

const subscribeNothing = () => () => {};
const supportsObserver = () => typeof IntersectionObserver !== "undefined";
const supportsObserverOnServer = () => false;

/**
 * Lộ dần đúng một lần khi biểu đồ lần đầu vào khung nhìn (Admin design mục 14, 17).
 * undefined: không có IntersectionObserver (SSR, jsdom) nên không animation và mọi thứ hiện đầy đủ;
 * waiting: đã gắn observer, thanh/đường tạm cắt; playing: animation chạy và giữ nguyên, không lặp lại.
 * `active` false (panel ẩn) đưa về waiting, nên mỗi lần người dùng chọn lại cách xem thì cách xem đó lộ lại một lần.
 */
export function useRevealOnView(active = true) {
  const ref = useRef<HTMLDivElement>(null);
  const supported = useSyncExternalStore(subscribeNothing, supportsObserver, supportsObserverOnServer);
  const [played, setPlayed] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  // Panel vừa bị ẩn: quên lần đã chạy để lần chọn sau lộ lại một lần.
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setPlayed(false);
  }

  useEffect(() => {
    const element = ref.current;
    if (!supported || !active || played || !element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setPlayed(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [supported, active, played]);

  const phase: RevealPhase = !supported ? undefined : played && active ? "playing" : "waiting";
  return { ref, phase };
}

// Vùng chứa của một biểu đồ; CSS module đọc data-reveal để quyết định cắt hay chạy animation cho các thanh bên trong.
export function RevealScope({
  active,
  children,
  ...rest
}: { active?: boolean } & ComponentPropsWithoutRef<"div">) {
  const { ref, phase } = useRevealOnView(active);
  return (
    <div ref={ref} data-reveal={phase} {...rest}>
      {children}
    </div>
  );
}
