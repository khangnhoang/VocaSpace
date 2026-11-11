// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

const { mockEmbla } = vi.hoisted(() => ({ mockEmbla: vi.fn() }));
vi.mock("embla-carousel-react", () => ({ default: mockEmbla }));

// Test plan:
// - Mục tiêu: điều khiển carousel phản ánh vị trí hiện tại và điều hướng bằng bàn phím.
// - Loại test: component thật với API Embla được điều khiển trong test.
// - Invariant: trạng thái được đọc ban đầu, cập nhật khi select hoặc reInit, và gỡ listener khi unmount.

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("reads scroll availability on mount, select and reInit and unsubscribes on unmount", () => {
  type Listener = () => void;
  const listeners = { select: new Set<Listener>(), reInit: new Set<Listener>() };
  const api = {
    canScrollPrev: vi.fn(() => false),
    canScrollNext: vi.fn(() => true),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    on(event: keyof typeof listeners, listener: Listener) {
      listeners[event].add(listener);
      return api;
    },
    off(event: keyof typeof listeners, listener: Listener) {
      listeners[event].delete(listener);
      return api;
    },
  };
  mockEmbla.mockReturnValue([vi.fn(), api]);
  const { unmount } = render(
    <Carousel aria-label="Bộ thẻ">
      <CarouselContent><CarouselItem>Thẻ</CarouselItem></CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>,
  );
  const previous = screen.getByRole<HTMLButtonElement>("button", { name: "Previous slide" });
  const next = screen.getByRole<HTMLButtonElement>("button", { name: "Next slide" });
  expect(previous.disabled).toBe(true);
  expect(next.disabled).toBe(false);
  fireEvent.keyDown(screen.getByRole("region", { name: "Bộ thẻ" }), { key: "ArrowRight" });
  expect(api.scrollNext).toHaveBeenCalledTimes(1);

  api.canScrollPrev.mockReturnValue(true);
  api.canScrollNext.mockReturnValue(false);
  act(() => { listeners.select.forEach((listener) => listener()); });
  expect(previous.disabled).toBe(false);
  expect(next.disabled).toBe(true);
  api.canScrollPrev.mockReturnValue(false);
  act(() => { listeners.reInit.forEach((listener) => listener()); });
  expect(previous.disabled).toBe(true);

  unmount();
  expect(listeners.select.size).toBe(0);
  expect(listeners.reInit.size).toBe(0);
});
