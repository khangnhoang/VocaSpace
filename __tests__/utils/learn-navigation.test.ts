import { describe, expect, it } from "vitest";
import { resolveInitialLesson } from "@/lib/learn-navigation";

const lessons = [
  { slug: "topic-one", chapterId: "chapter-one" },
  { slug: "topic-two", chapterId: "chapter-two" },
];

describe("resolveInitialLesson", () => {
  it("opens the available topic requested by the route", () => {
    expect(resolveInitialLesson(lessons, "topic-two")).toEqual(lessons[1]);
  });

  it("falls back to the first available topic for an invalid route slug", () => {
    expect(resolveInitialLesson(lessons, "missing-topic")).toEqual(lessons[0]);
  });

  it("remains safe when the course has no available topic", () => {
    expect(resolveInitialLesson([], "missing-topic")).toBeUndefined();
  });
});
