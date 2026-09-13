import { describe, expect, it } from "vitest";
import { resolveLessonNeighbors } from "@/lib/learn-navigation";

const lessons = [
  { slug: "topic-one", chapterId: "chapter-one" },
  { slug: "topic-two", chapterId: "chapter-two" },
  { slug: "topic-three", chapterId: "chapter-two" },
];

describe("resolveLessonNeighbors", () => {
  it("returns the ordered previous and next topics around the route topic", () => {
    expect(resolveLessonNeighbors(lessons, "topic-two")).toEqual({
      previous: lessons[0],
      next: lessons[2],
    });
  });

  it("does not fall back when the route topic is unavailable", () => {
    expect(resolveLessonNeighbors(lessons, "missing-topic")).toEqual({
      previous: undefined,
      next: undefined,
    });
  });

  it("keeps the outer boundaries disabled", () => {
    expect(resolveLessonNeighbors(lessons, "topic-one")).toEqual({
      previous: undefined,
      next: lessons[1],
    });
    expect(resolveLessonNeighbors(lessons, "topic-three")).toEqual({
      previous: lessons[1],
      next: undefined,
    });
  });
});
