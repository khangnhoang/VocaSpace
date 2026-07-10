import { describe, expect, it } from "vitest";
import {
  getPublicCourseCatalogPath,
  getPublicCourseDetailPath,
  PUBLIC_COURSE_CATALOG_PATH,
} from "@/lib/public-courses/routes";

describe("public course route helpers", () => {
  it("returns canonical catalog and detail paths", () => {
    expect(PUBLIC_COURSE_CATALOG_PATH).toBe("/courses");
    expect(getPublicCourseCatalogPath()).toBe("/courses");
    expect(getPublicCourseDetailPath("toeic-800")).toBe("/courses/toeic-800");
  });

  it("normalizes surrounding whitespace before composing a detail path", () => {
    expect(getPublicCourseDetailPath("  toeic-800  ")).toBe(
      "/courses/toeic-800",
    );
  });

  it("rejects slugs outside the canonical encoded segment contract", () => {
    expect(() => getPublicCourseDetailPath("bad slug/segment")).toThrow();
    expect(() => getPublicCourseDetailPath("UPPERCASE")).toThrow();
  });
});
