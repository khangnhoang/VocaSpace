import { describe, expect, it } from "vitest";
import { selectHighlightedCourses } from "@/lib/public-courses/highlighted-course-selector";
import type { PublicCourseCatalogItem } from "@/lib/schemas/public-course";

const baseDate = "2026-07-10T10:00:00.000Z";

function course(
  idSuffix: number,
  price: number,
  enrollmentCount: number,
  createdAt = baseDate,
): PublicCourseCatalogItem {
  return {
    id: `00000000-0000-4000-8000-${idSuffix.toString().padStart(12, "0")}`,
    title: `Course ${idSuffix}`,
    slug: `course-${idSuffix}`,
    thumbnail_url: null,
    price,
    created_at: createdAt,
    enrollment_count: enrollmentCount,
  };
}

function ids(courses: PublicCourseCatalogItem[]) {
  return courses.map((item) => item.id);
}

describe("homepage highlighted course selector", () => {
  it("selects two paid and two free courses", () => {
    const input = [course(1, 100, 10), course(2, 100, 9), course(3, 0, 8), course(4, 0, 7)];
    expect(selectHighlightedCourses(input)).toEqual(input);
  });

  it("fills missing paid slots from remaining free courses", () => {
    const input = [course(1, 100, 10), course(2, 0, 9), course(3, 0, 8), course(4, 0, 7)];
    expect(ids(selectHighlightedCourses(input))).toEqual(ids(input));
  });

  it("fills missing free slots from remaining paid courses", () => {
    const input = [course(1, 100, 10), course(2, 100, 9), course(3, 100, 8), course(4, 0, 7)];
    expect(ids(selectHighlightedCourses(input))).toEqual(
      ids([input[0], input[1], input[3], input[2]]),
    );
  });

  it("supports a catalog containing only one price group", () => {
    const input = [course(1, 0, 4), course(2, 0, 3), course(3, 0, 2), course(4, 0, 1), course(5, 0, 0)];
    expect(ids(selectHighlightedCourses(input))).toEqual(ids(input.slice(0, 4)));
  });

  it("returns every course when fewer than four exist", () => {
    const input = [course(1, 100, 3), course(2, 0, 2), course(3, 0, 1)];
    expect(selectHighlightedCourses(input)).toHaveLength(3);
    expect(new Set(ids(selectHighlightedCourses(input)))).toEqual(new Set(ids(input)));
  });

  it("breaks enrollment-count ties by newest timestamp", () => {
    const older = course(1, 100, 10, "2026-07-09T10:00:00.000Z");
    const newer = course(2, 100, 10, "2026-07-11T10:00:00.000Z");
    expect(ids(selectHighlightedCourses([older, newer]))).toEqual(ids([newer, older]));
  });

  it("breaks timestamp ties by ascending ID", () => {
    const higherId = course(2, 100, 10);
    const lowerId = course(1, 100, 10);
    expect(ids(selectHighlightedCourses([higherId, lowerId]))).toEqual(ids([lowerId, higherId]));
  });

  it("prioritizes enrollment count before timestamp", () => {
    const popularOlder = course(1, 100, 11, "2026-07-09T10:00:00.000Z");
    const newer = course(2, 100, 10, "2026-07-11T10:00:00.000Z");
    expect(ids(selectHighlightedCourses([newer, popularOlder]))).toEqual(ids([popularOlder, newer]));
  });

  it("does not mutate the input array", () => {
    const input = [course(2, 100, 1), course(1, 100, 2), course(4, 0, 3), course(3, 0, 4)];
    const before = [...input];
    selectHighlightedCourses(input);
    expect(input).toEqual(before);
  });
});
