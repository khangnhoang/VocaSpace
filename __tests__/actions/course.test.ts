import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCollaborator,
  createCourse,
  deleteCourse,
  getCoursesForTeacher,
  getTeacherCoursePermissions,
  updateCourse,
} from "@/app/actions/course";
import { createClient } from "@/utils/supabase/server";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const teacherId = "22222222-2222-4222-8222-222222222222";
const courseId = "11111111-1111-4111-8111-111111111111";

// Test plan:
// - Mục tiêu: kiểm tra action course authoring không mất rejection metadata, không còn collaborator success giả, và không báo success khi update/delete không đụng row.
// - Loại test: action/unit với Supabase mock.
// - Đối tượng: createCourse, getCoursesForTeacher, getTeacherCoursePermissions, addCollaborator, deleteCourse, updateCourse.
// - Case thành công: teacher course list trả reject_message/reviewed_at từ nested course query.
// - Case thất bại: createCourse/updateCourse chặn payload sai trước mutation; deleteCourse chặn UUID sai và zero-row update; teacher course query shape sai trả safe error; collaborator invitation action chặn payload sai và chuyển lời mời qua RPC.
// - Bảo mật/phân quyền: payload sai bị chặn trước auth/DB; payload hợp lệ vẫn yêu cầu user đã đăng nhập trước unavailable boundary.
// - Ổn định/resilience: action chỉ báo success khi RPC persistence trả về thành công.
// - Invariant cần giữ: UI không thể nhận success từ collaborator action khi không có dữ liệu được persist.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run`.

function mockCreateClient(client: unknown) {
  mockedCreateClient.mockResolvedValueOnce(
    client as Awaited<ReturnType<typeof createClient>>,
  );
}

function createCourseListClient(rows: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
  };

  query.select.mockImplementation(() => query);
  query.eq.mockImplementation(() => query);
  query.is.mockImplementation(() => query);
  query.order.mockResolvedValue({ data: rows, error: null });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: teacherId, email: "teacher@example.com" } },
        error: null,
      }),
    },
    from: vi.fn(() => query),
  };

  return { client, query };
}

function createAuthenticatedClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: teacherId, email: "teacher@example.com" } },
        error: null,
      }),
    },
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({
      data: { status: "pending", invitation_id: "33333333-3333-4333-8333-333333333333" },
      error: null,
    }),
  };
}

function createAuthenticatedClientWithQueries(queries: unknown[]) {
  const queuedQueries = [...queries];

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: teacherId, email: "teacher@example.com" } },
        error: null,
      }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
        remove: vi.fn(),
      })),
    },
    from: vi.fn(() => {
      const query = queuedQueries.shift();
      if (!query) throw new Error("Unexpected Supabase query");
      return query;
    }),
  };
}

function createCourseMutationClient(options: {
  profileRole?: string;
  uploadResult?: { data: unknown; error: unknown };
  courseResult?: { data: unknown; error: unknown };
} = {}) {
  const profileQuery = createCourseAccessQuery({
    data: { role: options.profileRole ?? "teacher" },
    error: null,
  });
  const upload = vi.fn().mockResolvedValue(
    options.uploadResult ?? { data: { path: "uploaded" }, error: null },
  );
  const getPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: "https://example.test/thumbnail.png" },
  });
  const remove = vi.fn().mockResolvedValue({ data: null, error: null });
  const rpc = vi.fn().mockResolvedValue(
    options.courseResult ?? { data: courseId, error: null },
  );

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: teacherId, email: "teacher@example.com" } },
        error: null,
      }),
    },
    storage: {
      from: vi.fn(() => ({ upload, getPublicUrl, remove })),
    },
    from: vi.fn(() => profileQuery),
    rpc,
    __profileQuery: profileQuery,
    __upload: upload,
    __remove: remove,
  };
}

function createCourseDeleteQuery(result: {
  data: unknown[] | null;
  error: unknown | null;
}) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    select: vi.fn().mockResolvedValue(result),
  };

  return query;
}

function createCourseAccessQuery(result: {
  data: unknown | null;
  error: unknown | null;
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
  };

  return query;
}

function createCourseUpdateQuery(result: {
  data: unknown | null;
  error: unknown | null;
}) {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
  };

  return query;
}

function validCourseFormData() {
  const formData = new FormData();
  formData.set("title", "TOEIC Trust Course");
  formData.set("slug", "toeic-trust-course");
  formData.set("description", "A course with enough detail.");
  formData.set("price", "0");
  return formData;
}

function validCourseFormDataWithThumbnail() {
  const formData = validCourseFormData();
  formData.set(
    "thumbnail_file",
    new File(["thumbnail"], "cover.png", { type: "image/png" }),
  );
  return formData;
}

describe("course authoring actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives course creation permission from the authenticated profile role", async () => {
    const teacherQuery = createCourseAccessQuery({
      data: { role: "teacher" },
      error: null,
    });
    mockCreateClient(createAuthenticatedClientWithQueries([teacherQuery]));

    expect(await getTeacherCoursePermissions()).toEqual({
      data: { canCreateCourse: true },
    });
    expect(teacherQuery.eq).toHaveBeenCalledWith("id", teacherId);

    const adminQuery = createCourseAccessQuery({
      data: { role: "admin" },
      error: null,
    });
    mockCreateClient(createAuthenticatedClientWithQueries([adminQuery]));

    expect(await getTeacherCoursePermissions()).toEqual({
      data: { canCreateCourse: false },
    });
  });

  it("rejects invalid course creation payload before storage or RPC mutation", async () => {
    const client = createCourseMutationClient();
    mockCreateClient(client);

    const formData = new FormData();
    formData.set("title", "     ");
    formData.set("slug", "toeic-trust-course");
    formData.set("description", "          ");
    formData.set("price", "0");

    const result = await createCourse(formData);

    expect(result).toEqual({
      error: "Tên khóa học phải có ít nhất 5 ký tự",
    });
    expect(client.storage.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects non-teacher course creation before uploading a thumbnail", async () => {
    const client = createCourseMutationClient({ profileRole: "admin" });
    mockCreateClient(client);

    const result = await createCourse(validCourseFormDataWithThumbnail());

    expect(result).toEqual({ error: "Bạn không có quyền tạo khóa học." });
    expect(client.__upload).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("cleans up a staged thumbnail when course creation RPC fails", async () => {
    const client = createCourseMutationClient({
      courseResult: {
        data: null,
        error: { code: "COURSE_CREATE_FORBIDDEN", message: "COURSE_CREATE_FORBIDDEN" },
      },
    });
    mockCreateClient(client);

    const result = await createCourse(validCourseFormDataWithThumbnail());
    const uploadedPath = client.__upload.mock.calls[0]?.[0];

    expect(result).toEqual({ error: "Bạn không có quyền tạo khóa học." });
    expect(uploadedPath).toEqual(expect.stringMatching(
      new RegExp(`^create/${teacherId}/[^/]+\\.png$`),
    ));
    expect(client.__remove).toHaveBeenCalledWith([uploadedPath]);
  });

  it("returns rejection metadata for teacher courses", async () => {
    const rows = [
      {
        role: "owner",
        courses: {
          id: courseId,
          title: "TOEIC Trust Course",
          slug: "toeic-trust-course",
          description: "Course requiring revision",
          thumbnail_url: null,
          price: null,
          status: "draft",
          order_index: null,
          reject_message: "Vui lòng bổ sung bài tập cuối khóa.",
          reviewed_at: "2026-06-01T10:00:00.000Z",
        },
      },
    ];
    const { client, query } = createCourseListClient(rows);
    mockCreateClient(client);

    const result = await getCoursesForTeacher();

    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("reject_message"),
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining("reviewed_at"),
    );
    expect(result.data?.[0]).toMatchObject({
      id: courseId,
      price: 0,
      status: "draft",
      order_index: 0,
      my_role: "owner",
      reject_message: "Vui lòng bổ sung bài tập cuối khóa.",
      reviewed_at: "2026-06-01T10:00:00.000Z",
    });
  });

  it("fails loudly when the teacher course query shape is invalid", async () => {
    const { client } = createCourseListClient([
      {
        role: "owner",
        courses: {
          id: "not-a-uuid",
          title: "Broken Course",
        },
      },
    ]);
    mockCreateClient(client);
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    const result = await getCoursesForTeacher();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe(
      "Cấu trúc dữ liệu khóa học không hợp lệ. Vui lòng thử lại.",
    );
  });

  it("routes collaborator invitations through the trusted persistence RPC", async () => {
    const client = createAuthenticatedClient();
    mockCreateClient(client);

    const result = await addCollaborator(
      courseId,
      "member@example.com",
      "editor",
    );

    expect(result).toEqual({
      success: true,
      data: { status: "pending", invitation_id: "33333333-3333-4333-8333-333333333333" },
    });
    expect(client.rpc).toHaveBeenCalledWith("send_course_collaborator_invitation", {
      p_course_id: courseId,
      p_email: "member@example.com",
      p_role: "editor",
      p_can_review_topics: false,
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("validates collaborator payload before auth or database access", async () => {
    const result = await addCollaborator(
      "not-a-course-id",
      "not-an-email",
      "owner",
    );

    expect(result).toEqual({ error: "ID khóa học không hợp lệ." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("rejects invalid course ID before deleting a course", async () => {
    const result = await deleteCourse("not-a-course-id");

    expect(result).toEqual({ error: "ID khóa học không hợp lệ." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("does not report course delete success when no row was updated", async () => {
    const query = createCourseDeleteQuery({ data: [], error: null });
    mockCreateClient(createAuthenticatedClientWithQueries([query]));

    const result = await deleteCourse(courseId);

    expect(result).toEqual({
      error:
        "Không thể đưa khóa học vào thùng rác. Khóa học có thể đã bị ẩn hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(query.update).toHaveBeenCalledWith({
      removed_at: expect.any(String),
    });
    expect(query.eq).toHaveBeenCalledWith("id", courseId);
    expect(query.is).toHaveBeenCalledWith("removed_at", null);
    expect(query.select).toHaveBeenCalledWith("id");
  });

  it("rejects malformed course update payload before auth or database access", async () => {
    const formData = new FormData();
    formData.set("title", "Bad");
    formData.set("slug", "bad slug");
    formData.set("description", "short");
    formData.set("price", "-1");

    const result = await updateCourse(courseId, formData);

    expect(result).toEqual({
      error: "Tên khóa học phải có ít nhất 5 ký tự",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("does not report course update success when no row is returned", async () => {
    const mutationQuery = createCourseUpdateQuery({
      data: null,
      error: {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      },
    });
    const accessQuery = createCourseAccessQuery({
      data: { role: "owner" },
      error: null,
    });

    mockCreateClient(createAuthenticatedClientWithQueries([mutationQuery]));
    mockCreateClient(createAuthenticatedClientWithQueries([accessQuery]));

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementationOnce(() => {});

    const result = await updateCourse(courseId, validCourseFormData());

    expect(result).toEqual({
      error: "Khóa học không còn khả dụng hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(mutationQuery.update).toHaveBeenCalledWith({
      title: "TOEIC Trust Course",
      slug: "toeic-trust-course",
      description: "A course with enough detail.",
      price: 0,
    });
    expect(mutationQuery.eq).toHaveBeenCalledWith("id", courseId);
    expect(mutationQuery.is).toHaveBeenCalledWith("removed_at", null);
    consoleError.mockRestore();
  });

  it("cleans up a replacement thumbnail when course update fails", async () => {
    const mutationQuery = createCourseUpdateQuery({
      data: null,
      error: {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      },
    });
    const upload = vi.fn().mockResolvedValue({ data: { path: "uploaded" }, error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://example.test/replacement.png" },
    });
    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    const mutationClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: teacherId, email: "teacher@example.com" } },
          error: null,
        }),
      },
      storage: {
        from: vi.fn(() => ({ upload, getPublicUrl, remove })),
      },
      from: vi.fn(() => mutationQuery),
    };
    const accessQuery = createCourseAccessQuery({
      data: { role: "owner" },
      error: null,
    });

    mockCreateClient(mutationClient);
    mockCreateClient(createAuthenticatedClientWithQueries([accessQuery]));

    const consoleError = vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const result = await updateCourse(courseId, validCourseFormDataWithThumbnail());
    const uploadedPath = upload.mock.calls[0]?.[0];

    expect(result).toEqual({
      error: "Khóa học không còn khả dụng hoặc bạn không có quyền chỉnh sửa.",
    });
    expect(uploadedPath).toEqual(expect.stringMatching(
      new RegExp(`^course/${courseId}/[^/]+\\.png$`),
    ));
    expect(remove).toHaveBeenCalledWith([uploadedPath]);
    consoleError.mockRestore();
  });
});
