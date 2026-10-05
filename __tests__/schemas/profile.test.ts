import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/schemas/profile";

// Test plan:
// - Mục tiêu: bảo vệ chuẩn hóa trống → null và thông báo lỗi của form hồ sơ (A3 G4, AC8).
// - Loại test: schema.
// - Đối tượng: profileSchema.
// - Case thành công: username/dob/gender rỗng, toàn khoảng trắng, null hoặc vắng mặt đều thành null; username
//   hợp lệ giữ nguyên từng ký tự (không trim); giới tính hợp lệ giữ nguyên.
// - Case thất bại: họ tên < 2 ký tự, username có giá trị < 3 ký tự, giới tính ngoài male/female/other (kể cả
//   "nam" của form đăng ký) và giới tính sai kiểu đều trả message tiếng Việt cố định.
// - Bảo mật/phân quyền: payload tự chế `dob: ""` được chuẩn hóa ở server schema, không phụ thuộc form.
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: giá trị "không nhập" luôn ra null, không bao giờ ra chuỗi rỗng cho cột date/username.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/schemas/profile.test.ts`.

const base = { full_name: "Nguyễn Văn A" };

describe("profileSchema blank normalization", () => {
  it.each(["", "   ", "\t \n"])("turns blank %j username, dob and gender into null", (blank) => {
    const parsed = profileSchema.parse({ ...base, username: blank, dob: blank, gender: blank });
    expect(parsed.username).toBeNull();
    expect(parsed.dob).toBeNull();
    expect(parsed.gender).toBeNull();
  });

  it("turns null and missing username, dob and gender into null", () => {
    expect(profileSchema.parse({ ...base, username: null, dob: null, gender: null })).toMatchObject({
      username: null,
      dob: null,
      gender: null,
    });
    expect(profileSchema.parse(base)).toMatchObject({ username: null, dob: null, gender: null });
  });

  it("keeps a non-blank username exactly as typed, including surrounding spaces", () => {
    expect(profileSchema.parse({ ...base, username: " abc " }).username).toBe(" abc ");
    expect(profileSchema.parse({ ...base, username: "abc" }).username).toBe("abc");
  });

  it("keeps a valid date and each allowed gender", () => {
    for (const gender of ["male", "female", "other"] as const) {
      expect(profileSchema.parse({ ...base, dob: "2000-01-31", gender })).toMatchObject({
        dob: "2000-01-31",
        gender,
      });
    }
  });
});

describe("profileSchema rejections", () => {
  function firstMessage(input: unknown) {
    const result = profileSchema.safeParse(input);
    return result.success ? null : result.error.issues[0].message;
  }

  it("rejects a full name under 2 characters", () => {
    expect(firstMessage({ full_name: "A" })).toBe("Họ tên phải có ít nhất 2 ký tự");
  });

  it("rejects a non-blank username under 3 characters", () => {
    expect(firstMessage({ ...base, username: "ab" })).toBe("Username phải từ 3 ký tự trở lên");
  });

  it.each(["nam", "nữ", "MALE", 1])("rejects gender %j with a Vietnamese message", (gender) => {
    expect(firstMessage({ ...base, gender })).toBe("Giới tính không hợp lệ.");
  });
});
