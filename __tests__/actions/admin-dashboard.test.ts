import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminDashboardData } from "@/app/actions/admin-dashboard";
import { adminDashboardSchema } from "@/lib/schemas/admin-dashboard";
import { createClient } from "@/utils/supabase/server";

// 1. Mock thư viện Supabase Server Client
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

// Ẩn log error trong quá trình chạy test để giữ terminal sạch sẽ
vi.spyOn(console, "error").mockImplementation(() => {});

// ============================================================================
// MOCK DATA CHUẨN ĐỊNH DẠNG HỆ THỐNG (UUID V4 COMPLIANT)
// ============================================================================
const VALID_ADMIN_ID = "00000000-0000-0000-0000-000000000000";
const MOCK_COURSE_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const MOCK_ENROLL_ID = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

const MOCK_RAW_COURSES_BUSINESS = [
  {
    id: MOCK_COURSE_ID,
    title: "TOEIC 750+ Cấp tốc",
    price: 500000,
    enrollments: [{ id: "e1" }, { id: "e2" }],
  },
];

const MOCK_RAW_ENROLLMENTS_FEED = [
  {
    id: MOCK_ENROLL_ID,
    enrolled_at: new Date().toISOString(),
    profiles: {
      full_name: "Nguyễn Văn A",
      email: "nva@gmail.com",
      avatar_url: "https://example.com/avatar.jpg",
    },
    courses: {
      title: "TOEIC 750+ Cấp tốc",
      price: 500000,
    },
  },
];

const MOCK_PROFILES_LIST = [
  { role: "student" },
  { role: "student" },
  { role: "teacher" },
  { role: "admin" },
];

// ============================================================================
// HELPER MOCK SUPABASE: Xử lý thông minh luồng Promise.all song song
// ============================================================================
const createMockSupabase = (overrides: any = {}) => {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.hasUser ? { id: VALID_ADMIN_ID } : null },
        error: null,
      }),
    },
    from: vi.fn((tableName: string) => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };

      if (tableName === "profiles") {
        chain.single = vi.fn().mockResolvedValue({
          data: overrides.profileData !== undefined ? overrides.profileData : { role: "admin" },
          error: null,
        });
        chain.then = vi.fn((resolve) => resolve({ data: MOCK_PROFILES_LIST, error: null }));
      }

      if (tableName === "courses") {
        chain.select = vi.fn((queryStr, options) => {
          if (options?.count) {
            chain.then = vi.fn((resolve) => resolve({ data: null, count: 15, error: null }));
          } else {
            // 🔥 FIX: Nạp mã lỗi của overrides vào đây khi kích hoạt bẫy sập DB
            chain.then = vi.fn((resolve) => resolve({ 
              data: overrides.coursesBusinessError ? null : (overrides.coursesData || MOCK_RAW_COURSES_BUSINESS), 
              error: overrides.coursesBusinessError || null 
            }));
          }
          return chain;
        });
      }

      if (tableName === "user_flashcards") {
        chain.then = vi.fn((resolve) => resolve({ data: null, count: 45230, error: null }));
      }

      if (tableName === "enrollments") {
        chain.then = vi.fn((resolve) => resolve({ data: null, count: 5, error: null }));
      }

      return chain;
    }),
  } as any;
};

// ============================================================================
// CÁC KỊCH BẢN KIỂM THỬ TÍNH NĂNG
// ============================================================================
describe("Admin Dashboard Server Action API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("✅ [THÀNH CÔNG] Phải xác thực admin, chạy song song và map đúng định dạng DTO", async () => {
    expect.hasAssertions();
    mockedCreateClient.mockResolvedValueOnce(createMockSupabase({ hasUser: true }));

    const result = await getAdminDashboardData();
    expect(result.error).toBeUndefined();

    const parseResult = adminDashboardSchema.safeParse(result.data);
    expect(parseResult.success).toBe(true);

    expect(result.data).toMatchObject({
      metrics: {
        totalRevenue: 1000000,
        totalStudents: 2,
        activeCourses: 15,
        totalFlashcardReviews: 45230,
      },
      userDistribution: {
        students: 2,
        teachers: 1,
        admins: 1,
      },
    });
  });

  it("❌ [THẤT BẠI - RBAC] Chặn đứng và báo lỗi nếu user đăng nhập có role là Student", async () => {
    expect.hasAssertions();
    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({ hasUser: true, profileData: { role: "student" } })
    );

    const result = await getAdminDashboardData();
    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Từ chối truy cập. Bạn không có quyền hạn quản trị viên.");
  });

  it("🛡️ [ZOD FAIL] Chặn đứng payload ra ngoài nếu DB trả dữ liệu sai cấu trúc", async () => {
    expect.hasAssertions();
    const corruptedCourses = [
      {
        id: MOCK_COURSE_ID,
        title: "Khóa học lỗi",
        price: -250000,
        enrollments: [{ id: "e1" }],
      },
    ];

    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({ hasUser: true, coursesData: corruptedCourses })
    );

    const result = await getAdminDashboardData();
    expect(result.data).toBeUndefined();
    expect(result.error).toContain("Cấu trúc dữ liệu tổng hợp không hợp lệ");
  });

  // 🔥 FIX: Đưa case số 4 vào đúng khối điều hướng độc lập kèm 'hasUser: true' đầy đủ
  it("❌ [SUPABASE ERROR] Phải trả về lỗi hệ thống nếu một trong các truy vấn độc lập bị gãy", async () => {
    expect.hasAssertions();

    mockedCreateClient.mockResolvedValueOnce(
      createMockSupabase({
        hasUser: true, // Vượt qua vòng bảo vệ đăng nhập
        coursesBusinessError: { message: "Database connection timeout or table not found" } // Kích hoạt nổ DB
      })
    );

    const result = await getAdminDashboardData();

    expect(result.data).toBeUndefined();
    expect(result.error).toContain("Gặp sự cố hệ thống khi tải báo cáo dữ liệu quản trị.");
  });
});