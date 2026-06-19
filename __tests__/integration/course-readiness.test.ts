import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { getCourseDashboardReadiness } from "@/app/actions/course-readiness";
import { courseReadinessResultSchema } from "@/lib/schemas/course-readiness";

type CookieRecord = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

type TestCookieStore = {
  getAll: () => CookieRecord[];
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
};

const nextHeadersMock = vi.hoisted(() => ({
  currentCookieStore: {
    getAll: () => [],
    set: () => {},
  } as TestCookieStore,
}));

vi.mock("next/headers", () => ({
  cookies: async () => nextHeadersMock.currentCookieStore,
}));

// Test plan:
// - Mục tiêu: kiểm tra Server Action readiness với Supabase local thật, session thật và dữ liệu course thật.
// - Loại test: integration/Server Action/Supabase.
// - Đối tượng: getCourseDashboardReadiness.
// - Case thành công: owner, co_owner và editor nhận readiness data đã validate từ content graph thật.
// - Case thất bại: previewer, non-collaborator và unauthenticated không nhận readiness data.
// - Bảo mật/phân quyền: previewer vẫn đọc được content theo RLS nhưng không được nhận dashboard readiness.
// - Ổn định/resilience: fixture tự tạo dữ liệu tối thiểu, cleanup theo thứ tự phụ thuộc, không dùng mock Supabase chain.
// - Invariant cần giữ: output readiness đến từ Server Action, Zod runtime boundary và hàm tính readiness hiện có.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:integration -- __tests__/integration/course-readiness.test.ts`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEEDED_TEACHER_EMAIL = "teacher@gmail.com";
const SEEDED_STUDENT_EMAIL = "student@gmail.com";
const SEEDED_PASSWORD = "123123";
const SEEDED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let teacherClient: SupabaseClient;
let studentClient: SupabaseClient;
let teacherCookieStore: TestCookieStore;
let studentCookieStore: TestCookieStore;
const createdCourseIds = new Set<string>();

type CollaboratorRole = "owner" | "co_owner" | "editor" | "previewer";

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true khi dang dung test/dev DB.",
    );
  }

  const url = new URL(SUPABASE_URL);
  const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "http:" || !isLocalHost) {
    throw new Error(
      `Chan test DB integration vi Supabase URL khong phai local: ${SUPABASE_URL}`,
    );
  }
}

function createCookieStore(): TestCookieStore {
  const cookies = new Map<string, CookieRecord>();

  return {
    getAll: () => Array.from(cookies.values()),
    set: (name, value, options) => {
      cookies.set(name, { name, value, options });
    },
  };
}

async function signInSeededClient(email: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password: SEEDED_PASSWORD,
  });

  if (error) {
    throw new Error(`Khong the dang nhap seeded user ${email}: ${error.message}`);
  }

  return client;
}

async function signInCookieStore(email: string) {
  const cookieStore = createCookieStore();
  const serverClient = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: cookieStore.getAll,
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as Record<string, unknown>);
        });
      },
    },
  });

  const { error } = await serverClient.auth.signInWithPassword({
    email,
    password: SEEDED_PASSWORD,
  });

  if (error) {
    throw new Error(`Khong the tao session cookie cho ${email}: ${error.message}`);
  }

  return cookieStore;
}

function useCookieStore(cookieStore: TestCookieStore) {
  nextHeadersMock.currentCookieStore = cookieStore;
}

function useUnauthenticatedCookieStore() {
  nextHeadersMock.currentCookieStore = createCookieStore();
}

async function createCourseFixture(role: CollaboratorRole | null) {
  const suffix = randomUUID();
  const courseId = randomUUID();

  const { error: courseError } = await supabaseAdmin.from("courses").insert({
    id: courseId,
    title: `Readiness Integration ${suffix}`,
    slug: `readiness-integration-${suffix}`,
    description: "Course created by readiness integration test",
    price: 0,
    status: "draft",
    removed_at: null,
  });

  if (courseError) {
    throw new Error(`Khong the tao course fixture: ${courseError.message}`);
  }

  createdCourseIds.add(courseId);

  if (role) {
    const { error: collaboratorError } = await supabaseAdmin
      .from("course_collaborators")
      .insert({
        course_id: courseId,
        user_id: SEEDED_TEACHER_ID,
        role,
        added_by: SEEDED_TEACHER_ID,
      });

    if (collaboratorError) {
      throw new Error(
        `Khong the tao collaborator fixture: ${collaboratorError.message}`,
      );
    }
  }

  return courseId;
}

async function addCompleteReadinessGraph(courseId: string, includeRemovedRows = false) {
  const suffix = randomUUID();
  const chapterId = randomUUID();
  const topicId = randomUUID();
  const exerciseId = randomUUID();
  const questionId = randomUUID();

  const { error: chapterError } = await supabaseAdmin.from("chapters").insert({
    id: chapterId,
    course_id: courseId,
    title: `Readiness Chapter ${suffix}`,
    order_index: 1,
    removed_at: null,
  });

  if (chapterError) {
    throw new Error(`Khong the tao chapter fixture: ${chapterError.message}`);
  }

  const { error: topicError } = await supabaseAdmin.from("topics").insert({
    id: topicId,
    course_id: courseId,
    chapter_id: chapterId,
    title: `Readiness Topic ${suffix}`,
    slug: `readiness-topic-${suffix}`,
    status: "draft",
    order_index: 1,
    removed_at: null,
  });

  if (topicError) {
    throw new Error(`Khong the tao topic fixture: ${topicError.message}`);
  }

  const { error: exerciseError } = await supabaseAdmin.from("exercises").insert({
    id: exerciseId,
    course_id: courseId,
    topic_id: topicId,
    title: `Readiness Part 5 ${suffix}`,
    part_type: "part5",
    order_index: 1,
    removed_at: null,
  });

  if (exerciseError) {
    throw new Error(`Khong the tao exercise fixture: ${exerciseError.message}`);
  }

  const { error: questionError } = await supabaseAdmin.from("questions").insert({
    id: questionId,
    course_id: courseId,
    exercise_id: exerciseId,
    group_id: null,
    content: "Choose the best answer.",
    order_index: 1,
    removed_at: null,
  });

  if (questionError) {
    throw new Error(`Khong the tao question fixture: ${questionError.message}`);
  }

  const { error: optionError } = await supabaseAdmin.from("question_options").insert([
    {
      id: randomUUID(),
      question_id: questionId,
      content: "Correct",
      label: "A",
      is_correct: true,
      order_index: 0,
      removed_at: null,
    },
    {
      id: randomUUID(),
      question_id: questionId,
      content: "Wrong",
      label: "B",
      is_correct: false,
      order_index: 1,
      removed_at: null,
    },
  ]);

  if (optionError) {
    throw new Error(`Khong the tao option fixture: ${optionError.message}`);
  }

  if (!includeRemovedRows) return { chapterId, topicId, exerciseId, questionId };

  const removedAt = new Date().toISOString();
  const removedExerciseId = randomUUID();

  const { error: removedExerciseError } = await supabaseAdmin
    .from("exercises")
    .insert({
      id: removedExerciseId,
      course_id: courseId,
      topic_id: topicId,
      title: `Removed Readiness Exercise ${suffix}`,
      part_type: "part5",
      order_index: 2,
      removed_at: removedAt,
    });

  if (removedExerciseError) {
    throw new Error(
      `Khong the tao removed exercise fixture: ${removedExerciseError.message}`,
    );
  }

  const { error: removedOptionError } = await supabaseAdmin
    .from("question_options")
    .insert({
      id: randomUUID(),
      question_id: questionId,
      content: "Removed correct option",
      label: "C",
      is_correct: true,
      order_index: 2,
      removed_at: removedAt,
    });

  if (removedOptionError) {
    throw new Error(
      `Khong the tao removed option fixture: ${removedOptionError.message}`,
    );
  }

  return { chapterId, topicId, exerciseId, questionId };
}

function throwCleanupError(
  courseId: string,
  step: string,
  error: { message?: string } | null,
) {
  if (!error) return;

  throw new Error(
    `Không thể cleanup fixture readiness ở bước ${step} cho course ${courseId}: ${
      error.message ?? "lỗi Supabase không rõ"
    }`,
  );
}

async function cleanupCourse(courseId: string) {
  const { data: topics, error: topicsError } = await supabaseAdmin
    .from("topics")
    .select("id")
    .eq("course_id", courseId);
  throwCleanupError(courseId, "đọc topics", topicsError);

  const topicIds = topics?.map((topic) => topic.id as string) ?? [];

  const { data: exercises, error: exercisesError } = await supabaseAdmin
    .from("exercises")
    .select("id")
    .eq("course_id", courseId);
  throwCleanupError(courseId, "đọc exercises", exercisesError);

  const exerciseIds = exercises?.map((exercise) => exercise.id as string) ?? [];

  if (exerciseIds.length > 0) {
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from("questions")
      .select("id")
      .in("exercise_id", exerciseIds);
    throwCleanupError(courseId, "đọc questions", questionsError);

    const questionIds = questions?.map((question) => question.id as string) ?? [];

    if (questionIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("question_options")
        .delete()
        .in("question_id", questionIds);
      throwCleanupError(courseId, "xóa question_options", error);
    }

    const { error: deleteQuestionsError } = await supabaseAdmin
      .from("questions")
      .delete()
      .in("exercise_id", exerciseIds);
    throwCleanupError(courseId, "xóa questions", deleteQuestionsError);

    const { error: deleteGroupsError } = await supabaseAdmin
      .from("question_groups")
      .delete()
      .in("exercise_id", exerciseIds);
    throwCleanupError(courseId, "xóa question_groups", deleteGroupsError);

    const { error: deleteExercisesError } = await supabaseAdmin
      .from("exercises")
      .delete()
      .in("id", exerciseIds);
    throwCleanupError(courseId, "xóa exercises", deleteExercisesError);
  }

  if (topicIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("cards")
      .delete()
      .in("topic_id", topicIds);
    throwCleanupError(courseId, "xóa cards", error);
  }

  const { error: deleteTopicsError } = await supabaseAdmin
    .from("topics")
    .delete()
    .eq("course_id", courseId);
  throwCleanupError(courseId, "xóa topics", deleteTopicsError);

  const { error: deleteChaptersError } = await supabaseAdmin
    .from("chapters")
    .delete()
    .eq("course_id", courseId);
  throwCleanupError(courseId, "xóa chapters", deleteChaptersError);

  const { error: deleteCollaboratorsError } = await supabaseAdmin
    .from("course_collaborators")
    .delete()
    .eq("course_id", courseId);
  throwCleanupError(courseId, "xóa course_collaborators", deleteCollaboratorsError);

  const { error: deleteCourseError } = await supabaseAdmin
    .from("courses")
    .delete()
    .eq("id", courseId);
  throwCleanupError(courseId, "xóa courses", deleteCourseError);
}

async function cleanupCreatedData() {
  for (const courseId of Array.from(createdCourseIds)) {
    await cleanupCourse(courseId);
    createdCourseIds.delete(courseId);
  }
}

describe.sequential("course readiness Server Action integration", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();

    teacherClient = await signInSeededClient(SEEDED_TEACHER_EMAIL);
    studentClient = await signInSeededClient(SEEDED_STUDENT_EMAIL);
    teacherCookieStore = await signInCookieStore(SEEDED_TEACHER_EMAIL);
    studentCookieStore = await signInCookieStore(SEEDED_STUDENT_EMAIL);
  });

  afterEach(async () => {
    await cleanupCreatedData();
    useUnauthenticatedCookieStore();
  });

  afterAll(async () => {
    await cleanupCreatedData();
    await teacherClient?.auth.signOut();
    await studentClient?.auth.signOut();
  });

  it.each(["owner", "co_owner", "editor"] as const)(
    "allows %s to receive validated readiness data from real course content",
    async (role) => {
      const courseId = await createCourseFixture(role);
      const graph = await addCompleteReadinessGraph(courseId, role === "owner");

      useCookieStore(teacherCookieStore);
      const result = await getCourseDashboardReadiness(courseId);

      expect(courseReadinessResultSchema.safeParse(result).success).toBe(true);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.role).toBe(role);
      expect(result.data.counts).toMatchObject({
        chapters: 1,
        topics: 1,
        exercises: 1,
        questions: 1,
        answerOptions: 2,
      });
      expect(result.data.issues).toEqual([]);
      expect(result.data.primaryCta).toMatchObject({
        sourceIssueId: null,
        destination: {
          type: "topic_builder",
          courseId,
          topicId: graph.topicId,
        },
      });
    },
  );

  it("denies previewer dashboard readiness even though content-read RLS can see draft content", async () => {
    const courseId = await createCourseFixture("previewer");
    await addCompleteReadinessGraph(courseId);

    const contentRead = await teacherClient
      .from("chapters")
      .select("id")
      .eq("course_id", courseId);
    expect(contentRead.error).toBeNull();
    expect(contentRead.data).toHaveLength(1);

    useCookieStore(teacherCookieStore);
    const result = await getCourseDashboardReadiness(courseId);

    expect(result).toEqual({
      success: false,
      error: {
        code: "COURSE_NOT_FOUND_OR_FORBIDDEN",
        message: "Khóa học không tồn tại hoặc bạn không có quyền truy cập.",
      },
    });
  });

  it("denies a signed-in non-collaborator without returning readiness data", async () => {
    const courseId = await createCourseFixture("owner");
    await addCompleteReadinessGraph(courseId);

    useCookieStore(studentCookieStore);
    const result = await getCourseDashboardReadiness(courseId);

    expect(result).toEqual({
      success: false,
      error: {
        code: "COURSE_NOT_FOUND_OR_FORBIDDEN",
        message: "Khóa học không tồn tại hoặc bạn không có quyền truy cập.",
      },
    });
  });

  it("rejects unauthenticated requests before returning readiness data", async () => {
    const courseId = await createCourseFixture("owner");
    await addCompleteReadinessGraph(courseId);

    useUnauthenticatedCookieStore();
    const result = await getCourseDashboardReadiness(courseId);

    expect(result).toEqual({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      },
    });
  });
});
