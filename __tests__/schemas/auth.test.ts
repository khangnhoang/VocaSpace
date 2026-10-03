import { describe, expect, it } from "vitest";
import {
  emailConfirmationParamsSchema,
  registerSchema,
  resendSignupConfirmationSchema,
  setPasswordSchema,
} from "@/lib/schemas/auth";

// Test plan:
// - Mục tiêu: kiểm tra contract Zod của luồng đăng ký A1 — form đăng ký không còn mật khẩu, mật khẩu đặt sau xác minh.
// - Loại test: schema/unit.
// - Đối tượng: registerSchema, setPasswordSchema, resendSignupConfirmationSchema, emailConfirmationParamsSchema.
// - Case thành công: form đăng ký hợp lệ không có mật khẩu; mật khẩu ≥ 6 ký tự và khớp; link có token_hash + type email/signup.
// - Case thất bại: mật khẩu ngắn, xác nhận không khớp, email sai, token_hash rỗng, type lạ.
// - Bảo mật/phân quyền: registerSchema bỏ mọi trường mật khẩu client gửi lên (G8: mật khẩu chỉ đặt sau khi xác minh email).
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: luật độ dài mật khẩu giữ như form đăng ký cũ (≥ 6 ký tự).
// - Kết quả verify gần nhất: passed (7 test) bằng `npx vitest run __tests__/schemas/auth.test.ts`.

const validRegistration = {
  username: "learner01",
  email: "learner@example.com",
  full_name: "Nguyễn Văn A",
  phone: "0912345678",
  dob: new Date("2000-01-01"),
  gender: "nam" as const,
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

  it("accepts confirmation links of type email or signup", () => {
    for (const type of ["email", "signup"]) {
      expect(emailConfirmationParamsSchema.safeParse({ token_hash: "abc", type }).success).toBe(true);
    }
  });

  it("rejects empty token hashes and other link types", () => {
    for (const params of [
      { token_hash: "   ", type: "email" },
      { token_hash: null, type: "email" },
      { token_hash: "abc", type: "recovery" },
      { token_hash: "abc", type: "magiclink" },
      { token_hash: "abc", type: null },
    ]) {
      expect(emailConfirmationParamsSchema.safeParse(params).success).toBe(false);
    }
  });
});
