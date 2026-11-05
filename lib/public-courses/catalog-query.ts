import {
  PUBLIC_CATALOG_SEARCH_MAX_LENGTH,
  publicCourseCatalogQuerySchema,
  type PublicCatalogSort,
  type PublicCourseCatalogListingItem,
} from "@/lib/schemas/public-course";

export const CATALOG_PAGE_SIZE = 12;
export const CATALOG_NEW_COURSE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CatalogPriceGroup = "all" | "free" | "paid";

export type CatalogQuery = {
  q: string;
  price: CatalogPriceGroup;
  preview: boolean;
  sort: PublicCatalogSort;
  page: number;
};

export const DEFAULT_CATALOG_QUERY: CatalogQuery = {
  q: "",
  price: "all",
  preview: false,
  sort: "popular",
  page: 1,
};

/** Khóa học đã kèm các giá trị phụ thuộc thời gian/locale được tính một lần trên server. */
export type CatalogCourse = PublicCourseCatalogListingItem & {
  isNew: boolean;
  titleRank: number;
};

type SearchParamsLike =
  | URLSearchParams
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function readParam(params: SearchParamsLike, name: string) {
  if (typeof (params as URLSearchParams).get === "function") {
    return (params as URLSearchParams).get(name) ?? undefined;
  }
  return (params as Record<string, string | string[] | undefined>)[name];
}

export function parseCatalogQuery(params: SearchParamsLike): CatalogQuery {
  const parsed = publicCourseCatalogQuerySchema.parse({
    q: readParam(params, "q"),
    gia: readParam(params, "gia"),
    "hoc-thu": readParam(params, "hoc-thu"),
    "sap-xep": readParam(params, "sap-xep"),
    trang: readParam(params, "trang"),
  });
  return {
    q: parsed.q,
    price: parsed.gia ?? "all",
    preview: parsed["hoc-thu"] === "1",
    sort: parsed["sap-xep"] ?? "popular",
    page: parsed.trang ?? 1,
  };
}

/** Chuỗi query chuẩn (bỏ giá trị mặc định), không gồm dấu "?". */
export function serializeCatalogQuery(query: CatalogQuery) {
  const params = new URLSearchParams();
  const q = query.q.trim().slice(0, PUBLIC_CATALOG_SEARCH_MAX_LENGTH);
  if (q) params.set("q", q);
  if (query.price !== "all") params.set("gia", query.price);
  if (query.preview) params.set("hoc-thu", "1");
  if (query.sort !== "popular") params.set("sap-xep", query.sort);
  if (query.page > 1) params.set("trang", String(query.page));
  return params.toString();
}

/** Bỏ dấu tiếng Việt và chữ hoa để "tu vung" khớp "Từ vựng"; mỗi ký tự gốc giữ đúng một ký tự sau chuẩn hóa. */
export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Vị trí đoạn khớp trong tiêu đề gốc. Chuẩn hóa tiêu đề theo từng ký tự (NFC) để chỉ số luôn trỏ đúng vào chuỗi gốc,
 * kể cả khi dữ liệu lưu ở dạng NFD.
 */
export function findTitleMatch(title: string, query: string): [number, number] | null {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return null;
  const chars = Array.from(title.normalize("NFC"));
  const normalizedChars = chars.map((char) => normalizeSearchText(char));
  const haystack = normalizedChars.join("");
  const index = haystack.indexOf(needle);
  if (index < 0) return null;

  let offset = 0;
  let start = -1;
  let end = chars.length;
  for (let i = 0; i < chars.length; i++) {
    if (start < 0 && offset >= index) start = i;
    offset += normalizedChars[i].length;
    if (start >= 0 && offset >= index + needle.length) {
      end = i + 1;
      break;
    }
  }
  const startCode = chars.slice(0, start).join("").length;
  const endCode = chars.slice(0, end).join("").length;
  return [startCode, endCode];
}

export function toCatalogCourses(
  courses: readonly PublicCourseCatalogListingItem[],
  now: Date,
): CatalogCourse[] {
  const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });
  const ranked = [...courses].sort(
    (left, right) => collator.compare(left.title, right.title) || left.id.localeCompare(right.id),
  );
  const rankById = new Map(ranked.map((course, index) => [course.id, index]));
  const newSince = now.getTime() - CATALOG_NEW_COURSE_DAYS * DAY_MS;
  return courses.map((course) => ({
    ...course,
    isNew: new Date(course.created_at).getTime() >= newSince,
    titleRank: rankById.get(course.id) ?? 0,
  }));
}

function matchesSearchAndPreview(course: CatalogCourse, query: CatalogQuery, needle: string) {
  if (query.preview && !course.preview_topic_slug) return false;
  return !needle || normalizeSearchText(course.title).includes(needle);
}

function matchesPrice(course: CatalogCourse, price: CatalogPriceGroup) {
  if (price === "free") return course.price === 0;
  if (price === "paid") return course.price > 0;
  return true;
}

/** Số khóa của từng nhóm giá theo từ khóa và bộ lọc học thử hiện tại (U2 AC3). */
export function countPriceGroups(courses: readonly CatalogCourse[], query: CatalogQuery) {
  const needle = normalizeSearchText(query.q.trim());
  const base = courses.filter((course) => matchesSearchAndPreview(course, query, needle));
  return {
    all: base.length,
    free: base.filter((course) => matchesPrice(course, "free")).length,
    paid: base.filter((course) => matchesPrice(course, "paid")).length,
  };
}

const byId = (left: CatalogCourse, right: CatalogCourse) => left.id.localeCompare(right.id);
const byPopularity = (left: CatalogCourse, right: CatalogCourse) =>
  right.enrollment_count - left.enrollment_count ||
  right.created_at.localeCompare(left.created_at) ||
  byId(left, right);

// Mọi cách sắp xếp kết thúc bằng id để server và trình duyệt cho cùng thứ tự khi hydrate.
const SORTS: Record<PublicCatalogSort, (left: CatalogCourse, right: CatalogCourse) => number> = {
  popular: byPopularity,
  trending: (left, right) =>
    right.recent_enrollment_count - left.recent_enrollment_count ||
    right.enrollment_count - left.enrollment_count ||
    byId(left, right),
  newest: (left, right) => right.created_at.localeCompare(left.created_at) || byId(left, right),
  az: (left, right) => left.titleRank - right.titleRank || byId(left, right),
  "price-asc": (left, right) => left.price - right.price || byPopularity(left, right),
  "price-desc": (left, right) => right.price - left.price || byPopularity(left, right),
};

export function filterAndSortCatalog(courses: readonly CatalogCourse[], query: CatalogQuery) {
  const needle = normalizeSearchText(query.q.trim());
  return courses
    .filter((course) => matchesSearchAndPreview(course, query, needle) && matchesPrice(course, query.price))
    .sort(SORTS[query.sort]);
}

export function mostEnrolledCourses(courses: readonly CatalogCourse[], limit: number) {
  return [...courses].sort(byPopularity).slice(0, limit);
}

export function paginateCatalog<T>(items: readonly T[], requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / CATALOG_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * CATALOG_PAGE_SIZE;
  return {
    page,
    totalPages,
    items: items.slice(start, start + CATALOG_PAGE_SIZE),
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + CATALOG_PAGE_SIZE, items.length),
  };
}

/** Các số trang hiển thị, với "gap" ở chỗ bị lược bớt: 1 … 4 5 6 … 10. */
export function catalogPageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  return sorted.flatMap((page, index) =>
    index > 0 && page - sorted[index - 1] > 1 ? (["gap", page] as const) : [page],
  );
}
