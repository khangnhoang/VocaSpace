import type { CSSProperties } from "react";

/**
 * Thời lượng và độ trễ lộ dần của một thanh (Admin design mục 17): 200ms + 700ms × (giá trị ÷ giá trị lớn nhất),
 * các thanh bắt đầu lệch nhau min(100ms, 300ms ÷ (số thanh − 1)) nên cả chuỗi kết thúc trong 1200ms.
 */
export function revealStyle(value: number, max: number, index: number, count: number): CSSProperties {
  const ratio = max > 0 ? value / max : 0;
  const stagger = count > 1 ? Math.min(100, 300 / (count - 1)) : 0;
  return {
    "--reveal-duration": `${Math.round(200 + 700 * ratio)}ms`,
    "--reveal-delay": `${Math.round(index * stagger)}ms`,
  } as CSSProperties;
}
