import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnrolledCourseOverview } from "@/app/actions/enrolled-course-overview";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U3 AC3 (CP2) - hai thông báo lỗi của getEnrolledCourseOverview (`QUERY_FAILED`, `INVALID_DATA`)
//   đúng theo ngôn ngữ của request; tiếng Việt đúng nguyên văn cũ; mã lỗi và hình dạng kết quả không đổi.
// - Loại test: Server Action với next-intl thật (cấu hình request bản test chọn ngôn ngữ); Supabase bị mock.
// - Đối tượng: getEnrolledCourseOverview. Action chỉ được trang server gọi nên không có wrapper `*Localized`.
// - Giới hạn: các nhánh còn lại (quyền truy cập, phân trang, projection) do __tests__/actions/enrolled-course-overview.test.ts giữ.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

const LOCALES: Locale[] = ["vi", "en"];
const TEXT = {
  query: {
    vi: "Không thể tải tổng quan khóa học lúc này. Vui lòng thử lại.",
    en: "Couldn't load the course overview right now. Please try again.",
  },
  invalid: {
    vi: "Dữ liệu tổng quan khóa học không hợp lệ.",
    en: "The course overview data is invalid.",
  },
} as const;

function single(data: unknown) {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) q[method] = vi.fn(() => q);
  q.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  return q;
}

describe.each(LOCALES)("getEnrolledCourseOverview messages in %s", (locale) => {
  beforeEach(() => {
    vi.clearAllMocks();
    setServerTestLocale(locale);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setServerTestLocale("vi");
  });

  it("reports an auth-service failure with the request language and stops before any query", async () => {
    const from = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "boom" } }) },
      from,
    } as never);

    await expect(getEnrolledCourseOverview("toeic-nen-tang")).resolves.toEqual({
      status: "error",
      errorCode: "QUERY_FAILED",
      error: TEXT.query[locale],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("reports malformed output with the request language and no validation detail", async () => {
    const tables: Record<string, unknown> = {
      courses: single({ id: "course-one", slug: "toeic-nen-tang", title: "", thumbnail_url: null }),
      enrollments: single(null),
    };
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-one" } }, error: null }) },
      from: vi.fn((table: string) => tables[table]),
    } as never);

    await expect(getEnrolledCourseOverview("toeic-nen-tang")).resolves.toEqual({
      status: "error",
      errorCode: "INVALID_DATA",
      error: TEXT.invalid[locale],
    });
  });

  it("returns a not-found result without a message for an invalid slug", async () => {
    await expect(getEnrolledCourseOverview("bad slug")).resolves.toEqual({ status: "not_found" });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
