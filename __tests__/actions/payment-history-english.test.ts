import { afterEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { getPaymentHistory } from "@/app/actions/payment-history";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U5 CP1 AC3 - getPaymentHistory trả thông báo theo ngôn ngữ của request, giữ nguyên errorCode
//   và hình dạng kết quả; tiếng Việt đúng chuỗi trước U5.
// - Loại test: Server Action với Supabase boundary mock; ngôn ngữ server chọn bằng `setServerTestLocale`.
// - Case: INVALID_INPUT (không chạm DB), AUTH_REQUIRED (không có phiên), QUERY_FAILED (lỗi truy vấn), INVALID_DATA (dữ liệu sai
//   hợp đồng), mỗi case ở vi và en.
// - Khoảng trống đã biết: luồng thành công và RLS do payment-history.test.ts và integration feat6-payment-history giữ.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

function mockSession(user: unknown, result: { data?: unknown[] | null; error?: unknown } = {}) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "order", "range", "limit"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, count: result.data?.length ?? null, error: result.error ?? null }).then(
      resolve,
      reject,
    );
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: () => query,
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  } as never);
}

afterEach(() => {
  setServerTestLocale("vi");
  vi.mocked(createClient).mockReset();
});

describe.each([
  {
    locale: "vi" as const,
    invalidInput: "Bộ lọc hoặc số trang không hợp lệ.",
    authRequired: "Vui lòng đăng nhập để xem lịch sử thanh toán.",
    queryFailed: "Không thể tải lịch sử thanh toán lúc này.",
    invalidData: "Dữ liệu lịch sử thanh toán không hợp lệ.",
  },
  {
    locale: "en" as const,
    invalidInput: "The filter or page number is invalid.",
    authRequired: "Please sign in to view your payment history.",
    queryFailed: "Couldn't load your payment history right now.",
    invalidData: "The payment history data is invalid.",
  },
])("getPaymentHistory messages in $locale", ({ locale, invalidInput, authRequired, queryFailed, invalidData }) => {
  it("rejects invalid input before reading the session", async () => {
    setServerTestLocale(locale);
    await expect(getPaymentHistory({ filter: "all", page: 0 })).resolves.toEqual({
      success: false,
      errorCode: "INVALID_INPUT",
      error: invalidInput,
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("asks a signed-out learner to sign in", async () => {
    setServerTestLocale(locale);
    mockSession(null);
    await expect(getPaymentHistory({ filter: "all", page: 1 })).resolves.toEqual({
      success: false,
      errorCode: "AUTH_REQUIRED",
      error: authRequired,
    });
  });

  it("reports a failed query without the database text", async () => {
    setServerTestLocale(locale);
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockSession({ id: "user-one" }, { error: { code: "XX000", message: "db down" } });
    await expect(getPaymentHistory({ filter: "all", page: 1 })).resolves.toEqual({
      success: false,
      errorCode: "QUERY_FAILED",
      error: queryFailed,
    });
  });

  it("reports rows that break the output contract", async () => {
    setServerTestLocale(locale);
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockSession({ id: "user-one" }, { data: [{ id: "p1", status: "unknown-status", course_id: "c1", course: null }] });
    await expect(getPaymentHistory({ filter: "all", page: 1 })).resolves.toEqual({
      success: false,
      errorCode: "INVALID_DATA",
      error: invalidData,
    });
  });
});
