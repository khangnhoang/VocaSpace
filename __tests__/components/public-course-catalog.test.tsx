import React, { useTransition } from "react";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicCourseCatalog } from "@/app/actions/public-course";
import PublicCourseHighlights, {
  PublicCourseHighlightsView,
} from "@/app/(client)/_components/PublicCourseHighlights";
import CoursesPage from "@/app/(client)/courses/page";
import CoursesLoading from "@/app/(client)/courses/loading";
import { PublicCourseCatalogView } from "@/app/(client)/courses/_components/PublicCourseCatalogView";
import { PublicCourseGrid } from "@/app/(client)/courses/_components/PublicCourseGrid";
import { PublicCourseRetryButton } from "@/app/(client)/courses/_components/PublicCourseRetryButton";
import { selectHighlightedCourses } from "@/lib/public-courses/highlighted-course-selector";
import type { PublicCourseCatalogItem } from "@/lib/schemas/public-course";

vi.mock("@/app/actions/public-course", () => ({
  getPublicCourseCatalog: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useTransition: vi.fn() };
});

// Test plan:
// - Mục tiêu: bảo vệ catalog public đầy đủ và homepage highlights dùng chung presentation nhưng khác allocation.
// - Loại test: component/route static render và source contract.
// - Đối tượng: PublicCourseHighlights, CoursesPage, PublicCourseGrid, CoursesLoading và cleanup read path cũ.
// - Case thành công: homepage tối đa bốn với card h3; catalog giữ đủ row/thứ tự với card h2; link/image accessible.
// - Case thất bại: homepage phân biệt empty/error; retry refresh route với pending/disabled; catalog loading không hiển thị error.
// - Bảo mật/phân quyền: UI chỉ nhận public DTO đã parse; test không mở rộng content access.
// - Ổn định/resilience: action error không bị đổi thành empty; retry chống click lặp; loading không flash error.
// - Invariant cần giữ: chỉ homepage dùng selector; production không còn PublicCourseList/getPublishedCourses.
// - Kết quả verify gần nhất: passed bằng focused B1.3/B1.2 Vitest command ngày 2026-07-11 (8 B1.3 tests).

const mockedGetPublicCourseCatalog = vi.mocked(getPublicCourseCatalog);
const mockedUseRouter = vi.mocked(useRouter);
const mockedUseTransition = vi.mocked(useTransition);
const refreshRoute = vi.fn();

function course(
  index: number,
  price: number,
  enrollmentCount: number,
  thumbnailUrl: string | null = `https://example.com/course-${index}.webp`,
): PublicCourseCatalogItem {
  return {
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    title: `Khóa học ${index}`,
    slug: `khoa-hoc-${index}`,
    thumbnail_url: thumbnailUrl,
    price,
    created_at: `2026-07-${(20 - index).toString().padStart(2, "0")}T10:00:00.000Z`,
    enrollment_count: enrollmentCount,
  };
}

const catalogCourses = [
  course(1, 200000, 100),
  course(2, 150000, 90),
  course(3, 100000, 80),
  course(4, 0, 20),
  course(5, 0, 10),
  course(6, 0, 5, null),
];

function countOccurrences(source: string, value: string) {
  return source.split(value).length - 1;
}

function collectProductionSource(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return collectProductionSource(path);
    return /\.(ts|tsx)$/.test(entry) ? [readFileSync(path, "utf8")] : [];
  });
}

describe("public catalog and homepage course discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseRouter.mockReturnValue({
      back: vi.fn(),
      forward: vi.fn(),
      push: vi.fn(),
      replace: vi.fn(),
      refresh: refreshRoute,
      prefetch: vi.fn(),
    });
    mockedUseTransition.mockReturnValue([
      false,
      (callback) => {
        void callback();
      },
    ]);
  });

  it("renders no more than four homepage courses using the highlighted selector result", async () => {
    mockedGetPublicCourseCatalog.mockResolvedValue({
      status: "success",
      data: catalogCourses,
    });

    const html = renderToStaticMarkup(await PublicCourseHighlights());
    const highlighted = selectHighlightedCourses(catalogCourses);

    expect(mockedGetPublicCourseCatalog).toHaveBeenCalledOnce();
    expect(countOccurrences(html, 'aria-label="Xem chi tiết khóa học')).toBe(4);
    expect(countOccurrences(html, "<h3")).toBe(4);
    expect(html).not.toMatch(/<h2[^>]*>Khóa học \d<\/h2>/);
    highlighted.forEach((item) => expect(html).toContain(item.title));
    expect(html).not.toContain("Khóa học 3");
    expect(html).toContain('href="/courses"');
  });

  it("renders distinct homepage empty and recoverable error states", () => {
    const emptyHtml = renderToStaticMarkup(
      <PublicCourseHighlightsView result={{ status: "success", data: [] }} />,
    );
    const errorHtml = renderToStaticMarkup(
      <PublicCourseHighlightsView
        result={{ status: "error", error: "safe public error" }}
      />,
    );

    expect(emptyHtml).toContain("Khóa học mới đang được chuẩn bị");
    expect(emptyHtml).toContain('href="/courses"');
    expect(emptyHtml).not.toContain("Chưa thể tải khóa học nổi bật");
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain(">Thử lại</button>");
    expect(errorHtml).not.toContain('href="/"');
    expect(errorHtml).toContain("Chưa thể tải khóa học nổi bật");
    expect(errorHtml).not.toContain("safe public error");
  });

  it("renders every catalog course in action-provided order without homepage truncation", async () => {
    const actionOrder = [
      catalogCourses[5],
      catalogCourses[1],
      catalogCourses[4],
      catalogCourses[0],
      catalogCourses[3],
      catalogCourses[2],
    ];
    mockedGetPublicCourseCatalog.mockResolvedValue({
      status: "success",
      data: actionOrder,
    });

    const html = renderToStaticMarkup(await CoursesPage());

    expect(html).not.toContain("<main");
    expect(countOccurrences(html, 'aria-label="Xem chi tiết khóa học')).toBe(6);
    expect(countOccurrences(html, "<h2")).toBe(6);
    expect(html).not.toContain("<h3");
    actionOrder.forEach((item, index) => {
      const currentIndex = html.indexOf(item.title);
      expect(currentIndex).toBeGreaterThan(-1);
      if (index > 0) {
        expect(currentIndex).toBeGreaterThan(
          html.indexOf(actionOrder[index - 1].title),
        );
      }
    });
  });

  it("keeps catalog empty and recoverable error states distinct", () => {
    const emptyHtml = renderToStaticMarkup(
      <PublicCourseCatalogView result={{ status: "success", data: [] }} />,
    );
    const errorHtml = renderToStaticMarkup(
      <PublicCourseCatalogView
        result={{ status: "error", error: "safe public error" }}
      />,
    );

    expect(emptyHtml).toContain("Chưa có khóa học công khai");
    expect(emptyHtml).toContain('href="/"');
    expect(emptyHtml).not.toContain("Chưa thể tải danh sách khóa học");
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain(">Thử lại</button>");
    expect(errorHtml).not.toContain('href="/courses"');
    expect(errorHtml).toContain("Chưa thể tải danh sách khóa học");
    expect(errorHtml).not.toContain("safe public error");
  });

  it("refreshes Server Component data once and exposes the retry pending state", () => {
    const retryButton = PublicCourseRetryButton() as React.ReactElement<{
      onClick: () => void;
    }>;

    retryButton.props.onClick();

    expect(refreshRoute).toHaveBeenCalledOnce();

    mockedUseTransition.mockReturnValue([true, vi.fn()]);
    const pendingHtml = renderToStaticMarkup(<PublicCourseRetryButton />);

    expect(pendingHtml).toContain("disabled");
    expect(pendingHtml).toContain("Đang thử lại...");
    expect(pendingHtml).not.toContain(">Thử lại</button>");
  });

  it("uses canonical semantic course links with accessible images and no nested controls", () => {
    const html = renderToStaticMarkup(
      <PublicCourseGrid
        courses={[catalogCourses[0], catalogCourses[5]]}
        headingLevel="h2"
        prioritizeFirstImage
      />,
    );

    expect(html).toContain('href="/courses/khoa-hoc-1"');
    expect(html).toContain('href="/courses/khoa-hoc-6"');
    expect(html).toContain(
      'aria-label="Xem chi tiết khóa học Khóa học 1"',
    );
    expect(html).toContain('alt="Ảnh bìa khóa học Khóa học 1"');
    expect(html).toContain(
      'aria-label="Chưa có ảnh bìa cho khóa học Khóa học 6"',
    );
    expect(html).not.toContain("<button");
  });

  it("renders a catalog loading-facing state without an error panel", () => {
    const html = renderToStaticMarkup(<CoursesLoading />);

    expect(html).not.toContain("<main");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Đang tải danh sách khóa học");
    expect(html).not.toContain('role="alert"');
  });

  it("keeps the selector homepage-only and removes the obsolete public read path", () => {
    const highlightsSource = readFileSync(
      join(
        process.cwd(),
        "app/(client)/_components/PublicCourseHighlights.tsx",
      ),
      "utf8",
    );
    const catalogSource = [
      readFileSync(
        join(process.cwd(), "app/(client)/courses/page.tsx"),
        "utf8",
      ),
      readFileSync(
        join(
          process.cwd(),
          "app/(client)/courses/_components/PublicCourseCatalogView.tsx",
        ),
        "utf8",
      ),
    ].join("\n");
    const productionSource = [
      ...collectProductionSource(join(process.cwd(), "app")),
      ...collectProductionSource(join(process.cwd(), "lib")),
    ].join("\n");

    expect(highlightsSource).toContain(
      "selectHighlightedCourses(result.data)",
    );
    expect(catalogSource).not.toContain("selectHighlightedCourses");
    expect(productionSource).not.toContain("getPublishedCourses");
    expect(productionSource).not.toContain("PublicCourseList");
    expect(
      existsSync(
        join(
          process.cwd(),
          "app/(client)/_components/PublicCourseList.tsx",
        ),
      ),
    ).toBe(false);
  });
});
