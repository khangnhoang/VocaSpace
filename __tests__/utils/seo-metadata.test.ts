import { beforeEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { getPublicCourseCatalog } from "@/app/actions/public-course";
import { config } from "@/proxy";

// Test plan:
// - Mục tiêu: sitemap dùng URL canonical công khai; robots cho phép crawl trang công khai.
// - Loại test: unit metadata route và matcher Next.js.
// - Đối tượng: sitemap, robots và proxy.config.
// - Thành công: khóa học từ catalog thành URL tuyệt đối; catalog rỗng giữ trang tĩnh.
// - Thất bại: lỗi catalog không được biến thành sitemap thiếu khóa học.
// - Phân quyền: không liệt kê trang nội bộ; matcher vẫn giữ guard của /teacher, /profile.
// - Resilience: sitemap/robots không đi qua refresh phiên; không giả ngày cập nhật.
// - Verify: passed bằng `npx vitest run __tests__/utils/seo-metadata.test.ts`.
// - Giới hạn: mock kết quả catalog để kiểm tra metadata; không chứng minh bộ lọc DB/RLS.

vi.mock("@/app/actions/public-course", () => ({
  getPublicCourseCatalog: vi.fn(),
}));

const mockedCatalog = vi.mocked(getPublicCourseCatalog);
const staticUrls = [
  "https://vocaspace.com/",
  "https://vocaspace.com/courses",
  "https://vocaspace.com/privacy",
  "https://vocaspace.com/terms",
];

beforeEach(() => vi.resetAllMocks());

describe("public search metadata", () => {
  it("lists canonical public pages and catalog courses without inventing modification dates", async () => {
    mockedCatalog.mockResolvedValue({
      status: "success",
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "IELTS Vocabulary",
          slug: "ielts-vocabulary",
          thumbnail_url: null,
          price: 0,
          created_at: "2026-07-10T10:00:00.000Z",
          enrollment_count: 0,
        },
      ],
    });
    const result = await sitemap();
    expect(result).toEqual([
      ...staticUrls.map((url) => ({ url })),
      { url: "https://vocaspace.com/courses/ielts-vocabulary" },
    ]);
  });

  it("keeps public static pages when there are no published courses", async () => {
    mockedCatalog.mockResolvedValue({ status: "success", data: [] });
    expect((await sitemap()).map((entry) => entry.url)).toEqual(staticUrls);
  });

  it("fails for retry when the public catalog cannot be loaded", async () => {
    mockedCatalog.mockResolvedValue({
      status: "error",
      error: "Catalog unavailable",
    });
    await expect(sitemap()).rejects.toThrow(
      "Unable to generate the public course sitemap",
    );
  });

  it("allows public crawling and advertises the canonical sitemap while excluding internal flows", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://vocaspace.com/sitemap.xml");
    expect(result.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(result.rules).toHaveProperty(
      "disallow",
      expect.arrayContaining([
        "/teacher", "/admin", "/learn", "/profile", "/api/", "/auth/", "/payment/",
      ]),
    );
    expect(result.rules).not.toHaveProperty(
      "disallow",
      expect.arrayContaining(["/"]),
    );
    expect(result.rules).not.toHaveProperty(
      "disallow",
      expect.arrayContaining(["/courses"]),
    );
  });

  it.each(["/sitemap.xml", "/robots.txt", "/sitemap.xml?check=1"])(
    "serves %s without running the session proxy",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );

  it.each([
    "/teacher", "/teacher/courses", "/profile", "/courses/ielts-vocabulary", "/sitemap.xml/extra",
  ])(
    "keeps the existing session proxy on %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );
});
