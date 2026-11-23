import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import { MESSAGES } from "@/lib/i18n/messages";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getPasswordSetupEligibility } from "@/lib/auth/password-setup";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: English localization U2, vòng sửa Codex 3-5 - các wrapper `*Localized` giữ nguyên kết quả của action gốc và kèm ngôn ngữ
//   mà server dùng cho request cùng khóa catalog + tham số của thông báo, để client không hiện chuỗi sai ngôn ngữ và vẫn dịch lại
//   đúng thông báo đó (cách khắc phục khác nhau) khi cookie bị đổi ở tab khác. Khóa do chính action ghi lại lúc chọn thông báo, không
//   suy từ chuỗi đã dịch (plan G3). Ngôn ngữ server được đặt trước khi gửi, không đổi giữa chừng.
// - Loại test: Server Action thật với next-intl thật; chỉ Supabase, fetch, eligibility và next/navigation bị mock.
// - Case chính: kết quả được trả nguyên vẹn trong `result`; `locale` theo cookie của request (vi, en); khóa của phiên set-password hết
//   hạn, đăng nhập sai, mật khẩu trùng (namespace `auth` qua action hồ sơ), lỗi preview và lỗi tìm topic đầu tiên.
// - Case biên: hai thông báo có CÙNG chữ tiếng Anh nhưng khóa khác nhau (`validation.register.usernameMin` và
//   `validation.profile.usernameMin`) vẫn ra đúng khóa; lỗi sai kiểu mang tham số `{received}`; kết quả không có thông báo thì không
//   có khóa; lỗi hoặc redirect do action gốc ném ra vẫn đi qua wrapper.
// - Giới hạn: không kiểm DB thật; các test của từng action nằm ở auth-messages-i18n, profile-english và public-course-preview.

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

import { setPasswordAfterConfirmationLocalized, signInUserLocalized, signUpUserLocalized } from "@/app/actions/auth-localized";
import { updateUserPasswordLocalized, updateUserProfileLocalized } from "@/app/actions/profile-localized";
import { answerPublicCoursePreviewQuestionLocalized } from "@/app/actions/public-course-preview-localized";
import { getFirstTopicSlugByCourseSlugLocalized } from "@/app/actions/course-navigation-localized";

const mockedCreateClient = vi.mocked(createClient);
const mockedServiceRole = vi.mocked(createServiceRoleClient);
const mockedEligibility = vi.mocked(getPasswordSetupEligibility);

function authError(code: string) {
  return { code, status: 400, message: code };
}

function sessionClient(overrides: Record<string, unknown> = {}) {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: { message: "nope" } }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "learner@example.com" } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    ...overrides,
  };
  mockedCreateClient.mockResolvedValue({ auth, storage: { from: vi.fn() } } as never);
  return auth;
}

function signUpForm(username: string) {
  const formData = new FormData();
  const values = {
    username,
    email: "learner@example.com",
    full_name: "Nguyễn Văn A",
    phone: "0912345678",
    dob: "2000-01-01T00:00:00.000Z",
    gender: "male",
  };
  for (const [key, value] of Object.entries(values)) formData.append(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  setServerTestLocale("vi");
});

describe("localized Server Action wrappers", () => {
  it("returns the original result untouched with the request's locale and the key the action chose", async () => {
    sessionClient();
    const formData = new FormData();
    formData.append("email", "learner@example.com");
    formData.append("password", "secret123");

    await expect(signInUserLocalized(formData)).resolves.toEqual({
      result: { error: MESSAGES.vi.auth.actions.signInFailed },
      locale: "vi",
      messageKey: "auth.actions.signInFailed",
    });
  });

  it("reports the locale the server used, and no key for a result without a message", async () => {
    setServerTestLocale("en");
    const profileRow = { id: "u1", username: null };
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "update", "is"]) query[method] = vi.fn(() => query);
    query.single = vi.fn().mockResolvedValue({ data: profileRow, error: null });
    query.then = (resolve: (value: unknown) => unknown) => resolve({ data: [{ id: "u1" }], error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
      from: vi.fn(() => query),
    } as never);

    await expect(
      updateUserProfileLocalized({ full_name: "An Nguyen", username: null, dob: null, gender: null }),
    ).resolves.toEqual({ result: { success: true }, locale: "en", messageKey: null });
  });

  it("gives the original remedy key of an expired set-password session when the request ran in English", async () => {
    // Cookie của request đã là EN khi gửi (tab khác ghi trước đó); giữ nguyên tới lúc action trả về.
    setServerTestLocale("en");
    sessionClient({ updateUser: vi.fn().mockResolvedValue({ data: {}, error: authError("reauthentication_needed") }) });
    mockedEligibility.mockResolvedValue({ status: "eligible", userId: "u1", sessionId: null } as never);
    const formData = new FormData();
    formData.append("password", "secret123");
    formData.append("confirmPassword", "secret123");

    await expect(setPasswordAfterConfirmationLocalized(formData)).resolves.toEqual({
      result: { error: MESSAGES.en.auth.actions.setPasswordSessionExpired },
      locale: "en",
      messageKey: "auth.actions.setPasswordSessionExpired",
    });
  });

  it("gives the auth-namespace key for the same-password advice of the profile password action", async () => {
    sessionClient({
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: authError("same_password") }),
    });

    const response = await updateUserPasswordLocalized({
      currentPassword: "secret123",
      newPassword: "secret123",
      confirmPassword: "secret123",
    });

    expect(response.result).toEqual({ error: MESSAGES.vi.auth.actions.samePassword });
    expect(response.messageKey).toBe("auth.actions.samePassword");
  });

  it("keeps two validation messages apart even though their English text is identical", async () => {
    // Điều kiện của ca: hai khóa có CÙNG chữ tiếng Anh nhưng khác chữ tiếng Việt, nên tra ngược theo chuỗi không phân biệt được.
    expect(MESSAGES.en.validation.register.usernameMin).toBe(MESSAGES.en.validation.profile.usernameMin);
    expect(MESSAGES.vi.validation.register.usernameMin).not.toBe(MESSAGES.vi.validation.profile.usernameMin);
    setServerTestLocale("en");
    sessionClient();

    const profile = await updateUserProfileLocalized({ full_name: "An Nguyen", username: "ab", dob: null, gender: null });
    const register = await signUpUserLocalized(signUpForm("ab"));

    expect(profile.messageKey).toBe("validation.profile.usernameMin");
    expect(profile.result).toEqual({ error: MESSAGES.en.validation.profile.usernameMin });
    expect(register.messageKey).toBe("validation.register.usernameMin");
    expect(register.result).toEqual({ error: MESSAGES.en.validation.register.usernameMin });
    expect(profile.messageParams).toBeUndefined();
  });

  it("carries the {received} parameter of a wrong-type validation message", async () => {
    sessionClient();
    const formData = new FormData();
    formData.append("confirmPassword", "secret123");

    const response = await setPasswordAfterConfirmationLocalized(formData);

    expect(response.result).toEqual({ error: "Invalid input: expected string, received null" });
    expect(response.messageKey).toBe("validation.zodType.string");
    expect(response.messageParams).toEqual({ received: "null" });
  });

  it("gives the courses keys of the preview answer failure and of the first-topic lookup", async () => {
    mockedServiceRole.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) } as never);
    const answer = await answerPublicCoursePreviewQuestionLocalized({
      courseSlug: "toeic-foundations",
      topicSlug: "opening-topic",
      questionId: "11111111-1111-4111-8111-111111111111",
      selectedOptionId: "22222222-2222-4222-8222-222222222222",
    });
    expect(answer).toEqual({
      result: { status: "error", error: MESSAGES.vi.courses.actions.answerError },
      locale: "vi",
      messageKey: "courses.actions.answerError",
    });

    await expect(getFirstTopicSlugByCourseSlugLocalized("")).resolves.toEqual({
      result: { error: MESSAGES.vi.courses.actions.firstTopic.missingSlug, topicSlug: null },
      locale: "vi",
      messageKey: "courses.actions.firstTopic.missingSlug",
    });
  });

  it("returns no key when the original action returns without a message", async () => {
    mockedServiceRole.mockReturnValue({ rpc: vi.fn() } as never);

    await expect(answerPublicCoursePreviewQuestionLocalized({})).resolves.toEqual({
      result: { status: "unavailable" },
      locale: "vi",
      messageKey: null,
    });
  });

  it("lets a failure or redirect thrown by the original action propagate", async () => {
    sessionClient();
    mockedEligibility.mockResolvedValue({ status: "eligible", userId: "u1", sessionId: null } as never);
    mockedServiceRole.mockReturnValue({ from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })) } as never);
    const formData = new FormData();
    formData.append("password", "secret123");
    formData.append("confirmPassword", "secret123");

    await expect(setPasswordAfterConfirmationLocalized(formData)).rejects.toThrow("NEXT_REDIRECT");
  });
});
