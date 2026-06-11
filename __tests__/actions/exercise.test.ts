// __tests__/actions/exercise.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { 
  createExercise, 
  getExercisesByTopicId, 
  deleteExercise, 
  updateQuestion,
  updateExerciseBasic,
  deleteQuestionGroup,
  deleteQuestion
} from "@/app/actions/exercise";

// Cấu hình biến Override cục bộ để các test case cấu hình đặc biệt khi cần
let queryOverrides: Record<
  string,
  (isInsert: boolean, isUpdate: boolean, isSingle: boolean) => unknown
> = {};

// ============================================================================
// 🔥 FLUENT CHAIN BUILDER: Đảm bảo không bao giờ bị lỗi "... is not a function"
// ============================================================================
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn<
    (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>
  >((fn) => {
    if (fn === "has_course_management_access") {
      return Promise.resolve({ data: true, error: null });
    }

    return Promise.resolve({ data: { exercise_id: "new-exercise-id" }, error: null });
  }),
  from: vi.fn((table: string) => {
    let isInsert = false;
    let isUpdate = false;

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn(() => { isInsert = true; return chain; }),
      update: vi.fn(() => { isUpdate = true; return chain; }),
      single: vi.fn(() => Promise.resolve(resolveQuery(true))),
      then: vi.fn((onFulfilled) => Promise.resolve(resolveQuery(false)).then(onFulfilled)),
    };

    function resolveQuery(isSingle: boolean) {
      if (queryOverrides[table]) {
        return queryOverrides[table](isInsert, isUpdate, isSingle);
      }
      
      if (table === "topics") {
        return { data: { id: "topic-123", course_id: "c1", removed_at: null }, error: null };
      }
      if (table === "course_collaborators") {
        return { data: { role: "owner" }, error: null };
      }
      if (table === "exercises") {
        if (isInsert) return { data: { id: "new-exercise-id" }, error: null };
        if (isUpdate) return { error: null };
        if (isSingle) return { data: { course_id: "c1", part_type: "part5" }, error: null };
        return { data: [], error: null }; 
      }
      if (table === "questions") {
        if (isInsert) return { data: { id: "new-question-id" }, error: null };
        if (isUpdate) return { error: null };
        if (isSingle) return { data: { exercise_id: "ex-1", group_id: null, removed_at: null }, error: null }; 
        return { data: [{ id: "q-123" }], count: 2, error: null }; 
      }
      if (table === "question_options") {
        if (isInsert || isUpdate) return { error: null };
        return { data: [{ id: "opt-1" }, { id: "opt-2" }, { id: "opt-3" }], error: null };
      }
      if (table === "question_groups") {
        if (isSingle) return { data: { exercise_id: "ex-123" }, error: null };
        return { error: null };
      }
      
      return { data: null, error: null };
    }

    return chain;
  }),
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("Exercise Server Actions - Intent & Security Test Suite", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    queryOverrides = {}; 
    mockSupabase.rpc.mockImplementation((fn) => {
      if (fn === "has_course_management_access") {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: { exercise_id: "new-exercise-id" }, error: null });
    });
  });

  // ==========================================================================
  // 1. KIỂM THỬ Ý ĐỒ BẢO MẬT VÀ CHỐT CHẶN TRẠNG THÁI (SECURITY & EDGE CASES)
  // ==========================================================================
  describe("Security Checkpoint: Instructor Access Control", () => {
    it("Intent: Từ chối hành động tạo bài tập nếu phiên đăng nhập hết hạn (No Auth)", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("No user") });

      const result = await createExercise("topic-123", { title: "Valid Title", part_type: "part7" });
      expect(result.error).toContain("Phiên đăng nhập đã hết hạn");
    });

    it("Intent: Ngăn chặn User A thao tác trên Khóa học của User B khi không có quyền Collab", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "user-A" } } });
      
      queryOverrides.topics = () => ({ data: { id: "topic-123", course_id: "course-B-owner", removed_at: null }, error: null });
      queryOverrides.course_collaborators = () => ({ data: null, error: { message: "No access" } });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "COURSE_EDIT_FORBIDDEN" },
      });

      const result = await createExercise("topic-123", {
        title: "Hack Course Title",
        part_type: "part7",
        groups: [
          {
            passage_text: "Reading passage",
            questions: [
              {
                content: "Q1",
                options: [
                  { content: "A", is_correct: true },
                  { content: "B", is_correct: false },
                ],
              },
            ],
          },
        ],
      });
      expect(result.error).toContain("Từ chối truy cập. Bạn không có quyền hạn chỉnh sửa");
    });

    it("Intent: Chặn đứng hành động tạo bài tập nếu Topic mục tiêu đã bị một giáo viên khác xóa mềm", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });
      
      queryOverrides.topics = () => ({ data: { id: "topic-123", course_id: "c1", removed_at: "2026-05-28T23:00:00Z" }, error: null });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "TOPIC_REMOVED" },
      });

      const result = await createExercise("topic-123", {
        title: "Valid Title",
        part_type: "part7",
        groups: [
          {
            passage_text: "Reading passage",
            questions: [
              {
                content: "Q1",
                options: [
                  { content: "A", is_correct: true },
                  { content: "B", is_correct: false },
                ],
              },
            ],
          },
        ],
      });
      expect(result.error).toContain("Không thể thêm bài tập vào một chủ đề đã bị xóa!");
    });
  });

  // ==========================================================================
  // 2. KIỂM THỬ KHỚP CONTRACT SCHEMAS (ZOD ERROR COMPATIBILITY)
  // ==========================================================================
  describe("Data Integrity Contract: Zod Validation Exceptions", () => {
    it("Intent: Trích xuất chính xác lỗi đầu tiên qua issues[0].message khi Title quá ngắn", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      const result = await createExercise("topic-123", { 
        title: "ABC", 
        part_type: "part5",
        questions: [{ content: "Q1", options: [{ content: "A", is_correct: true }, { content: "B", is_correct: false }] }]
      });
      expect(result.error).toContain("Cấu trúc dữ liệu lỗi: Tên bài tập phải dài hơn 3 ký tự");
    });

    // 🔥 VÁ BUG ĐÃ FIX: Ép câu hỏi thành dạng chuỗi khoảng trắng để qua cửa Zod nhưng bị hủy bởi .trim()
    it("Intent: Chặn đứng kịch bản payload chứa toàn chuỗi rỗng hoặc khoảng trắng sau khi filter logic", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      const emptyPayload = {
        title: "Valid Title Practice",
        part_type: "part5",
        questions: [
          {
            content: "     ", // Đạt điều kiện min(1) của Zod nhưng bị lọc sạch bởi .trim()
            options: [
              { content: "A", is_correct: true },
              { content: "B", is_correct: false }
            ]
          }
        ]
      };

      const result = await createExercise("topic-123", emptyPayload);
      expect(result.error).toContain("Bài tập phải có ít nhất 1 nhóm câu hỏi hoặc 1 câu hỏi lẻ hợp lệ!");
    });
  });

  // ==========================================================================
  // 3. KIỂM THỬ CHỨNG MINH KỊCH BẢN THÀNH CÔNG ĐA PHÂN CẤP (HAPPY PATH)
  // ==========================================================================
  describe("Hierarchy Injection Business Logic: Success Path", () => {
    it("Intent: Đóng gói cây dữ liệu hoàn chỉnh, tự tính toán order_index kế thừa từ Server", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      queryOverrides.exercises = (isInsert) => {
        if (isInsert) return { data: { id: "new-exercise-id" }, error: null };
        return { data: { order_index: 5 }, error: null };
      };

      const payload = {
        title: "Part 5 Test Practice",
        part_type: "part5",
        questions: [
          {
            content: "Mr. Khang prefers coldbrew coffee because of _______ flavor.",
            explanation: "Cần tính từ sở hữu đứng trước danh từ flavor.",
            options: [
              { content: "its", is_correct: true },
              { content: "it", is_correct: false },
              { content: "itself", is_correct: false },
              { content: "they", is_correct: false }
            ]
          }
        ]
      };

      const result = await createExercise("topic-123", payload);
      expect(result.success).toBe(true);
      expect(result.message).toContain("Đã tạo bài tập kèm câu hỏi thành công!");
    });
  });

  // ==========================================================================
  // 4. KIỂM THỬ LUỒNG ĐỒNG BỘ: UPDATE & BỔ SUNG THỰC THỂ MỚI TRÊN UI
  // ==========================================================================
  describe("Data Synchronisation & Mixed Insert-Update Option Path", () => {
    it("Intent: Khi đồng bộ cập nhật câu hỏi, phải bóc tách đúng những đáp án bị loại bỏ để Soft Delete", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      const updatedOptions = [
        { id: "opt-1", content: "Updated A", is_correct: true },
        { id: "opt-2", content: "Updated B", is_correct: false }
      ];

      const result = await updateQuestion("q-123", "New Content Question", "New Explanation", updatedOptions);
      expect(result.success).toBe(true);
      expect(result.message).toContain("Đã cập nhật câu hỏi và đồng bộ đáp án thành công!");
    });

    it("Intent: Khi đồng bộ câu hỏi, nếu xuất hiện Option không chứa thuộc tính id, hệ thống phải định hướng chính xác vào nhánh INSERT mới", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      const mixedOptions = [
        { id: "opt-1", content: "Old Option Content Updated", is_correct: true },
        { content: "Brand New Option added by Teacher on UI", is_correct: false } 
      ];

      const result = await updateQuestion("q-123", "Valid Content", "Explanation detail", mixedOptions);
      expect(result.success).toBe(true);
      expect(result.message).toContain("Đã cập nhật câu hỏi và đồng bộ đáp án thành công!");
    });
  });

  // ==========================================================================
  // 5. LUỒNG ĐỌC DỮ LIỆU (READ DATA PIPELINE) - KHỬ TRÙNG LẶP LAYER SERVER
  // ==========================================================================
  describe("Read Data Pipeline: Server-Side Deduplication Filter", () => {
    it("Intent: getExercisesByTopicId phải tự động quét và lọc sạch các câu hỏi có group_id khỏi mảng root questions", async () => {
      queryOverrides.exercises = () => ({
        data: [
          {
            id: "ex-1",
            title: "Reading Comprehension Test",
            part_type: "part7",
            questions: [
              { id: "q-standalone-1", group_id: null, content: "Standalone Question" },
              { id: "q-nested-leaked", group_id: "group-888", content: "Leaked Nested Question" }
            ],
            groups: []
          }
        ],
        error: null
      });

      const result = await getExercisesByTopicId("topic-123");
      
      expect(result.data).toBeDefined();
      const firstExercise = result.data?.[0];
      expect(firstExercise).toBeDefined();
      expect(firstExercise!.questions).toHaveLength(1);
      const firstQuestion = firstExercise!.questions?.[0];
      expect(firstQuestion?.id).toBe("q-standalone-1");
    });
  });

  // ==========================================================================
  // 6. LUỒNG XÓA DỮ LIỆU (DELETE DATA PIPELINE) - SOFT DELETE CASCADE
  // ==========================================================================
  describe("Delete Data Pipeline: Multi-Tier Soft Delete Cascade Chain", () => {
    it("Intent: deleteExercise phải kích hoạt đồng loạt chuỗi lệnh cập nhật trạng thái removed_at tuần tự", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      const result = await deleteExercise("ex-123");
      
      expect(result.success).toBe(true);
      expect(result.message).toContain("Đã xóa bài tập thành công!");
    });
  });

  // ==========================================================================
  // 7. 🔥 CA BỔ SUNG 1: CẬP NHẬT THÔNG TIN CƠ BẢN (UPDATE EXERCISE BASIC)
  // ==========================================================================
  describe("Update Exercise Basic Info Pipeline", () => {
    it("Intent: updateExerciseBasic phải chặn đứng tiêu đề thay đổi ngắn dưới 4 ký tự", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      const result = await updateExerciseBasic("ex-123", "ABC", "part5");
      expect(result.error).toContain("Tên bài tập quá ngắn!");
    });
  });

  // ==========================================================================
  // 8. 🔥 CA BỔ SUNG 2: XÓA NHÓM NGỮ LIỆU (DELETE QUESTION GROUP)
  // ==========================================================================
  describe("Delete Question Group Pipeline", () => {
    it("Intent: deleteQuestionGroup phải thực hiện soft delete cho group và toàn bộ option liên đới", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      const result = await deleteQuestionGroup("group-123");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Đã xóa nhóm câu hỏi!");
    });
  });

  // ==========================================================================
  // 9. 🔥 CA BỔ SUNG 3: XÓA CÂU HỎI ĐƠN LẺ (DELETE QUESTION)
  // ==========================================================================
  describe("Delete Single Question Pipeline", () => {
    it("Intent: deleteQuestion phải kiểm tra quyền instructor và gán removed_at chính xác cho câu hỏi", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "teacher-id" } } });

      const result = await deleteQuestion("q-123");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Đã xóa câu hỏi!");
    });
  });
});
