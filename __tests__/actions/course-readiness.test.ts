import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseDashboardReadiness } from "@/app/actions/course-readiness";
import { createClient } from "@/utils/supabase/server";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Test plan:
// - Mục tiêu: kiểm tra Server Action readiness giữ access convention, enforce dashboard role boundary, query bounded content graph và trả safe result.
// - Loại test: action/unit với Supabase mock.
// - Đối tượng: getCourseDashboardReadiness.
// - Case thành công: owner/co_owner/editor hợp lệ, graph parse được, contract trả counts/issues/primary CTA.
// - Case thất bại: previewer/non-collaborator bị chặn, authorization query failure, graph query failure, runtime parse failure, invalid course id, missing auth.
// - Bảo mật/phân quyền: action phải kiểm tra collaborator role owner/co_owner/editor trước khi đọc graph.
// - Ổn định/resilience: raw Supabase/Zod details chỉ log server-side, client nhận error code/message an toàn.
// - Invariant cần giữ: query không đọc learner analytics/enrollments và không N+1 theo từng entity.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/actions/course-readiness.test.ts __tests__/schemas/course-readiness.test.ts`.

const mockedCreateClient = vi.mocked(createClient);

const ids = {
  user: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  card: "44444444-4444-4444-8444-444444444444",
  exercise: "55555555-5555-4555-8555-555555555555",
  question: "77777777-7777-4777-8777-777777777777",
  optionA: "88888888-8888-4888-8888-888888888888",
  optionB: "99999999-9999-4999-8999-999999999999",
};

type QueryCall = {
  table: string;
  selects: string[];
  eqs: Array<[string, unknown]>;
  ins: Array<[string, unknown[]]>;
  isFilters: Array<[string, unknown]>;
  orders: Array<[string, unknown]>;
};

const readinessDashboardRoles = ["owner", "co_owner", "editor"] as const;
const graphTables = [
  "chapters",
  "topics",
  "cards",
  "exercises",
  "question_groups",
  "questions",
  "question_options",
];

function accessRow(role: "owner" | "co_owner" | "editor" | "previewer") {
  return {
    role,
    courses: {
      id: ids.course,
      title: "TOEIC Readiness",
      slug: "toeic-readiness",
      description: "Course description",
      thumbnail_url: null,
      price: 0,
      status: "draft",
      order_index: 1,
      removed_at: null,
    },
  };
}

function createReadinessClient(overrides: Record<string, unknown> = {}) {
  const calls: QueryCall[] = [];
  const rowsByTable: Record<string, unknown> = {
    course_collaborators: {
      data: accessRow("owner"),
      error: null,
    },
    chapters: {
      data: [
        {
          id: ids.chapter,
          course_id: ids.course,
          title: "Chapter",
          order_index: 1,
          created_at: "2026-06-01T00:00:00.000Z",
          removed_at: null,
        },
      ],
      error: null,
    },
    topics: {
      data: [
        {
          id: ids.topic,
          course_id: ids.course,
          chapter_id: ids.chapter,
          title: "Topic",
          slug: "topic",
          status: "draft",
          order_index: 1,
          created_at: "2026-06-01T00:00:00.000Z",
          removed_at: null,
        },
      ],
      error: null,
    },
    cards: {
      data: [
        {
          id: ids.card,
          topic_id: ids.topic,
          order_index: 1,
          removed_at: null,
        },
      ],
      error: null,
    },
    exercises: {
      data: [
        {
          id: ids.exercise,
          course_id: ids.course,
          topic_id: ids.topic,
          title: "Part 5 Practice",
          part_type: "part5",
          order_index: 1,
          created_at: "2026-06-01T00:00:00.000Z",
          removed_at: null,
        },
      ],
      error: null,
    },
    question_groups: {
      data: [],
      error: null,
    },
    questions: {
      data: [
        {
          id: ids.question,
          course_id: ids.course,
          exercise_id: ids.exercise,
          group_id: null,
          content: "Choose the answer.",
          order_index: 1,
          created_at: "2026-06-01T00:00:00.000Z",
          removed_at: null,
        },
      ],
      error: null,
    },
    question_options: {
      data: [
        {
          id: ids.optionA,
          question_id: ids.question,
          content: "Correct",
          label: "A",
          is_correct: true,
          order_index: 0,
          removed_at: null,
        },
        {
          id: ids.optionB,
          question_id: ids.question,
          content: "Wrong",
          label: "B",
          is_correct: false,
          order_index: 1,
          removed_at: null,
        },
      ],
      error: null,
    },
    ...overrides,
  };

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: ids.user, email: "teacher@example.com" } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      const call: QueryCall = {
        table,
        selects: [],
        eqs: [],
        ins: [],
        isFilters: [],
        orders: [],
      };
      calls.push(call);

      const chain = {
        select: vi.fn((fields: string) => {
          call.selects.push(fields);
          return chain;
        }),
        eq: vi.fn((field: string, value: unknown) => {
          call.eqs.push([field, value]);
          return chain;
        }),
        in: vi.fn((field: string, value: unknown[]) => {
          call.ins.push([field, value]);
          return chain;
        }),
        is: vi.fn((field: string, value: unknown) => {
          call.isFilters.push([field, value]);
          return chain;
        }),
        order: vi.fn((field: string, options: unknown) => {
          call.orders.push([field, options]);
          return chain;
        }),
        single: vi.fn(() => Promise.resolve(rowsByTable[table])),
        then: vi.fn((onFulfilled) =>
          Promise.resolve(rowsByTable[table]).then(onFulfilled),
        ),
      };

      return chain;
    }),
  };

  return { client, calls };
}

function expectNoGraphQueries(calls: QueryCall[]) {
  expect(calls.map((call) => call.table)).toEqual(["course_collaborators"]);
  expect(calls.some((call) => graphTables.includes(call.table))).toBe(false);
}

describe("getCourseDashboardReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a validated readiness contract and preserves bounded query conventions", async () => {
    const { client, calls } = createReadinessClient();
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const result = await getCourseDashboardReadiness(ids.course);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.counts).toMatchObject({
      chapters: 1,
      topics: 1,
      flashcards: 1,
      exercises: 1,
      questions: 1,
      answerOptions: 2,
    });
    expect(result.data.issues).toEqual([]);

    const accessCall = calls.find((call) => call.table === "course_collaborators");
    expect(accessCall?.selects[0]).toContain("courses!inner");
    expect(accessCall?.eqs).toEqual([
      ["course_id", ids.course],
      ["user_id", ids.user],
    ]);
    expect(accessCall?.ins).toContainEqual([
      "role",
      [...readinessDashboardRoles],
    ]);
    expect(accessCall?.isFilters).toContainEqual(["courses.removed_at", null]);

    const selectedFields = calls.flatMap((call) => call.selects).join("\n");
    expect(selectedFields).not.toContain("enrollments");
    expect(selectedFields).not.toContain("user_topic_progress");
    expect(calls.map((call) => call.table)).toEqual([
      "course_collaborators",
      "chapters",
      "topics",
      "cards",
      "exercises",
      "question_groups",
      "questions",
      "question_options",
    ]);
  });

  it.each(["co_owner", "editor"] as const)(
    "allows collaborator role %s to load dashboard readiness data",
    async (role) => {
      const { client, calls } = createReadinessClient({
        course_collaborators: {
          data: accessRow(role),
          error: null,
        },
      });
      mockedCreateClient.mockResolvedValueOnce(
        client as unknown as Awaited<ReturnType<typeof createClient>>,
      );

      const result = await getCourseDashboardReadiness(ids.course);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.role).toBe(role);
      expect(calls.map((call) => call.table)).toContain("chapters");
    },
  );

  it("rejects previewer before loading the readiness graph", async () => {
    const { client, calls } = createReadinessClient({
      course_collaborators: {
        data: accessRow("previewer"),
        error: null,
      },
    });
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const result = await getCourseDashboardReadiness(ids.course);

    expect(result).toEqual({
      success: false,
      error: {
        code: "COURSE_NOT_FOUND_OR_FORBIDDEN",
        message: "Khóa học không tồn tại hoặc bạn không có quyền truy cập.",
      },
    });
    expectNoGraphQueries(calls);
  });

  it("rejects non-collaborators before loading the readiness graph", async () => {
    const { client, calls } = createReadinessClient({
      course_collaborators: {
        data: null,
        error: {
          code: "PGRST116",
          message: "The result contains 0 rows",
        },
      },
    });
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const result = await getCourseDashboardReadiness(ids.course);

    expect(result).toEqual({
      success: false,
      error: {
        code: "COURSE_NOT_FOUND_OR_FORBIDDEN",
        message: "Khóa học không tồn tại hoặc bạn không có quyền truy cập.",
      },
    });
    expectNoGraphQueries(calls);
  });

  it("returns a safe error when authorization query fails without loading the graph", async () => {
    const { client, calls } = createReadinessClient({
      course_collaborators: {
        data: null,
        error: { code: "42501", message: "permission denied" },
      },
    });
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    const result = await getCourseDashboardReadiness(ids.course);

    expect(result).toEqual({
      success: false,
      error: {
        code: "QUERY_FAILED",
        message:
          "Không thể kiểm tra quyền truy cập readiness của khóa học. Vui lòng thử lại.",
      },
    });
    expectNoGraphQueries(calls);
  });

  it("returns a safe error when a bounded query fails", async () => {
    const { client } = createReadinessClient({
      chapters: {
        data: null,
        error: { code: "42501", message: "permission denied" },
      },
    });
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    const result = await getCourseDashboardReadiness(ids.course);

    expect(result).toEqual({
      success: false,
      error: {
        code: "QUERY_FAILED",
        message: "Không thể tải dữ liệu readiness của khóa học. Vui lòng thử lại.",
      },
    });
  });

  it("returns a safe error when runtime data fails schema validation", async () => {
    const { client } = createReadinessClient({
      topics: {
        data: [
          {
            id: ids.topic,
            course_id: ids.course,
            chapter_id: ids.chapter,
            title: "Topic",
            slug: "topic",
            status: "archived",
            order_index: 1,
            created_at: "2026-06-01T00:00:00.000Z",
            removed_at: null,
          },
        ],
        error: null,
      },
    });
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    const result = await getCourseDashboardReadiness(ids.course);

    expect(result).toEqual({
      success: false,
      error: {
        code: "INVALID_READINESS_DATA",
        message: "Cấu trúc dữ liệu readiness không hợp lệ. Vui lòng thử lại.",
      },
    });
  });

  it("rejects invalid route params before auth or database access", async () => {
    const result = await getCourseDashboardReadiness("not-a-course-id");

    expect(result).toEqual({
      success: false,
      error: {
        code: "INVALID_COURSE_ID",
        message: "ID khóa học không hợp lệ.",
      },
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("returns auth error before querying the content graph", async () => {
    const { client } = createReadinessClient();
    client.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const result = await getCourseDashboardReadiness(ids.course);

    expect(result).toEqual({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      },
    });
    expect(client.from).not.toHaveBeenCalled();
  });
});
