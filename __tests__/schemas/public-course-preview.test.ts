import { describe, expect, it } from "vitest";
import {
  publicCoursePreviewAnswerInputSchema,
  publicCoursePreviewRpcSchema,
} from "@/lib/schemas/public-course-preview";

const ids = {
  topic: "11111111-1111-4111-8111-111111111111",
  card: "22222222-2222-4222-8222-222222222222",
  exercise: "33333333-3333-4333-8333-333333333333",
  group: "44444444-4444-4444-8444-444444444444",
  question: "55555555-5555-4555-8555-555555555555",
  option: "66666666-6666-4666-8666-666666666666",
};

function validPreview() {
  return {
    course: { slug: "public-course", title: "Public Course" },
    topic: {
      id: ids.topic,
      slug: "public-topic",
      title: "Public Topic",
      description: null,
    },
    flashcards: [
      {
        id: ids.card,
        front_content: { word: "word", pos: null, phonetic: null },
        back_content: { translation: "meaning" },
        audio_url: null,
        image_url: null,
        order_index: 0,
      },
    ],
    exercises: [
      {
        id: ids.exercise,
        title: "Practice",
        part_type: "part5",
        order_index: 0,
        questions: [
          {
            id: ids.question,
            content: "Question?",
            order_index: 0,
            options: [
              { id: ids.option, content: "Option", label: "A", order_index: 0 },
            ],
          },
        ],
        groups: [
          {
            id: ids.group,
            passage_text: null,
            audio_url: null,
            image_url: null,
            order_index: 0,
            questions: [],
          },
        ],
      },
    ],
  };
}

describe("public course Preview schemas", () => {
  it("accepts the ordered public learning payload without answer keys or learner state", () => {
    const parsed = publicCoursePreviewRpcSchema.parse(validPreview());
    expect(parsed.topic.slug).toBe("public-topic");
    expect(parsed.exercises[0].questions[0].options[0].content).toBe("Option");
  });

  it("rejects answer correctness and explanations in the initial payload", () => {
    const payload = validPreview();
    payload.exercises[0].questions[0].options[0] = {
      ...payload.exercises[0].questions[0].options[0],
      is_correct: true,
    } as never;
    payload.exercises[0].questions[0] = {
      ...payload.exercises[0].questions[0],
      explanation: "secret before answer",
    } as never;

    expect(() => publicCoursePreviewRpcSchema.parse(payload)).toThrow();
  });

  it("rejects extra learning-state or caller privilege fields", () => {
    expect(() =>
      publicCoursePreviewRpcSchema.parse({
        ...validPreview(),
        progress: { isTopicCompleted: true },
      }),
    ).toThrow();
    expect(() =>
      publicCoursePreviewAnswerInputSchema.parse({
        courseSlug: "public-course",
        topicSlug: "public-topic",
        questionId: ids.question,
        selectedOptionId: ids.option,
        mode: "preview",
      }),
    ).toThrow();
  });
});
