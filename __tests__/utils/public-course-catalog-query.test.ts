import { describe, expect, it } from "vitest";
import {
  catalogPageWindow,
  countPriceGroups,
  DEFAULT_CATALOG_QUERY,
  filterAndSortCatalog,
  findTitleMatch,
  mostEnrolledCourses,
  paginateCatalog,
  parseCatalogQuery,
  serializeCatalogQuery,
  toCatalogCourses,
  type CatalogQuery,
} from "@/lib/public-courses/catalog-query";
import type { PublicCourseCatalogListingItem } from "@/lib/schemas/public-course";

// Test plan:
// - Mục tiêu: bảo vệ logic thuần của catalog /courses (U2 AC2–AC6): URL, tìm không dấu, lọc, đếm, sắp xếp, phân trang.
// - Loại test: unit thuần, không render.
// - Case thành công: query hợp lệ đi qua parse/serialize; tìm "tu vung" khớp "Từ vựng"; mỗi cách sắp xếp và tie-break id.
// - Case thất bại/biên: tham số sai/lặp/quá dài quay về mặc định; trang vượt quá bị kẹp; danh sách rỗng; chuỗi NFD.
// - Invariant cần giữ: số đếm nhóm giá theo từ khóa + học thử; mọi sắp xếp xác định (không phụ thuộc thứ tự đầu vào).

const NOW = new Date("2026-11-05T12:00:00.000Z");

function item(index: number, overrides: Partial<PublicCourseCatalogListingItem> = {}): PublicCourseCatalogListingItem {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `Khóa ${index}`,
    slug: `khoa-${index}`,
    thumbnail_url: null,
    price: 0,
    created_at: "2026-06-01T00:00:00.000Z",
    enrollment_count: 0,
    recent_enrollment_count: 0,
    topic_count: 1,
    card_count: 10,
    preview_topic_slug: null,
    instructor_name: null,
    description_excerpt: null,
    ...overrides,
  };
}

const query = (overrides: Partial<CatalogQuery> = {}): CatalogQuery => ({ ...DEFAULT_CATALOG_QUERY, ...overrides });

describe("catalog URL query", () => {
  it("parses valid parameters and serializes back without defaults", () => {
    const parsed = parseCatalogQuery(new URLSearchParams("q=tu+vung&gia=paid&hoc-thu=1&sap-xep=az&trang=3"));
    expect(parsed).toEqual({ q: "tu vung", price: "paid", preview: true, sort: "az", page: 3 });
    expect(serializeCatalogQuery(parsed)).toBe("q=tu+vung&gia=paid&hoc-thu=1&sap-xep=az&trang=3");
    expect(serializeCatalogQuery(DEFAULT_CATALOG_QUERY)).toBe("");
    expect(serializeCatalogQuery({ ...DEFAULT_CATALOG_QUERY, q: "  tieng  " })).toBe("q=tieng");
  });

  it("falls back to defaults for unknown, invalid, repeated or oversized values", () => {
    expect(
      parseCatalogQuery({ gia: "cheap", "hoc-thu": "yes", "sap-xep": "bogus", trang: "-2", q: "  " }),
    ).toEqual(DEFAULT_CATALOG_QUERY);
    expect(parseCatalogQuery({ trang: "abc" }).page).toBe(1);
    expect(parseCatalogQuery({ q: ["first", "second"], gia: ["free", "paid"] })).toMatchObject({ q: "first", price: "free" });
    expect(parseCatalogQuery({ q: "x".repeat(150) }).q).toHaveLength(100);
  });
});

describe("catalog search", () => {
  it("matches titles ignoring case and Vietnamese diacritics, including đ", () => {
    const courses = toCatalogCourses(
      [item(1, { title: "Từ vựng IELTS" }), item(2, { title: "Đàm phán" }), item(3, { title: "Ngữ pháp" })],
      NOW,
    );
    expect(filterAndSortCatalog(courses, query({ q: "tu VUNG" })).map((course) => course.title)).toEqual(["Từ vựng IELTS"]);
    expect(filterAndSortCatalog(courses, query({ q: "dam" })).map((course) => course.title)).toEqual(["Đàm phán"]);
  });

  it("returns the matched range in the original title, also for NFD-stored text", () => {
    expect(findTitleMatch("3000 từ vựng tiếng Anh", "tieng anh")).toEqual([13, 22]);
    const nfd = "Tiếng Anh".normalize("NFD");
    const [start, end] = findTitleMatch(nfd, "anh")!;
    expect(nfd.normalize("NFC").slice(start, end)).toBe("Anh");
    expect(findTitleMatch("Ngữ pháp", "toeic")).toBeNull();
    expect(findTitleMatch("Ngữ pháp", "   ")).toBeNull();
  });
});

describe("catalog filters and counts", () => {
  const courses = toCatalogCourses(
    [
      item(1, { title: "Anh free preview", price: 0, preview_topic_slug: "t-1" }),
      item(2, { title: "Anh paid", price: 100000 }),
      item(3, { title: "Anh paid preview", price: 200000, preview_topic_slug: "t-3" }),
      item(4, { title: "Nhật free", price: 0 }),
    ],
    NOW,
  );

  it("counts price groups for the current search and preview filters, not the price filter", () => {
    expect(countPriceGroups(courses, query())).toEqual({ all: 4, free: 2, paid: 2 });
    expect(countPriceGroups(courses, query({ q: "anh", price: "free" }))).toEqual({ all: 3, free: 1, paid: 2 });
    expect(countPriceGroups(courses, query({ preview: true }))).toEqual({ all: 2, free: 1, paid: 1 });
  });

  it("combines search, price and preview filters", () => {
    expect(filterAndSortCatalog(courses, query({ q: "anh", price: "paid", preview: true })).map((c) => c.title)).toEqual([
      "Anh paid preview",
    ]);
    expect(filterAndSortCatalog(courses, query({ price: "free" })).map((c) => c.title).sort()).toEqual([
      "Anh free preview",
      "Nhật free",
    ]);
  });
});

describe("catalog sorting", () => {
  const listing = [
    item(1, { title: "Bảng chữ cái", enrollment_count: 10, recent_enrollment_count: 1, price: 300, created_at: "2026-10-01T00:00:00.000Z" }),
    item(2, { title: "anh văn", enrollment_count: 30, recent_enrollment_count: 1, price: 100, created_at: "2026-09-01T00:00:00.000Z" }),
    item(3, { title: "Ăn uống", enrollment_count: 30, recent_enrollment_count: 9, price: 100, created_at: "2026-11-01T00:00:00.000Z" }),
    item(4, { title: "Đọc hiểu", enrollment_count: 5, recent_enrollment_count: 9, price: 0, created_at: "2026-10-20T00:00:00.000Z" }),
  ];
  const courses = toCatalogCourses(listing, NOW);
  const order = (sort: CatalogQuery["sort"], input = courses) => filterAndSortCatalog(input, query({ sort })).map((c) => c.id.slice(-1));

  it("orders each sort with its documented tie-breaks", () => {
    expect(order("popular")).toEqual(["3", "2", "1", "4"]);
    expect(order("trending")).toEqual(["3", "4", "2", "1"]);
    expect(order("newest")).toEqual(["3", "4", "1", "2"]);
    expect(order("az")).toEqual(["2", "3", "1", "4"]);
    expect(order("price-asc")).toEqual(["4", "3", "2", "1"]);
    expect(order("price-desc")).toEqual(["1", "3", "2", "4"]);
  });

  it("is independent of the input order", () => {
    const reversed = [...courses].reverse();
    (["popular", "trending", "newest", "az", "price-asc", "price-desc"] as const).forEach((sort) => {
      expect(order(sort, reversed)).toEqual(order(sort));
    });
  });

  it("marks courses created within 30 days as new and picks the most enrolled for suggestions", () => {
    expect(courses.filter((course) => course.isNew).map((course) => course.id.slice(-1))).toEqual(["3", "4"]);
    expect(mostEnrolledCourses(courses, 2).map((course) => course.id.slice(-1))).toEqual(["3", "2"]);
  });
});

describe("catalog pagination", () => {
  const items = Array.from({ length: 40 }, (_, index) => index + 1);

  it("splits 12 per page and clamps out-of-range pages", () => {
    expect(paginateCatalog(items, 1)).toMatchObject({ page: 1, totalPages: 4, from: 1, to: 12 });
    expect(paginateCatalog(items, 4)).toMatchObject({ page: 4, from: 37, to: 40, items: [37, 38, 39, 40] });
    expect(paginateCatalog(items, 99).page).toBe(4);
    expect(paginateCatalog([], 3)).toMatchObject({ page: 1, totalPages: 1, from: 0, to: 0, items: [] });
  });

  it("shows a compact page window with gaps", () => {
    expect(catalogPageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(catalogPageWindow(1, 10)).toEqual([1, 2, 3, 4, "gap", 10]);
    expect(catalogPageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(catalogPageWindow(10, 10)).toEqual([1, "gap", 7, 8, 9, 10]);
  });
});
