import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Test plan:
// - Mục tiêu: kiểm tra public catalog/detail RPC chỉ công khai read model B1.1 đã duyệt và không nới RLS content.
// - Loại test: integration/RPC/RLS/Supabase.
// - Đối tượng: get_public_course_catalog, get_public_course_detail, direct-table RLS và index enrollment course_id.
// - Case thành công: anon/authenticated đọc catalog/detail, count/order/empty chapter/instructor presentation đúng.
// - Case thất bại: unknown, draft, removed course trả null; removed chapter và draft/pending/removed topic bị loại.
// - Bảo mật/phân quyền: output không lộ identity/contact/role/content; anon vẫn không đọc trực tiếp content/enrollment tables;
//   service-role chỉ dựng/cleanup fixture và RPC app flow dùng anon/authenticated clients.
// - Ổn định/resilience: fixture UUID cô lập, cleanup fail loud, catalog tie được chốt bằng id và index được kiểm tra trên local DB.
// - Invariant cần giữ: RPC là public metadata whitelist; protected table policies không đổi.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:integration -- __tests__/integration/public-course-read-model.test.ts`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEEDED_ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const SEEDED_TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const SEEDED_STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const SEEDED_STUDENT_EMAIL = "student@gmail.com";
const SEEDED_PASSWORD = "123123";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type CatalogRow = {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  price: number | string;
  created_at: string;
  enrollment_count: number | string;
};

type InstructorPresentation = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  experience_years: number | null;
  certifications: string | null;
};

type PublicTopic = {
  id: string;
  title: string;
  slug: string;
  order_index: number;
};

type PublicChapter = {
  id: string;
  title: string;
  order_index: number;
  topics: PublicTopic[];
};

type PublicDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number | string;
  created_at: string;
  enrollment_count: number | string;
  owner: InstructorPresentation | null;
  collaborators: InstructorPresentation[];
  syllabus: PublicChapter[];
};

type Fixture = {
  detailCourseId: string;
  secondPublishedCourseId: string;
  ownerlessCourseId: string;
  detailSlug: string;
  ownerlessSlug: string;
  draftSlug: string;
  pendingSlug: string;
  removedSlug: string;
  emptyChapterId: string;
  contentChapterId: string;
  removedChapterId: string;
  publishedTopicIdsInOrder: string[];
  hiddenTopicIds: string[];
  cardId: string;
  exerciseId: string;
  questionId: string;
  previewerUserId: string;
  softDeletedOwnerUserId: string;
  collaboratorUserIdsInOrder: string[];
};

let anonymousClient: SupabaseClient;
let studentClient: SupabaseClient;
let fixture: Fixture;

const createdCourseIds = new Set<string>();
const createdCardIds = new Set<string>();
const createdExerciseIds = new Set<string>();
const createdQuestionIds = new Set<string>();
let createdPreviewerUserId: string | null = null;
let createdSoftDeletedOwnerUserId: string | null = null;

function assertSafeIntegrationEnv() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error(
      "Chặn test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true nếu chắc chắn đang dùng test/dev DB.",
    );
  }

  if (!SUPABASE_URL.startsWith("http://127.0.0.1:45321")) {
    throw new Error(
      `Chặn test DB integration vì Supabase URL không phải local: ${SUPABASE_URL}`,
    );
  }
}

function throwFixtureError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function signInStudent() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: SEEDED_STUDENT_EMAIL,
    password: SEEDED_PASSWORD,
  });

  throwFixtureError("Không thể đăng nhập seeded student", error);
  return client;
}

async function createPreviewerProfile() {
  const email = `public-read-previewer-${randomUUID()}@example.com`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "TestPassword123!",
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Không thể tạo previewer fixture: ${error?.message}`);
  }

  createdPreviewerUserId = data.user.id;

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    email,
    phone: "0900000000",
    full_name: "Internal Previewer",
    role: "teacher",
    removed_at: null,
  });
  throwFixtureError("Không thể tạo previewer profile", profileError);

  const { error: teacherProfileError } = await supabaseAdmin
    .from("teacher_profiles")
    .upsert({
      id: data.user.id,
      bio: "Internal preview-only biography",
      experience_years: 9,
      certifications: "Internal preview-only certificate",
    });
  throwFixtureError("Không thể tạo previewer teacher profile", teacherProfileError);

  return data.user.id;
}

async function createSoftDeletedOwnerProfile() {
  const email = `public-read-deleted-owner-${randomUUID()}@example.com`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "TestPassword123!",
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Không thể tạo soft-deleted owner fixture: ${error?.message}`);
  }

  createdSoftDeletedOwnerUserId = data.user.id;

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    email,
    phone: "0911111111",
    full_name: "Soft Deleted Owner",
    role: "teacher",
    removed_at: "2026-01-16T12:00:00.000Z",
  });
  throwFixtureError("Không thể tạo soft-deleted owner profile", profileError);

  const { error: teacherProfileError } = await supabaseAdmin
    .from("teacher_profiles")
    .upsert({
      id: data.user.id,
      bio: "Must not be public",
      experience_years: 12,
      certifications: "Must not be public",
    });
  throwFixtureError(
    "Không thể tạo soft-deleted owner teacher profile",
    teacherProfileError,
  );

  return data.user.id;
}

async function createFixtures(): Promise<Fixture> {
  const suffix = randomUUID();
  const detailCourseId = randomUUID();
  const secondPublishedCourseId = randomUUID();
  const ownerlessCourseId = randomUUID();
  const draftCourseId = randomUUID();
  const pendingCourseId = randomUUID();
  const removedCourseId = randomUUID();
  const detailSlug = `public-read-detail-${suffix}`;
  const ownerlessSlug = `public-read-ownerless-${suffix}`;
  const draftSlug = `public-read-draft-${suffix}`;
  const pendingSlug = `public-read-pending-${suffix}`;
  const removedSlug = `public-read-removed-${suffix}`;
  const tiedCreatedAt = "2026-01-15T12:00:00.000Z";

  [
    detailCourseId,
    secondPublishedCourseId,
    ownerlessCourseId,
    draftCourseId,
    pendingCourseId,
    removedCourseId,
  ].forEach((id) => createdCourseIds.add(id));

  const { error: courseError } = await supabaseAdmin.from("courses").insert([
    {
      id: detailCourseId,
      title: "Public Read Detail Course",
      slug: detailSlug,
      description: "Public-safe course description",
      thumbnail_url: "https://example.com/public-detail.webp",
      price: null,
      status: "published",
      created_at: tiedCreatedAt,
      removed_at: null,
    },
    {
      id: secondPublishedCourseId,
      title: "Public Read Second Course",
      slug: `public-read-second-${suffix}`,
      description: "Second catalog fixture",
      thumbnail_url: null,
      price: 125000,
      status: "published",
      created_at: tiedCreatedAt,
      removed_at: null,
    },
    {
      id: ownerlessCourseId,
      title: "Public Read Ownerless Course",
      slug: ownerlessSlug,
      description: "Public course without a valid public owner",
      thumbnail_url: null,
      price: 0,
      status: "published",
      created_at: "2026-01-14T12:00:00.000Z",
      removed_at: null,
    },
    {
      id: draftCourseId,
      title: "Public Read Draft Course",
      slug: draftSlug,
      price: 0,
      status: "draft",
      created_at: tiedCreatedAt,
      removed_at: null,
    },
    {
      id: pendingCourseId,
      title: "Public Read Pending Course",
      slug: pendingSlug,
      price: 0,
      status: "pending",
      created_at: tiedCreatedAt,
      removed_at: null,
    },
    {
      id: removedCourseId,
      title: "Public Read Removed Course",
      slug: removedSlug,
      price: 0,
      status: "published",
      created_at: tiedCreatedAt,
      removed_at: "2026-01-16T12:00:00.000Z",
    },
  ]);
  throwFixtureError("Không thể tạo course fixtures", courseError);

  const previewerUserId = await createPreviewerProfile();
  const softDeletedOwnerUserId = await createSoftDeletedOwnerProfile();
  const tiedCollaborators = [
    {
      id: randomUUID(),
      course_id: detailCourseId,
      user_id: SEEDED_STUDENT_ID,
      role: "editor",
      added_by: SEEDED_ADMIN_ID,
      created_at: "2026-01-15T12:00:01.000Z",
    },
    {
      id: randomUUID(),
      course_id: detailCourseId,
      user_id: SEEDED_TEACHER_ID,
      role: "co_owner",
      added_by: SEEDED_ADMIN_ID,
      created_at: "2026-01-15T12:00:01.000Z",
    },
  ];
  const collaboratorUserIdsInOrder = [...tiedCollaborators]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((collaborator) => collaborator.user_id);
  const { error: collaboratorError } = await supabaseAdmin
    .from("course_collaborators")
    .insert([
      {
        id: randomUUID(),
        course_id: detailCourseId,
        user_id: SEEDED_ADMIN_ID,
        role: "owner",
        added_by: SEEDED_ADMIN_ID,
        created_at: "2026-01-15T12:00:03.000Z",
      },
      ...tiedCollaborators,
      {
        id: randomUUID(),
        course_id: detailCourseId,
        user_id: previewerUserId,
        role: "previewer",
        added_by: SEEDED_ADMIN_ID,
        created_at: "2026-01-15T12:00:00.000Z",
      },
      {
        id: randomUUID(),
        course_id: ownerlessCourseId,
        user_id: softDeletedOwnerUserId,
        role: "owner",
        added_by: SEEDED_ADMIN_ID,
        created_at: "2026-01-15T12:00:00.000Z",
      },
    ]);
  throwFixtureError("Không thể tạo collaborator fixtures", collaboratorError);

  const emptyChapterId = randomUUID();
  const contentChapterId = randomUUID();
  const removedChapterId = randomUUID();
  const { error: chapterError } = await supabaseAdmin.from("chapters").insert([
    {
      id: emptyChapterId,
      course_id: detailCourseId,
      title: "Empty Public Chapter",
      order_index: 1,
      removed_at: null,
    },
    {
      id: contentChapterId,
      course_id: detailCourseId,
      title: "Public Syllabus Chapter",
      order_index: 2,
      removed_at: null,
    },
    {
      id: removedChapterId,
      course_id: detailCourseId,
      title: "Removed Chapter",
      order_index: 3,
      removed_at: "2026-01-16T12:00:00.000Z",
    },
  ]);
  throwFixtureError("Không thể tạo chapter fixtures", chapterError);

  const publishedTopicOrderTwoId = randomUUID();
  const publishedTopicOrderFourId = randomUUID();
  const draftTopicId = randomUUID();
  const pendingTopicId = randomUUID();
  const removedTopicId = randomUUID();
  const removedChapterTopicId = randomUUID();
  const { error: topicError } = await supabaseAdmin.from("topics").insert([
    {
      id: draftTopicId,
      course_id: detailCourseId,
      chapter_id: contentChapterId,
      title: "Draft Topic",
      slug: `draft-topic-${suffix}`,
      status: "draft",
      order_index: 1,
      removed_at: null,
    },
    {
      id: publishedTopicOrderTwoId,
      course_id: detailCourseId,
      chapter_id: contentChapterId,
      title: "Published Topic Two",
      slug: `published-topic-two-${suffix}`,
      status: "published",
      order_index: 2,
      removed_at: null,
    },
    {
      id: pendingTopicId,
      course_id: detailCourseId,
      chapter_id: contentChapterId,
      title: "Pending Topic",
      slug: `pending-topic-${suffix}`,
      status: "pending",
      order_index: 3,
      removed_at: null,
    },
    {
      id: publishedTopicOrderFourId,
      course_id: detailCourseId,
      chapter_id: contentChapterId,
      title: "Published Topic Four",
      slug: `published-topic-four-${suffix}`,
      status: "published",
      order_index: 4,
      removed_at: null,
    },
    {
      id: removedTopicId,
      course_id: detailCourseId,
      chapter_id: contentChapterId,
      title: "Removed Topic",
      slug: `removed-topic-${suffix}`,
      status: "published",
      order_index: 5,
      removed_at: "2026-01-16T12:00:00.000Z",
    },
    {
      id: removedChapterTopicId,
      course_id: detailCourseId,
      chapter_id: removedChapterId,
      title: "Topic Under Removed Chapter",
      slug: `removed-chapter-topic-${suffix}`,
      status: "published",
      order_index: 1,
      removed_at: null,
    },
  ]);
  throwFixtureError("Không thể tạo topic fixtures", topicError);

  const cardId = randomUUID();
  createdCardIds.add(cardId);
  const { error: cardError } = await supabaseAdmin.from("cards").insert({
    id: cardId,
    topic_id: publishedTopicOrderTwoId,
    front_content: { word: "protected" },
    back_content: { translation: "protected" },
    order_index: 1,
    removed_at: null,
  });
  throwFixtureError("Không thể tạo card fixture", cardError);

  const exerciseId = randomUUID();
  createdExerciseIds.add(exerciseId);
  const { error: exerciseError } = await supabaseAdmin.from("exercises").insert({
    id: exerciseId,
    course_id: detailCourseId,
    topic_id: publishedTopicOrderTwoId,
    title: "Protected Exercise",
    part_type: "part5",
    order_index: 1,
    removed_at: null,
  });
  throwFixtureError("Không thể tạo exercise fixture", exerciseError);

  const questionId = randomUUID();
  createdQuestionIds.add(questionId);
  const { error: questionError } = await supabaseAdmin.from("questions").insert({
    id: questionId,
    course_id: detailCourseId,
    exercise_id: exerciseId,
    group_id: null,
    content: "Protected question content",
    explanation: "Protected explanation",
    order_index: 1,
    removed_at: null,
  });
  throwFixtureError("Không thể tạo question fixture", questionError);

  const { error: enrollmentError } = await supabaseAdmin.from("enrollments").insert([
    { user_id: SEEDED_ADMIN_ID, course_id: detailCourseId },
    { user_id: SEEDED_STUDENT_ID, course_id: detailCourseId },
  ]);
  throwFixtureError("Không thể tạo enrollment fixtures", enrollmentError);

  return {
    detailCourseId,
    secondPublishedCourseId,
    ownerlessCourseId,
    detailSlug,
    ownerlessSlug,
    draftSlug,
    pendingSlug,
    removedSlug,
    emptyChapterId,
    contentChapterId,
    removedChapterId,
    publishedTopicIdsInOrder: [
      publishedTopicOrderTwoId,
      publishedTopicOrderFourId,
    ],
    hiddenTopicIds: [
      draftTopicId,
      pendingTopicId,
      removedTopicId,
      removedChapterTopicId,
    ],
    cardId,
    exerciseId,
    questionId,
    previewerUserId,
    softDeletedOwnerUserId,
    collaboratorUserIdsInOrder,
  };
}

async function deleteRows(
  table: string,
  column: string,
  values: string[],
  label: string,
) {
  if (values.length === 0) return;
  const { error } = await supabaseAdmin.from(table).delete().in(column, values);
  throwFixtureError(label, error);
}

async function cleanupCreatedData() {
  const courseIds = Array.from(createdCourseIds);
  await deleteRows(
    "questions",
    "id",
    Array.from(createdQuestionIds),
    "Không thể cleanup questions",
  );
  await deleteRows(
    "exercises",
    "id",
    Array.from(createdExerciseIds),
    "Không thể cleanup exercises",
  );
  await deleteRows(
    "cards",
    "id",
    Array.from(createdCardIds),
    "Không thể cleanup cards",
  );
  await deleteRows(
    "enrollments",
    "course_id",
    courseIds,
    "Không thể cleanup enrollments",
  );
  await deleteRows(
    "topics",
    "course_id",
    courseIds,
    "Không thể cleanup topics",
  );
  await deleteRows(
    "chapters",
    "course_id",
    courseIds,
    "Không thể cleanup chapters",
  );
  await deleteRows(
    "course_collaborators",
    "course_id",
    courseIds,
    "Không thể cleanup collaborators",
  );
  await deleteRows("courses", "id", courseIds, "Không thể cleanup courses");

  if (createdPreviewerUserId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(
      createdPreviewerUserId,
    );
    throwFixtureError("Không thể cleanup previewer auth user", error);
  }

  if (createdSoftDeletedOwnerUserId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(
      createdSoftDeletedOwnerUserId,
    );
    throwFixtureError("Không thể cleanup soft-deleted owner auth user", error);
  }
}

function queryLocalDatabase<T>(sql: string) {
  const cliEntry = resolve(
    process.cwd(),
    "node_modules",
    "supabase",
    "dist",
    "supabase.js",
  );
  const output = execFileSync(
    process.execPath,
    [cliEntry, "db", "query", "--local", "--output", "json", sql],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  return (JSON.parse(output) as { rows: T[] }).rows;
}

function collectObjectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectKeys(item, keys));
    return keys;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nestedValue]) => {
      keys.add(key);
      collectObjectKeys(nestedValue, keys);
    });
  }

  return keys;
}

async function getDetail(client: SupabaseClient, slug: string) {
  const { data, error } = await client.rpc("get_public_course_detail", {
    p_course_slug: slug,
  });
  expect(error).toBeNull();
  return data as PublicDetail | null;
}

describe.sequential("public course read model RPC and RLS boundary", () => {
  beforeAll(async () => {
    assertSafeIntegrationEnv();
    anonymousClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    studentClient = await signInStudent();
    fixture = await createFixtures();
  });

  afterAll(async () => {
    await studentClient?.auth.signOut();
    await cleanupCreatedData();
  });

  it("allows anon and authenticated clients to read the filtered catalog in deterministic order", async () => {
    for (const client of [anonymousClient, studentClient]) {
      const { data, error } = await client.rpc("get_public_course_catalog");
      expect(error).toBeNull();

      const fixtureRows = (data as CatalogRow[]).filter((row) =>
        createdCourseIds.has(row.id),
      );
      const expectedIds = [
        fixture.detailCourseId,
        fixture.secondPublishedCourseId,
      ].sort((left, right) => left.localeCompare(right));
      expectedIds.push(fixture.ownerlessCourseId);

      expect(fixtureRows.map((row) => row.id)).toEqual(expectedIds);
      expect(
        fixtureRows.every((row) =>
          [
            fixture.detailCourseId,
            fixture.secondPublishedCourseId,
            fixture.ownerlessCourseId,
          ].includes(row.id),
        ),
      ).toBe(true);

      const detailRow = fixtureRows.find(
        (row) => row.id === fixture.detailCourseId,
      );
      expect(Object.keys(detailRow ?? {}).sort()).toEqual([
        "created_at",
        "enrollment_count",
        "id",
        "price",
        "slug",
        "thumbnail_url",
        "title",
      ]);
      expect(Number(detailRow?.price)).toBe(0);
      expect(Number(detailRow?.enrollment_count)).toBe(2);
    }
  });

  it("returns public detail to anon and authenticated clients and null for hidden course states", async () => {
    const anonDetail = await getDetail(anonymousClient, fixture.detailSlug);
    const authenticatedDetail = await getDetail(studentClient, fixture.detailSlug);

    expect(anonDetail?.id).toBe(fixture.detailCourseId);
    expect(authenticatedDetail).toEqual(anonDetail);
    expect(Number(anonDetail?.price)).toBe(0);
    expect(Number(anonDetail?.enrollment_count)).toBe(2);

    await expect(
      getDetail(anonymousClient, `unknown-${randomUUID()}`),
    ).resolves.toBeNull();
    await expect(getDetail(anonymousClient, fixture.draftSlug)).resolves.toBeNull();
    await expect(
      getDetail(anonymousClient, fixture.pendingSlug),
    ).resolves.toBeNull();
    await expect(getDetail(anonymousClient, fixture.removedSlug)).resolves.toBeNull();
  });

  it("returns owner separately and only eligible collaborators in stable public presentation order", async () => {
    const detail = await getDetail(anonymousClient, fixture.detailSlug);

    expect(detail?.owner?.id).toBe(SEEDED_ADMIN_ID);
    expect(detail?.collaborators.map((collaborator) => collaborator.id)).toEqual(
      fixture.collaboratorUserIdsInOrder,
    );
    expect(
      detail?.collaborators.some(
        (collaborator) => collaborator.id === fixture.previewerUserId,
      ),
    ).toBe(false);

    const expectedPresentationKeys = [
      "avatar_url",
      "bio",
      "certifications",
      "experience_years",
      "full_name",
      "id",
    ];
    expect(Object.keys(detail?.owner ?? {}).sort()).toEqual(
      expectedPresentationKeys,
    );
    detail?.collaborators.forEach((collaborator) => {
      expect(Object.keys(collaborator).sort()).toEqual(expectedPresentationKeys);
    });
  });

  it("keeps public catalog/detail valid without a public owner or collaborators", async () => {
    for (const client of [anonymousClient, studentClient]) {
      const { data: catalog, error } = await client.rpc(
        "get_public_course_catalog",
      );
      expect(error).toBeNull();
      expect(
        (catalog as CatalogRow[]).some(
          (course) => course.id === fixture.ownerlessCourseId,
        ),
      ).toBe(true);

      const detail = await getDetail(client, fixture.ownerlessSlug);
      expect(detail?.id).toBe(fixture.ownerlessCourseId);
      expect(detail?.owner).toBeNull();
      expect(detail?.collaborators).toEqual([]);
      expect(JSON.stringify(detail)).not.toContain(
        fixture.softDeletedOwnerUserId,
      );
    }
  });

  it("keeps empty chapters and exposes only published active topics in syllabus order", async () => {
    const detail = await getDetail(anonymousClient, fixture.detailSlug);

    expect(detail?.syllabus.map((chapter) => chapter.id)).toEqual([
      fixture.emptyChapterId,
      fixture.contentChapterId,
    ]);
    expect(
      detail?.syllabus.some((chapter) => chapter.id === fixture.removedChapterId),
    ).toBe(false);
    expect(detail?.syllabus[0].topics).toEqual([]);
    expect(detail?.syllabus[1].topics.map((topic) => topic.id)).toEqual(
      fixture.publishedTopicIdsInOrder,
    );
    detail?.syllabus.forEach((chapter) => {
      expect(Object.keys(chapter).sort()).toEqual([
        "id",
        "order_index",
        "title",
        "topics",
      ]);
      chapter.topics.forEach((topic) => {
        expect(Object.keys(topic).sort()).toEqual([
          "id",
          "order_index",
          "slug",
          "title",
        ]);
      });
    });

    const returnedTopicIds = new Set(
      detail?.syllabus.flatMap((chapter) =>
        chapter.topics.map((topic) => topic.id),
      ),
    );
    fixture.hiddenTopicIds.forEach((topicId) => {
      expect(returnedTopicIds.has(topicId)).toBe(false);
    });
  });

  it("rejects duplicate active chapter and topic order indexes", async () => {
    const { error: chapterError } = await supabaseAdmin.from("chapters").insert({
      id: randomUUID(),
      course_id: fixture.detailCourseId,
      title: "Invalid Duplicate Chapter Order",
      order_index: 1,
      removed_at: null,
    });
    expect(chapterError?.code).toBe("23505");

    const { error: topicError } = await supabaseAdmin.from("topics").insert({
      id: randomUUID(),
      course_id: fixture.detailCourseId,
      chapter_id: fixture.contentChapterId,
      title: "Invalid Duplicate Topic Order",
      slug: `invalid-duplicate-topic-${randomUUID()}`,
      status: "published",
      order_index: 2,
      removed_at: null,
    });
    expect(topicError?.code).toBe("23505");
  });

  it("does not expose enrollment identities, instructor internals, or protected content fields", async () => {
    const detail = await getDetail(anonymousClient, fixture.detailSlug);
    const keys = collectObjectKeys(detail);

    expect(Object.keys(detail ?? {}).sort()).toEqual([
      "collaborators",
      "created_at",
      "description",
      "enrollment_count",
      "id",
      "owner",
      "price",
      "slug",
      "syllabus",
      "thumbnail_url",
      "title",
    ]);

    [
      "user_id",
      "enrolled_at",
      "email",
      "phone",
      "role",
      "added_by",
      "front_content",
      "back_content",
      "part_type",
      "content",
      "explanation",
      "is_correct",
      "removed_at",
      "status",
    ].forEach((forbiddenKey) => {
      expect(keys.has(forbiddenKey)).toBe(false);
    });
  });

  it("keeps direct anon reads denied for syllabus, enrollment, and protected content tables", async () => {
    const directReads = [
      anonymousClient
        .from("chapters")
        .select("*")
        .eq("course_id", fixture.detailCourseId),
      anonymousClient
        .from("topics")
        .select("*")
        .eq("course_id", fixture.detailCourseId),
      anonymousClient
        .from("enrollments")
        .select("*")
        .eq("course_id", fixture.detailCourseId),
      anonymousClient.from("cards").select("*").eq("id", fixture.cardId),
      anonymousClient
        .from("exercises")
        .select("*")
        .eq("id", fixture.exerciseId),
      anonymousClient
        .from("questions")
        .select("*")
        .eq("id", fixture.questionId),
    ];

    for (const read of directReads) {
      const { data, error } = await read;
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("creates the enrollment aggregate index with course_id as the leading column", () => {
    const sql = `
      select indexname, indexdef
      from pg_catalog.pg_indexes
      where schemaname = 'public'
        and tablename = 'enrollments'
        and indexname = 'idx_enrollments_course_id'
        and indexdef like '%(course_id)%';
    `;
    const rows = queryLocalDatabase<{ indexname: string; indexdef: string }>(sql);

    expect(rows).toHaveLength(1);
    expect(rows[0].indexname).toBe("idx_enrollments_course_id");
    expect(rows[0].indexdef).toContain("(course_id)");
  });

  it("keeps public RPC security metadata and execution ACLs restricted", () => {
    const rows = queryLocalDatabase<{
      function_name: string;
      volatility: string;
      security_definer: boolean;
      function_config: string;
      public_execute: boolean;
      execute_roles: string[];
    }>(`
      select
        p.proname as function_name,
        p.provolatile::text as volatility,
        p.prosecdef as security_definer,
        p.proconfig::text as function_config,
        exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
          ) as acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        ) as public_execute,
        coalesce((
          select json_agg(roles.rolname order by roles.rolname)
          from pg_catalog.aclexplode(
            coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
          ) as acl
          join pg_catalog.pg_roles as roles on roles.oid = acl.grantee
          where acl.privilege_type = 'EXECUTE'
            and acl.grantee <> p.proowner
        ), '[]'::json) as execute_roles
      from pg_catalog.pg_proc as p
      join pg_catalog.pg_namespace as namespaces
        on namespaces.oid = p.pronamespace
      where namespaces.nspname = 'public'
        and p.proname in (
          'get_public_course_catalog',
          'get_public_course_detail'
        )
      order by p.proname;
    `);

    expect(rows.map((row) => row.function_name)).toEqual([
      "get_public_course_catalog",
      "get_public_course_detail",
    ]);
    rows.forEach((row) => {
      expect(row.volatility).toBe("s");
      expect(row.security_definer).toBe(true);
      expect(row.function_config).toContain('search_path=\\"\\"');
      expect(row.public_execute).toBe(false);
      expect(row.execute_roles).toEqual([
        "anon",
        "authenticated",
        "service_role",
      ]);
    });
  });
});
