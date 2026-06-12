import { describe, expect, it } from "vitest";
import {
  exerciseSchema,
  getToeicVisibleGroupContextFields,
} from "@/lib/schemas/exercise";

const question = {
  content: "What is correct?",
  options: [
    { content: "Correct", is_correct: true },
    { content: "Wrong", is_correct: false },
  ],
};

function groupedPayload(part_type: string, group = {}) {
  return {
    title: "Valid TOEIC Exercise",
    part_type,
    groups: [{ ...group, questions: [question] }],
  };
}

describe("TOEIC part context validation", () => {
  it("centralizes visible media/context fields by TOEIC part", () => {
    expect(getToeicVisibleGroupContextFields("part1")).toEqual([
      "image_url",
      "audio_url",
    ]);
    expect(getToeicVisibleGroupContextFields("part2")).toEqual(["audio_url"]);
    expect(getToeicVisibleGroupContextFields("part3")).toEqual([
      "audio_url",
      "image_url",
    ]);
    expect(getToeicVisibleGroupContextFields("part4")).toEqual([
      "audio_url",
      "image_url",
    ]);
    expect(getToeicVisibleGroupContextFields("part5")).toEqual([]);
    expect(getToeicVisibleGroupContextFields("part6")).toEqual(["passage_text"]);
    expect(getToeicVisibleGroupContextFields("part7")).toEqual([
      "passage_text",
      "image_url",
    ]);
  });

  it("requires image and audio for Part 1 groups", () => {
    const result = exerciseSchema.safeParse(groupedPayload("part1"));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["groups.0.image_url", "groups.0.audio_url"]),
      );
    }
  });

  it.each(["part2", "part3", "part4"])(
    "requires audio for %s groups",
    (part_type) => {
      const result = exerciseSchema.safeParse(groupedPayload(part_type));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path.join(".")).toBe("groups.0.audio_url");
      }
    },
  );

  it("allows optional passage and image for Parts 2/3/4 when audio exists", () => {
    for (const part_type of ["part2", "part3", "part4"]) {
      expect(
        exerciseSchema.safeParse(
          groupedPayload(part_type, {
            audio_url: "https://example.com/listening.mp3",
            passage_text: "",
            image_url: "",
          }),
        ).success,
      ).toBe(true);
    }
  });

  it.each(["part6", "part7"])("requires passage for %s groups", (part_type) => {
    const result = exerciseSchema.safeParse(groupedPayload(part_type));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path.join(".")).toBe("groups.0.passage_text");
    }
  });

  it("allows optional image and audio for Parts 6/7 when passage exists", () => {
    for (const part_type of ["part6", "part7"]) {
      expect(
        exerciseSchema.safeParse(
          groupedPayload(part_type, {
            passage_text: "A reading passage.",
            audio_url: "",
            image_url: "",
          }),
        ).success,
      ).toBe(true);
    }
  });

  it("allows Part 5 standalone questions without group context", () => {
    expect(
      exerciseSchema.safeParse({
        title: "Part 5 Exercise",
        part_type: "part5",
        questions: [question],
      }).success,
    ).toBe(true);
  });

  it("rejects invalid non-empty media URLs while empty optional URLs pass", () => {
    expect(
      exerciseSchema.safeParse(
        groupedPayload("part7", {
          passage_text: "A reading passage.",
          audio_url: "asdasd",
          image_url: "",
        }),
      ).success,
    ).toBe(false);

    expect(
      exerciseSchema.safeParse(
        groupedPayload("part7", {
          passage_text: "A reading passage.",
          audio_url: "",
          image_url: "",
        }),
      ).success,
    ).toBe(true);
  });
});
