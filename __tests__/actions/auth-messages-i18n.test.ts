import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestPasswordRecovery,
  resendSignupConfirmation,
  setPasswordAfterConfirmation,
  signInUser,
  signUpUser,
} from "@/app/actions/auth";
import { updateUserPassword } from "@/app/actions/profile";
import { getPasswordSetupEligibility } from "@/lib/auth/password-setup";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/utils/supabase/server";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import type { Locale } from "@/lib/i18n/config";

// Test plan:
// - Mục tiêu: English localization U2 AC3/H4 - mọi đường trả message của các action auth (và hai nhánh đổi mật khẩu dùng chung
//   của /profile) trả đúng câu đã dịch theo ngôn ngữ của request, với dạng trả về `{ error }` / `{ success, message }` giữ nguyên.
// - Loại test: Server Action với next-intl thật (cấu hình request bản test chọn ngôn ngữ); Supabase, fetch và eligibility bị mock.
// - Đối tượng: signUpUser, resendSignupConfirmation, requestPasswordRecovery, signInUser, setPasswordAfterConfirmation, updateUserPassword.
// - Case chính: từng message hằng (đăng ký đóng, username trùng, đọc username lỗi, ảnh sai, kết quả gửi lại/khôi phục, đăng nhập
//   sai, phiên không hợp lệ, hết hạn, mật khẩu trùng/yếu) ở cả vi (đúng nguyên văn cũ) và en.
// - Case biên: action trả chung một message (signInUser, resend, recovery) giữ message đó cho cả input sai lẫn thất bại; lỗi
//   schema của setPasswordAfterConfirmation (trường thiếu → null, ngắn, không khớp) trả câu đã dịch trước mọi truy vấn Auth.
// - Giới hạn: không kiểm DB thật; test tích hợp __tests__/integration/auth-* giữ phần đó.

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/auth/password-setup", () => ({
  getPasswordSetupEligibility: vi.fn(),
  consumePasswordRecovery: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn() })),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedServiceRole = vi.mocked(createServiceRoleClient);
const mockedEligibility = vi.mocked(getPasswordSetupEligibility);

const TEXT = {
  signUpUnavailable: { vi: "Đăng ký tạm thời chưa khả dụng", en: "Sign-up is temporarily unavailable" },
  signUpRetry: { vi: "Đăng ký chưa thành công, vui lòng thử lại.", en: "Sign-up didn't go through. Please try again." },
  usernameTaken: { vi: "Username đã được dùng, hãy thử username khác.", en: "That username is already taken. Try another one." },
  avatarInvalid: {
    vi: "Ảnh đại diện chưa hợp lệ. Hãy chọn ảnh JPG, PNG hoặc WebP khác.",
    en: "This profile photo isn't valid. Choose a different JPG, PNG or WebP image.",
  },
  resend: {
    vi: "Mail xác minh mới sẽ tới trong vài phút, bạn kiểm tra cả mục Spam nhé!",
    en: "A new verification email will arrive in a few minutes. Check your Spam folder too!",
  },
  recovery: {
    vi: "Đã gửi yêu cầu! Bạn kiểm tra hộp thư (cả mục Spam) trong vài phút nhé.",
    en: "Request sent! Check your inbox (and Spam folder) in a few minutes.",
  },
  signInFailed: { vi: "Sai email hoặc mật khẩu!", en: "Wrong email or password!" },
  notAllowed: {
    vi: "Phiên xác minh không còn hợp lệ để đặt mật khẩu. Vui lòng đăng nhập lại.",
    en: "This verification session can no longer be used to set a password. Please sign in again.",
  },
  expired: {
    vi: "Phiên xác minh đã quá 24 giờ. Bạn yêu cầu link mới ở trang Quên mật khẩu nhé.",
    en: "This verification session is over 24 hours old. Request a new link on the Forgot password page.",
  },
  setFailed: { vi: "Chưa đặt được mật khẩu, vui lòng thử lại.", en: "Couldn't set your password. Please try again." },
  samePassword: { vi: "Mật khẩu mới phải khác mật khẩu cũ.", en: "Your new password must be different from your old one." },
  weakPassword: {
    vi: "Mật khẩu này quá yếu hoặc dễ đoán, hãy chọn mật khẩu khác.",
    en: "This password is too weak or easy to guess. Choose a different one.",
  },
  short: { vi: "Mật khẩu ít nhất 6 ký tự cho an toàn", en: "Use at least 6 characters to keep your account safe" },
  confirmRequired: { vi: "Vui lòng xác nhận lại mật khẩu", en: "Please confirm your password" },
  mismatch: { vi: "Mật khẩu xác nhận không khớp", en: "The passwords don't match" },
  // Văn bản Zod cũ, giữ làm giá trị tiếng Việt (U2 G2); tiếng Anh dùng cùng câu vì người dùng không thể gửi trường thiếu từ UI.
  nullString: { vi: "Invalid input: expected string, received null", en: "Invalid input: expected string, received null" },
} satisfies Record<string, Record<Locale, string>>;

function authError(code: string) {
  return { code, status: 400, message: code };
}

function sessionClient(overrides: Record<string, unknown> = {}) {
  const auth = {
    resend: vi.fn().mockResolvedValue({ data: {}, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: { message: "nope" } }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "learner@example.com" } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    ...overrides,
  };
  mockedCreateClient.mockResolvedValue({ auth, storage: { from: vi.fn() } } as never);
  return auth;
}

function serviceClient({ existingProfile = null as unknown, profileError = null as unknown } = {}) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data: existingProfile, error: profileError });
  mockedServiceRole.mockReturnValue({ from: vi.fn(() => query), auth: { admin: { createUser: vi.fn() } } } as never);
}

function signUpForm(extra?: File) {
  const formData = new FormData();
  const values = {
    username: "learner01",
    email: "learner@example.com",
    full_name: "Nguyễn Văn A",
    phone: "0912345678",
    dob: "2000-01-01T00:00:00.000Z",
    gender: "male",
  };
  for (const [key, value] of Object.entries(values)) formData.append(key, value);
  if (extra) formData.append("avatar", extra);
  return formData;
}

function passwordForm(values: Record<string, string | null>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== null) formData.append(key, value);
  return formData;
}

function stubSignupSwitch(disableSignup: boolean) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ disable_signup: disableSignup }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  setServerTestLocale("vi");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(["vi", "en"] as const)("auth action messages in %s", (locale) => {
  const t = (key: keyof typeof TEXT) => TEXT[key][locale];
  beforeEach(() => setServerTestLocale(locale));

  it("signUpUser: signups closed, username read error, username taken and invalid avatar", async () => {
    sessionClient();
    serviceClient();
    stubSignupSwitch(true);
    await expect(signUpUser(signUpForm())).resolves.toEqual({ error: t("signUpUnavailable") });

    stubSignupSwitch(false);
    serviceClient({ profileError: { code: "x" } });
    await expect(signUpUser(signUpForm())).resolves.toEqual({ error: t("signUpRetry") });

    serviceClient({ existingProfile: { id: "p1" } });
    await expect(signUpUser(signUpForm())).resolves.toEqual({ error: t("usernameTaken") });

    // Ảnh sai loại bị từ chối trước công tắc đăng ký và mọi truy vấn.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const bad = new File(["x"], "a.gif", { type: "image/gif" });
    await expect(signUpUser(signUpForm(bad))).resolves.toEqual({ error: t("avatarInvalid") });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resendSignupConfirmation and requestPasswordRecovery keep one generic message for valid and invalid input", async () => {
    const auth = sessionClient({ resend: vi.fn().mockResolvedValue({ error: authError("over_email_send_rate_limit") }) });
    const expectedResend = { success: true, message: t("resend") };
    await expect(resendSignupConfirmation("learner@example.com")).resolves.toEqual(expectedResend);
    await expect(resendSignupConfirmation("not-an-email")).resolves.toEqual(expectedResend);
    expect(auth.resend).toHaveBeenCalledTimes(1);

    const expectedRecovery = { success: true, message: t("recovery") };
    await expect(requestPasswordRecovery("learner@example.com")).resolves.toEqual(expectedRecovery);
    await expect(requestPasswordRecovery("not-an-email")).resolves.toEqual(expectedRecovery);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });

  it("signInUser answers one message for invalid input and for a failed sign-in", async () => {
    const auth = sessionClient();
    await expect(signInUser(passwordForm({ email: "nope", password: "" }))).resolves.toEqual({ error: t("signInFailed") });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    await expect(signInUser(passwordForm({ email: "learner@example.com", password: "abc123" }))).resolves.toEqual({
      error: t("signInFailed"),
    });
  });

  it("setPasswordAfterConfirmation: schema issues come back translated before any Auth call", async () => {
    const auth = sessionClient();
    await expect(setPasswordAfterConfirmation(passwordForm({ password: null, confirmPassword: null }))).resolves.toEqual({
      error: t("nullString"),
    });
    await expect(setPasswordAfterConfirmation(passwordForm({ password: "abc12", confirmPassword: "abc12" }))).resolves.toEqual({
      error: t("short"),
    });
    await expect(setPasswordAfterConfirmation(passwordForm({ password: "abc123", confirmPassword: "" }))).resolves.toEqual({
      error: t("confirmRequired"),
    });
    await expect(setPasswordAfterConfirmation(passwordForm({ password: "abc123", confirmPassword: "abc124" }))).resolves.toEqual({
      error: t("mismatch"),
    });
    expect(mockedEligibility).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("setPasswordAfterConfirmation: ineligible session and each update error code", async () => {
    mockedEligibility.mockResolvedValue({ status: "not_eligible" } as never);
    sessionClient();
    await expect(setPasswordAfterConfirmation(passwordForm({ password: "abc123", confirmPassword: "abc123" }))).resolves.toEqual({
      error: t("notAllowed"),
    });

    mockedEligibility.mockResolvedValue({ status: "eligible", userId: "u1", sessionId: null } as never);
    const cases: Array<[string, keyof typeof TEXT]> = [
      ["same_password", "samePassword"],
      ["weak_password", "weakPassword"],
      ["reauthentication_needed", "expired"],
      ["unexpected_failure", "setFailed"],
    ];
    for (const [code, key] of cases) {
      sessionClient({ updateUser: vi.fn().mockResolvedValue({ error: authError(code) }) });
      await expect(setPasswordAfterConfirmation(passwordForm({ password: "abc123", confirmPassword: "abc123" }))).resolves.toEqual({
        error: t(key),
      });
    }
  });

  it("updateUserPassword: same_password and weak_password use the shared translated messages", async () => {
    for (const [code, key] of [
      ["same_password", "samePassword"],
      ["weak_password", "weakPassword"],
    ] as const) {
      sessionClient({
        signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: authError(code) }),
      });
      await expect(
        updateUserPassword({ currentPassword: "oldpass1", newPassword: "newpass1", confirmPassword: "newpass1" }),
      ).resolves.toEqual({ error: t(key) });
    }
  });
});
