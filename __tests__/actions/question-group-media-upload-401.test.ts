import { afterEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { POST } from "@/app/api/question-group-media/upload/route";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

// Test plan:
// - Mục tiêu: U9 H6/AC4 - 401 của POST /api/question-group-media/upload đọc ngôn ngữ của request, giữ nguyên status và dạng JSON.
// - Loại test: Route Handler unit; Supabase auth được mock (không có phiên), cấu hình request bản test chọn ngôn ngữ.
// - Case: ngôn ngữ vi trả đúng nguyên văn tiếng Việt cũ; ngôn ngữ en trả bản tiếng Anh; cả hai là 401 với `{ error }`.
// - Ghi chú: các thông báo khác của route thuộc U4; việc request dưới khóa nhận ngôn ngữ vi được kiểm bằng script H7 trên build thật.

afterEach(() => {
  setServerTestLocale("vi");
  vi.clearAllMocks();
});

describe("POST /api/question-group-media/upload without a session", () => {
  it.each([
    ["vi", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."],
    ["en", "Your session has expired. Please sign in again."],
  ] as const)("returns the %s 401 message with the same status and shape", async (locale, message) => {
    setServerTestLocale(locale);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST(new Request("https://vocaspace.test/api/question-group-media/upload", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: message });
  });
});
