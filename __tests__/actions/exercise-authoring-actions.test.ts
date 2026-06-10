import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExercise,
  deleteExercise,
  updateQuestion,
} from "@/app/actions/exercise";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

let rpcResult: RpcResult = { data: null, error: null };
const tableCalls: string[] = [];

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn(async () => rpcResult),
  from: vi.fn((table: string) => {
    tableCalls.push(table);

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn(async (): Promise<QueryResult> => ({
        data: { course_id: "course-1", role: "teacher" },
        error: null,
      })),
      then: vi.fn((onFulfilled) =>
        Promise.resolve({ data: [], error: null }).then(onFulfilled),
      ),
    };

    return chain;
  }),
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

const validCreatePayload = {
  title: "Valid Exercise Title",
  part_type: "part7",
  groups: [
    {
      passage_text: "Reading passage",
      questions: [
        {
          content: "What is correct?",
          options: [
            { content: "Correct", is_correct: true },
            { content: "Wrong", is_correct: false },
          ],
        },
      ],
    },
  ],
};

describe("exercise authoring server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableCalls.length = 0;
    rpcResult = { data: { ok: true }, error: null };
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "teacher-1" } },
      error: null,
    });
  });

  describe("createExercise", () => {
    it("rejects unauthenticated users", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("No user"),
      });

      const result = await createExercise("topic-1", validCreatePayload);

      expect(result.error).toContain("Phiên đăng nhập đã hết hạn");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("normalizes invalid payloads before validation", async () => {
      const result = await createExercise("topic-1", {
        title: "Valid Exercise Title",
        part_type: "part5",
        questions: [
          {
            content: "   ",
            options: [
              { content: "A", is_correct: true },
              { content: "B", is_correct: false },
            ],
          },
        ],
      });

      expect(result.error).toContain("Cấu trúc dữ liệu lỗi");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("maps known create RPC errors to Vietnamese messages", async () => {
      rpcResult = { data: null, error: { message: "TOPIC_REMOVED" } };

      const result = await createExercise("topic-1", validCreatePayload);

      expect(result.error).toContain("chủ đề đã bị xóa");
    });
  });

  describe("deleteExercise", () => {
    it("rejects unauthenticated users", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await deleteExercise("exercise-1");

      expect(result.error).toContain("Vui lòng đăng nhập");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("calls soft_delete_exercise_cascade without direct child-table updates", async () => {
      const result = await deleteExercise("exercise-1");

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "soft_delete_exercise_cascade",
        { p_exercise_id: "exercise-1" },
      );
      expect(tableCalls).not.toContain("question_options");
      expect(tableCalls).not.toContain("questions");
      expect(tableCalls).not.toContain("question_groups");
      expect(tableCalls).not.toContain("exercises");
    });

    it("maps known delete RPC errors to Vietnamese messages", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      rpcResult = { data: null, error: { message: "COURSE_EDIT_FORBIDDEN" } };

      const result = await deleteExercise("exercise-1");

      expect(result.error).toContain("không có quyền chỉnh sửa");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("maps unknown delete RPC errors to a generic Vietnamese message", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      rpcResult = {
        data: null,
        error: {
          message:
            'new row violates row-level security policy for table "question_options"',
        },
      };

      const result = await deleteExercise("exercise-1");

      expect(result.error).toBe(
        "Không thể xóa bài tập. Vui lòng tải lại trang và thử lại.",
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("updateQuestion", () => {
    it("rejects empty content", async () => {
      const result = await updateQuestion("question-1", "   ", null, [
        { content: "A", is_correct: true },
        { content: "B", is_correct: false },
      ]);

      expect(result.error).toContain("Nội dung câu hỏi không được để trống");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("rejects fewer than 2 valid options", async () => {
      const result = await updateQuestion("question-1", "Question?", null, [
        { content: "A", is_correct: true },
        { content: "   ", is_correct: false },
      ]);

      expect(result.error).toContain("ít nhất 2 đáp án");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("rejects when no valid option is correct", async () => {
      const result = await updateQuestion("question-1", "Question?", null, [
        { content: "A", is_correct: false },
        { content: "B", is_correct: false },
      ]);

      expect(result.error).toContain("ít nhất 1 đáp án đúng");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it("calls sync_question_with_options with the final cleaned option list", async () => {
      const result = await updateQuestion("question-1", " Question? ", " Note ", [
        { id: "opt-1", content: " A ", is_correct: true },
        { id: "opt-2", content: "   ", is_correct: false },
        { content: " C ", is_correct: false },
      ]);

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "sync_question_with_options",
        {
          p_question_id: "question-1",
          p_content: " Question? ",
          p_explanation: " Note ",
          p_options: [
            { id: "opt-1", content: "A", is_correct: true },
            { id: undefined, content: "C", is_correct: false },
          ],
        },
      );
    });

    it("maps known sync RPC errors to Vietnamese messages", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      rpcResult = {
        data: null,
        error: { message: "QUESTION_REQUIRES_TWO_OPTIONS" },
      };

      const result = await updateQuestion("question-1", "Question?", null, [
        { content: "A", is_correct: true },
        { content: "B", is_correct: false },
      ]);

      expect(result.error).toContain("ít nhất 2 đáp án hợp lệ");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
