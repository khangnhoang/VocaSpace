import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCollaborator,
  createCourse,
  getCoursesForTeacher,
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
// - Mục tiêu: kiểm tra action course authoring không mất rejection metadata và không còn collaborator success giả.
// - Loại test: action/unit với Supabase mock.
// - Đối tượng: createCourse, getCoursesForTeacher, addCollaborator.
// - Case thành công: teacher course list trả reject_message/reviewed_at từ nested course query.
// - Case thất bại: createCourse chặn payload sai trước mutation; teacher course query shape sai trả safe error; collaborator action chặn payload sai và trả unavailable error cho payload hợp lệ.
// - Bảo mật/phân quyền: payload sai bị chặn trước auth/DB; payload hợp lệ vẫn yêu cầu user đã đăng nhập trước unavailable boundary.
// - Ổn định/resilience: action không được chứa success path nếu chưa có persistence.
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
  };
}

function createCourseMutationClient() {
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
      })),
    },
    rpc: vi.fn(),
  };
}

describe("course authoring actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("does not report collaborator success when persistence is unavailable", async () => {
    const client = createAuthenticatedClient();
    mockCreateClient(client);

    const result = await addCollaborator(
      courseId,
      "member@example.com",
      "editor",
    );

    expect(result).toEqual({
      error:
        "Tính năng cộng tác viên chưa được hỗ trợ. Chưa có lời mời hoặc quyền truy cập nào được tạo.",
    });
    expect("success" in result).toBe(false);
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
});
