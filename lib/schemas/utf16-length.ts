import { z } from "zod";

// Giữ giới hạn theo String.length như trước khi Zod chuyển sang đếm điểm mã Unicode.
export function minUtf16Length(minimum: number, message?: string) {
  return z.superRefine<string>((value, ctx) => {
    if (value.length < minimum) {
      ctx.addIssue({ origin: "string", code: "too_small", minimum, inclusive: true, message });
    }
  });
}

export function maxUtf16Length(maximum: number, message?: string) {
  return z.superRefine<string>((value, ctx) => {
    if (value.length > maximum) {
      ctx.addIssue({ origin: "string", code: "too_big", maximum, inclusive: true, message });
    }
  });
}
