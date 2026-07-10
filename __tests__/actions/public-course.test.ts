import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublicCourseCatalog,
  getPublicCourseDetail,
} from "@/app/actions/public-course";
import { createClient } from "@/utils/supabase/server";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const courseId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function catalogItem() {
  return {
    id: courseId,
    title: "Public Course",
    slug: "public-course",
    thumbnail_url: null,
    price: "120000",
    created_at: "2026-07-10T10:00:00.000Z",
    enrollment_count: "12",
  };
}

function detailPayload() {
  return {
    ...catalogItem(),
    description: "Public description",
    owner: null,
    collaborators: [],
    syllabus: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        title: "Empty chapter",
        order_index: 0,
        topics: [],
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        title: "First non-empty chapter",
        order_index: 1,
        topics: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            title: "First topic",
            slug: "first-topic",
            order_index: 0,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            title: "Second topic",
            slug: "second-topic",
            order_index: 1,
          },
        ],
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        title: "Later chapter",
        order_index: 2,
        topics: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            title: "Later topic",
            slug: "later-topic",
            order_index: 0,
          },
        ],
      },
    ],
  };
}

type ClientOptions = {
  rpcData?: unknown;
  rpcError?: unknown;
  user?: { id: string } | null;
  enrollment?: { id: string } | null;
  enrollmentError?: unknown;
};

function createMockClient(options: ClientOptions = {}) {
  const enrollmentQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  enrollmentQuery.select.mockImplementation(() => enrollmentQuery);
  enrollmentQuery.eq.mockImplementation(() => enrollmentQuery);
  enrollmentQuery.maybeSingle.mockResolvedValue({
    data: options.enrollment ?? null,
    error: options.enrollmentError ?? null,
  });

  return {
    rpc: vi.fn().mockResolvedValue({
      data: options.rpcData,
      error: options.rpcError ?? null,
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
        error: null,
      }),
    },
    from: vi.fn(() => enrollmentQuery),
    enrollmentQuery,
  };
}

function mockClient(client: ReturnType<typeof createMockClient>) {
  mockedCreateClient.mockResolvedValueOnce(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

describe("public course actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a normalized catalog success result", async () => {
    const client = createMockClient({ rpcData: [catalogItem()] });
    mockClient(client);

    const result = await getPublicCourseCatalog();

    expect(result).toEqual({
      status: "success",
      data: [{ ...catalogItem(), price: 120000, enrollment_count: 12 }],
    });
    expect(client.rpc).toHaveBeenCalledWith("get_public_course_catalog");
  });

  it("preserves an empty catalog as success", async () => {
    mockClient(createMockClient({ rpcData: [] }));
    await expect(getPublicCourseCatalog()).resolves.toEqual({
      status: "success",
      data: [],
    });
  });

  it("does not convert catalog RPC errors into empty data", async () => {
    mockClient(createMockClient({ rpcData: null, rpcError: { message: "db" } }));
    const result = await getPublicCourseCatalog();
    expect(result.status).toBe("error");
    expect("data" in result).toBe(false);
  });

  it("returns a safe error on catalog contract drift", async () => {
    mockClient(
      createMockClient({
        rpcData: [{ ...catalogItem(), enrollment_count: -1 }],
      }),
    );
    await expect(getPublicCourseCatalog()).resolves.toMatchObject({
      status: "error",
    });
  });

  it("rejects an invalid detail slug before creating a database client", async () => {
    await expect(getPublicCourseDetail("bad slug/segment")).resolves.toEqual({
      status: "not_found",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("distinguishes a null detail payload as not found", async () => {
    mockClient(createMockClient({ rpcData: null }));
    await expect(getPublicCourseDetail("public-course")).resolves.toEqual({
      status: "not_found",
    });
  });

  it("returns a recoverable detail error when the RPC fails", async () => {
    mockClient(createMockClient({ rpcError: { message: "db" } }));
    await expect(getPublicCourseDetail("public-course")).resolves.toMatchObject({
      status: "error",
    });
  });

  it("returns a recoverable detail error on protected contract drift", async () => {
    mockClient(
      createMockClient({
        rpcData: { ...detailPayload(), enrollment_user_id: userId },
      }),
    );
    await expect(getPublicCourseDetail("public-course")).resolves.toMatchObject({
      status: "error",
    });
  });

  it("maps anonymous detail data and marks only the first stable topic as temporary preview", async () => {
    const client = createMockClient({ rpcData: detailPayload() });
    mockClient(client);

    const result = await getPublicCourseDetail("public-course");

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success result");
    expect(result.data.is_enrolled).toBe(false);
    expect(result.data.owner).toBeNull();
    expect(result.data.collaborators).toEqual([]);
    expect(
      result.data.syllabus.flatMap((chapter) =>
        chapter.topics.map((topic) => topic.is_temporary_preview),
      ),
    ).toEqual([true, false, false]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("overlays only the authenticated user's enrollment state", async () => {
    const client = createMockClient({
      rpcData: detailPayload(),
      user: { id: userId },
      enrollment: { id: "99999999-9999-4999-8999-999999999999" },
    });
    mockClient(client);

    const result = await getPublicCourseDetail("public-course");

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success result");
    expect(result.data.is_enrolled).toBe(true);
    expect(client.from).toHaveBeenCalledWith("enrollments");
    expect(client.enrollmentQuery.select).toHaveBeenCalledWith("id");
    expect(client.enrollmentQuery.eq).toHaveBeenNthCalledWith(
      1,
      "course_id",
      courseId,
    );
    expect(client.enrollmentQuery.eq).toHaveBeenNthCalledWith(
      2,
      "user_id",
      userId,
    );
    expect(JSON.stringify(result.data)).not.toContain(userId);
  });

  it("returns a recoverable error when enrollment overlay cannot be trusted", async () => {
    mockClient(
      createMockClient({
        rpcData: detailPayload(),
        user: { id: userId },
        enrollmentError: { message: "rls failure" },
      }),
    );
    await expect(getPublicCourseDetail("public-course")).resolves.toMatchObject({
      status: "error",
    });
  });
});
