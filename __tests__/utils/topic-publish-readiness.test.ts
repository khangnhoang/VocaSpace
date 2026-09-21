import { describe, expect, it } from "vitest";
import { deriveTopicPublishReadiness } from "@/lib/course-readiness";

// Test plan:
// - Mục tiêu: bảo vệ predicate readiness tối thiểu cho request review của topic.
// - Loại test: unit/pure derivation.
// - Case: 0/0, card-only, exercise-only bị chặn; cả hai loại active content thì đạt.
// - Invariant: chỉ row cùng topic và chưa soft-delete mới được tính.

const topicId = "11111111-1111-4111-8111-111111111111";

function card(removed_at: string | null = null) {
  return { topic_id: topicId, removed_at };
}

function exercise(removed_at: string | null = null) {
  return { topic_id: topicId, removed_at };
}

describe("topic publish readiness", () => {
  it.each([
    ["0 card + 0 exercise", [], [], false],
    ["1+ card + 0 exercise", [card()], [], false],
    ["0 card + 1+ exercise", [], [exercise()], false],
    ["1+ card + 1+ exercise", [card()], [exercise()], true],
  ])("derives %s correctly", (_label, cards, exercises, isReady) => {
    const result = deriveTopicPublishReadiness(topicId, cards, exercises);

    expect(result.isReady).toBe(isReady);
    expect(result.activeFlashcardCount).toBe(cards.length);
    expect(result.activeExerciseCount).toBe(exercises.length);
  });

  it("does not count soft-deleted or unrelated content", () => {
    const result = deriveTopicPublishReadiness(
      topicId,
      [card(new Date().toISOString()), card(), { topic_id: "other", removed_at: null }],
      [exercise(new Date().toISOString()), exercise(), { topic_id: "other", removed_at: null }],
    );

    expect(result).toMatchObject({
      activeFlashcardCount: 1,
      activeExerciseCount: 1,
      isReady: true,
    });
  });
});
