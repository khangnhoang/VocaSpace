import { describe, expect, it } from "vitest";
import {
  elapsedMinutes,
  formatCount,
  formatMillions,
  formatPercent,
  formatRelativeTime,
  formatVnd,
  formatWait,
  monthAxisLabel,
  monthLabel,
  monthLabelWithYear,
} from "@/lib/admin/dashboard-format";

// Test plan:
// - Mục tiêu: định dạng số, tiền, tháng và thời gian của dashboard /admin cho cùng một chuỗi ở server và trình duyệt (AD4 AC5, AC8).
// - Loại test: unit thuần, không phụ thuộc locale của runtime.
// - Đối tượng: lib/admin/dashboard-format.ts.
// - Case thành công: nhóm nghìn bằng dấu chấm; triệu đồng với dấu phẩy; tỷ lệ một chữ số; nhãn tháng; thời gian chờ và thời gian tương đối.
// - Case thất bại: số dương rất nhỏ không bị làm tròn thành "0"; mốc thời gian thiếu hoặc sai trả null; đồng hồ lệch không cho thời gian âm.
// - Bảo mật/phân quyền: không áp dụng.
// - Ổn định/resilience: ranh giới 1 phút, 1 giờ, 1 ngày, 30 ngày.
// - Invariant cần giữ: mọi chuỗi tiền hiển thị là số nguyên đồng chính xác như dữ liệu, không làm tròn mất giá trị.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/utils/dashboard-format.test.ts`.

describe("dashboard number formatting", () => {
  it("groups thousands with dots and appends the dong sign after a non-breaking space", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234567)).toBe("1.234.567");
    expect(formatVnd(12000000)).toBe("12.000.000 ₫");
  });

  it("shows millions with a decimal comma and at most two digits", () => {
    expect(formatMillions(0)).toBe("0");
    expect(formatMillions(12_000_000)).toBe("12");
    expect(formatMillions(12_300_000)).toBe("12,3");
    expect(formatMillions(300_000)).toBe("0,3");
    expect(formatMillions(1_234_000_000)).toBe("1.234");
    expect(formatMillions(12_340_000)).toBe("12,34");
  });

  it("does not round a small positive amount down to zero", () => {
    expect(formatMillions(4_000)).toBe("<0,01");
    expect(formatMillions(10_000)).toBe("0,01");
  });

  it("formats shares with one decimal and drops a trailing zero", () => {
    expect(formatPercent(62.5)).toBe("62,5%");
    expect(formatPercent(40)).toBe("40%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.44)).toBe("0,4%");
  });
});

describe("dashboard month and time formatting", () => {
  it("labels a month for the axis, the tooltip and the table", () => {
    expect(monthAxisLabel("2026-08")).toBe("T8");
    expect(monthLabel("2026-08")).toBe("Tháng 8");
    expect(monthLabel("2026-12")).toBe("Tháng 12");
    expect(monthLabelWithYear("2026-08")).toBe("Tháng 8/2026");
  });

  it("measures elapsed minutes and refuses missing or invalid input", () => {
    expect(elapsedMinutes("2026-10-15T07:00:00Z", "2026-10-15T08:30:00Z")).toBe(90);
    expect(elapsedMinutes(null, "2026-10-15T08:30:00Z")).toBeNull();
    expect(elapsedMinutes("not a date", "2026-10-15T08:30:00Z")).toBeNull();
    expect(elapsedMinutes("2026-10-15T09:00:00Z", "2026-10-15T08:30:00Z")).toBe(0);
  });

  it("states a wait in days, hours or minutes", () => {
    expect(formatWait(0)).toBe("dưới 1 phút");
    expect(formatWait(59)).toBe("59 phút");
    expect(formatWait(60)).toBe("1 giờ");
    expect(formatWait(1439)).toBe("23 giờ");
    expect(formatWait(1440)).toBe("1 ngày");
    expect(formatWait(3 * 1440 + 100)).toBe("3 ngày");
  });

  it("shows relative time from the database timestamp and a Vietnam date after 30 days", () => {
    const now = "2026-10-15T08:00:00Z";
    expect(formatRelativeTime("2026-10-15T07:59:30Z", now)).toBe("Vừa xong");
    expect(formatRelativeTime("2026-10-15T07:30:00Z", now)).toBe("30 phút trước");
    expect(formatRelativeTime("2026-10-15T03:00:00Z", now)).toBe("5 giờ trước");
    expect(formatRelativeTime("2026-10-12T08:00:00Z", now)).toBe("3 ngày trước");
    // 17:30 UTC ngày 1/9 đã là 00:30 ngày 2/9 ở Việt Nam.
    expect(formatRelativeTime("2026-09-01T17:30:00Z", now)).toBe("02/09/2026");
    expect(formatRelativeTime("broken", now)).toBe("");
  });
});
