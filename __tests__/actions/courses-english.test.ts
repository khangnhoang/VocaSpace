import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { getFirstTopicSlugByCourseSlug } from "@/app/actions/course-navigation";
import { getPublicCourseCatalog, getPublicCourseCatalogListing, getPublicCourseDetail } from "@/app/actions/public-course";
import { answerPublicCoursePreviewQuestion, getPublicCoursePreview } from "@/app/actions/public-course-preview";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U2 CP3 — thông báo lỗi của Server Action công khai (catalog, chi tiết, xem thử, chủ đề đầu) được dịch
//   theo ngôn ngữ của request tại thời điểm trả về: tiếng Anh khi `en`, giữ nguyên câu tiếng Việt cũ khi `vi`.
// - Loại: unit Server Action với Supabase client mock; chỉ các đường lỗi có thông báo cho người dùng.
// - Giới hạn: không kiểm lại logic đọc dữ liệu (đã có public-course*.test.ts); `setServerTestLocale` thay cho request thật.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));

const SLUG = "toeic-foundations";

function failingRpc() {
  return { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) };
}

function noCourseClient() {
  const query = {
    select: () => query,
    eq: () => query,
    single: () => Promise.resolve({ data: null, error: { message: "none" } }),
  };
  return { from: () => query };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  setServerTestLocale("vi");
});

describe("public course action errors by locale", () => {
  it.each([
    ["en", "Couldn't load the course list right now. Please try again."],
    ["vi", "Không thể tải danh sách khóa học lúc này. Vui lòng thử lại."],
  ] as const)("returns the catalog error in %s", async (locale, expected) => {
    setServerTestLocale(locale);
    vi.mocked(createClient).mockResolvedValue(failingRpc() as never);

    await expect(getPublicCourseCatalog()).resolves.toEqual({ status: "error", error: expected });
    await expect(getPublicCourseCatalogListing()).resolves.toEqual({ status: "error", error: expected });
  });

  it.each([
    ["en", "Couldn't load the course right now. Please try again."],
    ["vi", "Không thể tải thông tin khóa học lúc này. Vui lòng thử lại."],
  ] as const)("returns the detail error in %s", async (locale, expected) => {
    setServerTestLocale(locale);
    vi.mocked(createClient).mockResolvedValue(failingRpc() as never);

    await expect(getPublicCourseDetail(SLUG)).resolves.toEqual({ status: "error", error: expected });
  });
});

describe("public course preview action errors by locale", () => {
  it.each([
    ["en", "Couldn't load the preview right now. Please try again.", "Couldn't check your answer right now. Please try again."],
    ["vi", "Không thể tải nội dung xem thử lúc này. Vui lòng thử lại.", "Không thể kiểm tra câu trả lời lúc này. Vui lòng thử lại."],
  ] as const)("returns the preview and answer errors in %s", async (locale, previewError, answerError) => {
    setServerTestLocale(locale);
    vi.mocked(createServiceRoleClient).mockReturnValue(failingRpc() as never);

    await expect(getPublicCoursePreview({ courseSlug: SLUG, topicSlug: "opening-topic" })).resolves.toEqual({
      status: "error",
      error: previewError,
    });
    await expect(
      answerPublicCoursePreviewQuestion({
        courseSlug: SLUG,
        topicSlug: "opening-topic",
        questionId: "55555555-5555-4555-8555-555555555555",
        selectedOptionId: "66666666-6666-4666-8666-666666666666",
      }),
    ).resolves.toEqual({ status: "error", error: answerError });
  });
});

describe("first topic lookup errors by locale", () => {
  it.each([
    ["en", "The course slug is missing.", "Course not found, or the course isn't published."],
    ["vi", "Thiếu course slug.", "Không tìm thấy khóa học hoặc khóa học chưa được xuất bản."],
  ] as const)("returns the lookup errors in %s", async (locale, missing, notFound) => {
    setServerTestLocale(locale);
    vi.mocked(createClient).mockResolvedValue(noCourseClient() as never);

    await expect(getFirstTopicSlugByCourseSlug("")).resolves.toEqual({ error: missing, topicSlug: null });
    await expect(getFirstTopicSlugByCourseSlug(SLUG)).resolves.toEqual({ error: notFound, topicSlug: null });
  });
});
