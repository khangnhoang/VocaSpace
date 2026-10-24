import { describe, expect, it } from "vitest";
import { formatInsightMonthLong, formatInsightMonthShort, toWholePercentages } from "@/lib/course-authoring/insights";

describe("course insight formatting", () => {
  it("labels database months without shifting time zones", () => {
    expect(formatInsightMonthShort("2026-01")).toBe("Th1");
    expect(formatInsightMonthLong("2026-12")).toBe("Tháng 12/2026");
  });

  it.each([
    [{ not_started: 10, in_progress: 10, completed: 4 }, { not_started: 42, in_progress: 42, completed: 16 }],
    [{ not_started: 1, in_progress: 1, completed: 1 }, { not_started: 34, in_progress: 33, completed: 33 }],
    [{ not_started: 0, in_progress: 0, completed: 7 }, { not_started: 0, in_progress: 0, completed: 100 }],
  ])("rounds %o so the three shares sum to 100", (progress, expected) => {
    const result = toWholePercentages(progress);
    expect(result).toEqual(expected);
    expect(result.not_started + result.in_progress + result.completed).toBe(100);
  });

  it("returns zero shares when nobody is enrolled", () => {
    expect(toWholePercentages({ not_started: 0, in_progress: 0, completed: 0 })).toEqual({ not_started: 0, in_progress: 0, completed: 0 });
  });
});
