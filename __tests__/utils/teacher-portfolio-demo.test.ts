import { describe, expect, it } from "vitest";
import { assertPortfolioDemoTarget, portfolioDemoCourseIds, seedTeacherPortfolioDemo } from "@/scripts/dev/seed-teacher-portfolio-demo.mjs";

// Test plan:
// - Mục tiêu: chặn fixture demo local ghi nhầm remote hoặc E2E.
// - Loại test: unit guard, không kết nối database.
// - Đối tượng: target guard và namespace của seedTeacherPortfolioDemo.
// - Case thành công: root API 45321; 16 UUID riêng không trùng nhau.
// - Case thất bại/phân quyền: remote, E2E, thiếu URL bị từ chối trước khi tạo client/ghi dữ liệu.
// - Ổn định/invariant: chỉ fixture local do Owner yêu cầu, không có cơ chế reset hay xóa.
// - Kết quả verify gần nhất: passed trong lượt 75 tests / 6 files của checkpoint cuối.
// - Lệnh: `npm run test:run -- __tests__/actions/teacher-course-portfolio.test.ts __tests__/schemas/teacher-course-portfolio.test.ts __tests__/components/teacher-course-portfolio.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/utils/teacher-portfolio-demo.test.ts __tests__/actions/course.test.ts`.

describe("local portfolio demo safety", () => {
  it("accepts only the canonical root-local API and keeps a distinct stable namespace", () => {
    expect(() => assertPortfolioDemoTarget("http://127.0.0.1:45321")).not.toThrow();
    expect(new Set(portfolioDemoCourseIds).size).toBe(16);
    expect(portfolioDemoCourseIds.every(id => /^f9200000-0000-4000-8000-\d{12}$/.test(id))).toBe(true);
  });
  it.each(["https://example.supabase.co", "http://127.0.0.1:45441", "http://localhost:45321", undefined])("refuses %s before any client or mutation exists", async (url) => {
    await expect(seedTeacherPortfolioDemo({ NEXT_PUBLIC_SUPABASE_URL: url })).rejects.toThrow();
  });
});
