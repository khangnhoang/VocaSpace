import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U3 CP3 (AC3) - hai thông báo lỗi của getLearningWorkspace (`QUERY_FAILED`, `INVALID_DATA`) đúng theo
//   ngôn ngữ của request; tiếng Việt đúng nguyên văn cũ; mã lỗi và hình dạng kết quả không đổi; lỗi chi tiết của Supabase/Zod không lộ.
// - Loại test: Server Action với next-intl thật (cấu hình request bản test chọn ngôn ngữ); Supabase bị mock.
// - Đối tượng: getLearningWorkspace. Action chỉ được trang server gọi (bọc `cache()`) nên không có wrapper `*Localized`.
// - Giới hạn: các nhánh còn lại (quyền truy cập, ghi danh, đồng bộ tiến độ, projection) do __tests__/actions/learning-workspace.test.ts giữ.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

const LOCALES: Locale[] = ["vi", "en"];
const TEXT = {
  query: {
    vi: "Không thể tải bài học lúc này. Vui lòng thử lại.",
    en: "Couldn't load the lesson right now. Please try again.",
  },
  invalid: {
    vi: "Dữ liệu bài học không hợp lệ.",
    en: "The lesson data is invalid.",
  },
} as const;

const ids = {
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  enrollment: "99999999-9999-4999-8999-999999999999",
};
const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

function singleQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

function rowsQuery(data: unknown[]) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) query[method] = vi.fn(() => query);
  query.then = (resolve: (value: { data: unknown[]; error: null }) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(resolve, reject);
  return query;
}

function mockSupabase(queries: Record<string, Record<string, unknown>>, authError: unknown = null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: authError ? null : user }, error: authError }) },
    from: vi.fn((table: string) => {
      const query = queries[table];
      if (!query) throw new Error(`Unexpected table query: ${table}`);
      return query;
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "skip sync" } }),
  } as never);
}

const topic = {
  id: ids.topic,
  slug: "bai-1",
  title: "Bài 1",
  status: "published",
  order_index: 1,
  chapter_id: ids.chapter,
  course_id: ids.course,
  removed_at: null,
};
const chapter = { id: ids.chapter, title: "Chương 1", order_index: 1, course_id: ids.course, removed_at: null, topics: [topic] };
const topicRow = {
  ...topic,
  chapter: { id: ids.chapter, course_id: ids.course, removed_at: null },
  cards: [],
  exercises: [],
  memory_checks: [],
  progress: [],
};
const enrolledCourse = (title: string) => ({
  id: ids.course,
  slug: "toeic-nen-tang",
  title,
  enrollments: [{ id: ids.enrollment, user_id: user.id }],
});

describe.each(LOCALES)("getLearningWorkspace messages in %s", (locale) => {
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
    mockSupabase({}, { message: "boom" });
    await expect(getLearningWorkspace("toeic-nen-tang", "bai-1")).resolves.toEqual({
      status: "error",
      errorCode: "QUERY_FAILED",
      error: TEXT.query[locale],
    });
  });

  it("reports a course query failure with the request language and no database detail", async () => {
    mockSupabase({ courses: singleQuery(null, { message: "sensitive sql" }) });
    const result = await getLearningWorkspace("toeic-nen-tang", "bai-1");
    expect(result).toEqual({ status: "error", errorCode: "QUERY_FAILED", error: TEXT.query[locale] });
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });

  it("reports malformed output with the request language and no validation detail", async () => {
    mockSupabase({
      courses: singleQuery(enrolledCourse("")),
      chapters: rowsQuery([chapter]),
      topics: singleQuery(topicRow),
    });
    await expect(getLearningWorkspace("toeic-nen-tang", "bai-1")).resolves.toEqual({
      status: "error",
      errorCode: "INVALID_DATA",
      error: TEXT.invalid[locale],
    });
  });

  it("returns a not-found result without a message for an invalid slug", async () => {
    await expect(getLearningWorkspace("BAD SLUG", "bai-1")).resolves.toEqual({ status: "not_found" });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
