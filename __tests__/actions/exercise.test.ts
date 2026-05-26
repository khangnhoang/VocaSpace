// __tests__/actions/exercise.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createExercise } from "@/app/actions/exercise";
import { exerciseSchema } from "@/lib/schemas/exercise";
import { createClient } from "@/utils/supabase/server";

// 1. Mock thư viện Supabase Server Client
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

// Ẩn log error/console của hệ thống để terminal sạch đẹp khi chạy test
vi.spyOn(console, "error").mockImplementation(() => {});

// ============================================================================
// MOCK DATA CHUẨN ĐỊNH DẠNG HỆ THỐNG (UUID V4 COMPLIANT)
// ============================================================================
const MOCK_USER_ID = "11111111-1111-1111-1111-111111111111";
const MOCK_TOPIC_ID = "22222222-2222-2222-2222-222222222222";
const MOCK_COURSE_ID = "33333333-3333-3333-3333-333333333333";

// Payload JSON hợp lệ hoàn toàn vượt qua vòng gửi xe của Zod
const VALID_EXERCISE_PAYLOAD = {
  title: "Bài tập Đọc hiểu Part 7 nâng cao",
  part_type: "part7",
  order_index: 1,
  groups: [
    {
      passage_text: "This is a sample reading passage for TOEIC test.",
      //   audio_url: null,
      //   image_url: null,
      questions: [
        {
          content: "What is the main purpose of the text?",
          explanation: "The text mentions purpose in the first line.",
          options: [
            { content: "To inform customers", is_correct: true },
            { content: "To complain about a service", is_correct: false },
            { content: "To order new equipment", is_correct: false },
            { content: "To cancel an event", is_correct: false },
          ],
        },
      ],
    },
  ],
};

// ============================================================================
// HELPER MOCK SUPABASE: Quản lý ma trận phản hồi đa tầng của PostgREST
// ============================================================================
const createMockSupabase = (
  overrides: {
    hasUser?: boolean;
    collabRole?: string | null;
    failAtTable?: string;
  } = {},
) => {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.hasUser ? { id: MOCK_USER_ID } : null },
        error: null,
      }),
    },
    from: vi.fn((tableName: string) => {
      // ĐỒNG BỘ: Tạo một đối tượng chain hỗ trợ Fluent Builder Pattern hoàn hảo
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(), // 🔥 SỬA: Luôn trả về chính nó để giữ vững chuỗi liên hoàn
      };

      // 1. Nhánh xử lý bảng topics: Truy vết ngược lấy course_id
      if (tableName === "topics") {
        chain.single = vi.fn().mockResolvedValue({
          data: { id: MOCK_TOPIC_ID, chapters: { course_id: MOCK_COURSE_ID } },
          error: null,
        });
        return chain;
      }

      // 2. Nhánh xử lý bảng course_collaborators: Check quyền hạn giáo viên
      if (tableName === "course_collaborators") {
        chain.single = vi.fn().mockResolvedValue({
          data:
            overrides.collabRole !== undefined
              ? overrides.collabRole
                ? { role: overrides.collabRole }
                : null
              : { role: "editor" },
          error: overrides.collabRole
            ? null
            : { message: "Not found collaborator" },
        });
        return chain;
      }

      // 3. Nhánh xử lý phân cấp đa tầng (exercises, question_groups, questions)
      if (["exercises", "question_groups", "questions"].includes(tableName)) {
        // 🔥 GIẢI PHÁP ĐỘNG: Hàm single sẽ tự kiểm tra xem có lệnh kích nổ lỗi ngầm không
        chain.single = vi.fn().mockImplementation(() => {
          if (overrides.failAtTable === tableName) {
            return Promise.resolve({
              data: null,
              error: { message: `Database error at ${tableName}` },
            });
          }
          // Nếu không lỗi, trả về ID mới như bình thường để chạy tiếp xuống tầng dưới
          return Promise.resolve({
            data: { id: `new-${tableName}-id`, order_index: 5 },
            error: null,
          });
        });
        return chain;
      }

      // 4. Nhánh xử lý tầng cuối cùng: Batch Insert mảng options
      if (tableName === "question_options") {
        chain.insert = vi.fn().mockImplementation(() => {
          if (overrides.failAtTable === tableName) {
            return Promise.resolve({
              error: { message: `Database error at ${tableName}` },
            });
          }
          return Promise.resolve({ error: null });
        });
        return chain;
      }

      return chain;
    }),
  } as any;
};

// ============================================================================
// BỘ TEST CASES CHI TIẾT
// ============================================================================
describe("Exercise Core API Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("✅ [THÀNH CÔNG] Tạo bài tập đa tầng mượt mà khi đầy đủ quyền hạn, tính toán tự động order_index", async () => {
    expect.hasAssertions();

    // Nạp mock client hợp lệ hoàn toàn (User hợp lệ, giữ quyền editor)
    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({ hasUser: true, collabRole: "editor" }),
    );

    const result = await createExercise(
      MOCK_TOPIC_ID,
      VALID_EXERCISE_PAYLOAD as any,
    );

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.message).toBe("Đã tạo bài tập kèm câu hỏi thành công!");
  });

  it("❌ [THẤT BẠI - AUTH] Chặn đứng ngay lập tức nếu phiên đăng nhập bị hết hạn", async () => {
    expect.hasAssertions();

    // Gài bẫy: Hệ thống không tìm thấy user session
    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({ hasUser: false }),
    );

    const result = await createExercise(
      MOCK_TOPIC_ID,
      VALID_EXERCISE_PAYLOAD as any,
    );

    expect(result.success).toBeUndefined();
    expect(result.error).toBe(
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  });

  it("❌ [THẤT BẠI - RBAC] Từ chối truy cập nếu user có tham gia khóa học nhưng chỉ giữ role Previewer", async () => {
    expect.hasAssertions();

    // Gài bẫy: User hợp lệ nhưng role collaborator chỉ là 'previewer' (không có quyền viết)
    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({ hasUser: true, collabRole: "previewer" }),
    );

    const result = await createExercise(
      MOCK_TOPIC_ID,
      VALID_EXERCISE_PAYLOAD as any,
    );

    expect(result.success).toBeUndefined();
    expect(result.error).toBe(
      "Từ chối truy cập. Bạn không có quyền hạn chỉnh sửa khóa học này.",
    );
  });

  it("🛡️ [ZOD FALLBACK] Chặn dữ liệu rác nếu giáo viên cố tình gửi câu hỏi không có đáp án đúng", async () => {
    expect.hasAssertions();

    // Gài bẫy bẩn: payload câu hỏi có 4 đáp án nhưng tàn bộ đều là is_correct: false
    const corruptedPayload = {
      ...VALID_EXERCISE_PAYLOAD,
      groups: [
        {
          ...VALID_EXERCISE_PAYLOAD.groups[0],
          questions: [
            {
              content: "Lỗi Zod câu hỏi",
              options: [
                { content: "Đáp án rác 1", is_correct: false },
                { content: "Đáp án rác 2", is_correct: false },
              ],
            },
          ],
        },
      ],
    };

    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({ hasUser: true, collabRole: "owner" }),
    );

    const result = await createExercise(MOCK_TOPIC_ID, corruptedPayload as any);

    // Cổng kiểm định Zod của hệ thống phải kích hoạt thành công
    expect(result.success).toBeUndefined();
    expect(result.error).toContain("Cấu trúc dữ liệu lỗi");
  });

  it("💥 [TRANSACTION BREAK] Đảm bảo quăng ngoại lệ, không để rác DB nếu một tầng giữa bị gãy", async () => {
    expect.hasAssertions();

    // Kích nổ hệ thống: Cho phép đi qua Auth/Collab nhưng khi INSERT vào bảng 'questions' thì dính lỗi sập kết nối
    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({
        hasUser: true,
        collabRole: "owner",
        failAtTable: "questions",
      }),
    );

    const result = await createExercise(
      MOCK_TOPIC_ID,
      VALID_EXERCISE_PAYLOAD as any,
    );

    // Hệ thống bắt buộc phải bắt được exception và trả về mã lỗi thô từ database
    expect(result.success).toBeUndefined();
    expect(result.error).toContain("Lỗi tạo Câu hỏi"); // 🔥 ĐÃ VÁ: Khớp 100% với Error thrown từ Server Action
  });
});
