import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCourseDetail } from "@/app/actions/course-detail";
import { courseDetailSchema } from "@/lib/schemas/course-detail";
import { createClient } from "@/utils/supabase/server";

// 1. Mock thư viện gọn gàng
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

// ============================================================================
// MOCK DATA (Tách riêng để giữ test case ngắn gọn)
// ============================================================================
const MOCK_COURSE = {
  id: "course-123",
  title: "Khóa học Test",
  slug: "khoa-hoc-test",
  description: "Mô tả khóa học test",
  thumbnail_url: "https://example.com/thumb.jpg",
  price: 299000,
  course_collaborators: [
    {
      role: "owner",
      profile: {
        id: "teacher-1",
        full_name: "Giảng viên A",
        avatar_url: null,
        teacher_profile: { bio: "Giỏi", experience_years: 5, certifications: "IELTS" }
      }
    }
  ]
};

const MOCK_CHAPTERS = [
  {
    id: "chap-1",
    title: "Chương 1",
    order_index: 1,
    topics: [
      {
        id: "topic-1",
        title: "Bài 1",
        slug: "bai-1",
        status: "published",
        order_index: 1,
        cards: [{ count: 10 }],
        exercises: [{ count: 2 }],
      },
    ],
  },
];

// ============================================================================
// HELPER: TẠO MOCK SUPABASE CLIENT (Chấp nhận 'any' để tối ưu độ dài code)
// ============================================================================
const createMockSupabase = (overrides: any = {}) => {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn((tableName: string) => {
      // Dùng 'any' ở đây là hoàn toàn hợp lý và dễ thở cho Test
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
      };

      if (tableName === "courses") {
        chain.single = vi.fn().mockResolvedValue(overrides.course || { data: MOCK_COURSE, error: null });
      } else if (tableName === "chapters") {
        chain.order = vi.fn().mockResolvedValue(overrides.chapters || { data: MOCK_CHAPTERS, error: null });
      } else if (tableName === "enrollments") {
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.eq = vi.fn().mockResolvedValue({ data: null, count: 150, error: null }); // Mock cho lệnh lấy count
      }

      return chain;
    }),
  } as any;
};

// ============================================================================
// KỊCH BẢN KIỂM THỬ
// ============================================================================
describe("API: getCourseDetail", () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("✅ [THÀNH CÔNG] Map đúng DTO khi course tồn tại", async () => {
    expect.hasAssertions();
    
    // Bơm mock client mặc định (Thành công)
    mockedCreateClient.mockResolvedValueOnce(createMockSupabase());

    const result = await getCourseDetail("khoa-hoc-test");

    expect(result.error).toBeUndefined();
    
    // Chốt chặn 1: Zod Validation
    const parseResult = courseDetailSchema.safeParse(result.data);
    expect(parseResult.success).toBe(true);

    // Chốt chặn 2: Kiểm tra Mapping gom nhóm (Không cần test từng field lắt nhắt)
    expect(result.data).toMatchObject({
      title: "Khóa học Test",
      is_enrolled: false,
      stats: {
        total_chapters: 1,
        total_topics: 1,
        total_cards: 10,
        total_exercises: 2,
        total_enrollments: 150,
      },
      owner: {
        full_name: "Giảng viên A",
        experience_years: 5,
      }
    });
  });

  it("❌ [THẤT BẠI] Trả về lỗi khi DB báo không tìm thấy", async () => {
    expect.hasAssertions();
    
    // Ghi đè mock: Báo lỗi Not found
    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({ course: { data: null, error: { message: "Not found" } } })
    );

    const result = await getCourseDetail("invalid-slug");

    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Không tìm thấy khóa học hoặc khóa học đã bị ẩn.");
  });

  it("🛡️ [ZOD FAIL] Chặn đứng dữ liệu khi DB trả sai kiểu", async () => {
    expect.hasAssertions();
    
    // Ghi đè mock: Cố tình gài giá trị chuỗi vào trường số
    const corruptedCourse = { ...MOCK_COURSE, price: "Miễn phí" }; 
    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({ course: { data: corruptedCourse, error: null } })
    );

    const result = await getCourseDetail("khoa-hoc-test");

    expect(result.data).toBeUndefined();
    expect(result.error).toContain("Dữ liệu hệ thống bị sai lệch cấu trúc");
  });
});