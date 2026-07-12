import { describe, expect, it } from "vitest";
import {
  publicCourseCatalogRpcSchema,
  publicCourseDetailRpcSchema,
} from "@/lib/schemas/public-course";

const courseId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const chapterId = "33333333-3333-4333-8333-333333333333";
const topicId = "44444444-4444-4444-8444-444444444444";

function validCatalogItem() {
  return {
    id: courseId,
    title: "Public Course",
    slug: "public-course",
    thumbnail_url: null,
    price: "125000.50",
    created_at: "2026-07-10T10:00:00.000Z",
    enrollment_count: "42",
  };
}

function validDetail() {
  return {
    ...validCatalogItem(),
    description: null,
    owner: {
      id: ownerId,
      full_name: null,
      avatar_url: null,
      bio: null,
      experience_years: null,
      certifications: null,
    },
    collaborators: [],
    syllabus: [
      {
        id: chapterId,
        title: "Chapter",
        order_index: 0,
        topics: [
          {
            id: topicId,
            title: "Topic",
            slug: "topic-one",
            order_index: 0,
          },
        ],
      },
    ],
  };
}

describe("public course RPC schemas", () => {
  it("normalizes PostgreSQL numeric and bigint values", () => {
    const parsedCatalog = publicCourseCatalogRpcSchema.parse([
      validCatalogItem(),
      { ...validCatalogItem(), id: ownerId, price: 0, enrollment_count: 3 },
    ]);

    expect(parsedCatalog[0]).toMatchObject({
      price: 125000.5,
      enrollment_count: 42,
    });
    expect(parsedCatalog[1]).toMatchObject({ price: 0, enrollment_count: 3 });
  });

  it("accepts nullable owner and preserves empty public arrays", () => {
    const parsed = publicCourseDetailRpcSchema.parse({
      ...validDetail(),
      owner: null,
      collaborators: [],
      syllabus: [],
    });

    expect(parsed.owner).toBeNull();
    expect(parsed.collaborators).toEqual([]);
    expect(parsed.syllabus).toEqual([]);
  });

  it("preserves collaborator and syllabus array order without re-sorting", () => {
    const firstInstructor = validDetail().owner!;
    const secondInstructor = {
      ...firstInstructor,
      id: "99999999-9999-4999-8999-999999999999",
    };
    const firstChapter = validDetail().syllabus[0];
    const secondChapter = {
      ...firstChapter,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      topics: [],
    };
    const parsed = publicCourseDetailRpcSchema.parse({
      ...validDetail(),
      collaborators: [secondInstructor, firstInstructor],
      syllabus: [secondChapter, firstChapter],
    });

    expect(parsed.collaborators.map((instructor) => instructor.id)).toEqual([
      secondInstructor.id,
      firstInstructor.id,
    ]);
    expect(parsed.syllabus.map((chapter) => chapter.id)).toEqual([
      secondChapter.id,
      firstChapter.id,
    ]);
  });

  it("requires collaborators and syllabus to remain arrays", () => {
    expect(() =>
      publicCourseDetailRpcSchema.parse({
        ...validDetail(),
        collaborators: null,
      }),
    ).toThrow();
    expect(() =>
      publicCourseDetailRpcSchema.parse({
        ...validDetail(),
        syllabus: {},
      }),
    ).toThrow();
  });

  it.each([
    ["UUID", { id: "not-a-uuid" }],
    ["slug", { slug: "Invalid Slug" }],
    ["timestamp", { created_at: "not-a-date" }],
    ["negative price", { price: -1 }],
    ["invalid price", { price: "free" }],
    ["non-PostgreSQL numeric syntax", { price: "0x10" }],
    ["negative count", { enrollment_count: -1 }],
    ["fractional count", { enrollment_count: "1.5" }],
    ["unsafe count", { enrollment_count: "9007199254740992" }],
  ])("rejects invalid %s values", (_, override) => {
    expect(() =>
      publicCourseCatalogRpcSchema.parse([
        { ...validCatalogItem(), ...override },
      ]),
    ).toThrow();
  });

  it("rejects invalid chapter and topic ordering", () => {
    const invalidChapter = validDetail();
    invalidChapter.syllabus[0].order_index = -1;
    expect(() => publicCourseDetailRpcSchema.parse(invalidChapter)).toThrow();

    const invalidTopic = validDetail();
    invalidTopic.syllabus[0].topics[0].order_index = 1.5;
    expect(() => publicCourseDetailRpcSchema.parse(invalidTopic)).toThrow();
  });

  it("fails closed on unexpected or protected fields", () => {
    expect(() =>
      publicCourseCatalogRpcSchema.parse([
        { ...validCatalogItem(), description: "unexpected" },
      ]),
    ).toThrow();

    const protectedDetail = {
      ...validDetail(),
      owner: { ...validDetail().owner, email: "owner@example.com" },
      syllabus: [
        {
          ...validDetail().syllabus[0],
          topics: [
            {
              ...validDetail().syllabus[0].topics[0],
              content: "protected lesson content",
            },
          ],
        },
      ],
    };
    expect(() => publicCourseDetailRpcSchema.parse(protectedDetail)).toThrow();
  });
});
