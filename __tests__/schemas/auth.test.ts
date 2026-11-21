import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/schemas/profile";
import {
  emailConfirmationParamsSchema,
  passwordRecoveryRequestSchema,
  registerSchema,
  resendSignupConfirmationSchema,
  setPasswordSchema,
} from "@/lib/schemas/auth";

// Test plan:
// - Mục tiêu: contract Zod A1/A2 — đăng ký không có mật khẩu, recovery email và link được kiểm ở boundary.
// - Loại test: schema/unit.
// - Đối tượng: registerSchema, setPasswordSchema, resendSignupConfirmationSchema, passwordRecoveryRequestSchema, emailConfirmationParamsSchema.
// - Case thành công: đăng ký hợp lệ; mật khẩu ≥ 6 ký tự và khớp; link type email/signup/recovery; email recovery hợp lệ;
//   giới tính male/female/other được registerSchema và profileSchema chấp nhận cùng một bộ (A5 AUTH-016).
// - Case thất bại: mật khẩu ngắn, xác nhận không khớp, email sai, token_hash rỗng, type lạ; giới tính cũ nam/nữ, giá trị lạ
//   hoặc thiếu bị registerSchema từ chối với message tiếng Việt.
// - Bảo mật/phân quyền: registerSchema bỏ mật khẩu client; recovery schema bỏ redirectTo và mọi trường ngoài email.
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: luật độ dài mật khẩu giữ như form đăng ký cũ (≥ 6 ký tự).
// - Kết quả verify gần nhất: xem milestone A5 CP3 trong progress.md (`npx vitest run __tests__/schemas/auth.test.ts`).

const validRegistration = {
  username: "learner01",
  email: "learner@example.com",
  full_name: "Nguyễn Văn A",
  phone: "0912345678",
  dob: new Date("2000-01-01"),
  gender: "male" as const,
};

describe("auth schemas", () => {
  it("accepts a registration without password fields and strips any password sent", () => {
    const parsed = registerSchema.safeParse({
      ...validRegistration,
      password: "Attacker-123!",
      confirmPassword: "Attacker-123!",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("password");
      expect(parsed.data).not.toHaveProperty("confirmPassword");
    }
  });

  it("still validates the remaining registration fields", () => {
    const parsed = registerSchema.safeParse({ ...validRegistration, email: "not-an-email" });
    expect(parsed.success).toBe(false);
  });

  it.each(["male", "female", "other"])(
    "accepts gender %s in both registerSchema and profileSchema so a registered user can save /profile",
    (gender) => {
      expect(registerSchema.safeParse({ ...validRegistration, gender }).success).toBe(true);
      expect(profileSchema.safeParse({ full_name: "Nguyễn Văn A", gender }).success).toBe(true);
    },
  );

  it.each(["nam", "nữ", "MALE", "", undefined, 1])(
    "rejects registration gender %j with the choose-gender message key",
    (gender) => {
      const parsed = registerSchema.safeParse({ ...validRegistration, gender });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        // English localization U1 G7: schema trả khóa dịch; câu tiếng Việt đúng nguyên văn được kiểm ở test render form đăng ký.
        expect(parsed.error.issues[0]).toMatchObject({ path: ["gender"], message: "register.genderRequired" });
      }
    },
  );

  it("accepts a matching password of at least 6 characters", () => {
    expect(setPasswordSchema.safeParse({ password: "abc123", confirmPassword: "abc123" }).success).toBe(
      true,
    );
  });

  it("rejects a short password and a mismatched confirmation on the right fields", () => {
    const short = setPasswordSchema.safeParse({ password: "abc12", confirmPassword: "abc12" });
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues[0]).toMatchObject({
        path: ["password"],
        message: "Mật khẩu ít nhất 6 ký tự cho an toàn",
      });
    }

    const mismatch = setPasswordSchema.safeParse({ password: "abc123", confirmPassword: "abc124" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]).toMatchObject({
        path: ["confirmPassword"],
        message: "Mật khẩu xác nhận không khớp",
      });
    }
  });

  it("validates the resend email", () => {
    expect(resendSignupConfirmationSchema.safeParse({ email: "learner@example.com" }).success).toBe(true);
    expect(resendSignupConfirmationSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("accepts confirmation and recovery links", () => {
    for (const type of ["email", "signup", "recovery"]) {
      expect(emailConfirmationParamsSchema.safeParse({ token_hash: "abc", type }).success).toBe(true);
    }
  });

  it("rejects empty token hashes and other link types", () => {
    for (const params of [
      { token_hash: "   ", type: "email" },
      { token_hash: null, type: "email" },
      { token_hash: "abc", type: "magiclink" },
      { token_hash: "abc", type: null },
    ]) {
      expect(emailConfirmationParamsSchema.safeParse(params).success).toBe(false);
    }
  });

  it("validates recovery email and strips client-controlled redirect fields", () => {
    expect(passwordRecoveryRequestSchema.parse({
      email: "learner@example.com", redirectTo: "https://evil.example",
    })).toEqual({ email: "learner@example.com" });
    for (const email of ["", "   ", "nope", null]) {
      expect(passwordRecoveryRequestSchema.safeParse({ email }).success).toBe(false);
    }
  });
});
