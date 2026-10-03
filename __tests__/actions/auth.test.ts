import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import {
  resendSignupConfirmation,
  setPasswordAfterConfirmation,
  signInUser,
  signUpUser,
} from "@/app/actions/auth";
import SetPasswordPage from "@/app/auth/set-password/page";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ ranh giới server của đăng ký A1 — user chỉ do server tạo, chưa xác minh, mật khẩu đặt sau xác minh.
// - Loại test: Server Action + server page unit test với Supabase boundary mock.
// - Đối tượng: signUpUser, resendSignupConfirmation, signInUser, setPasswordAfterConfirmation, trang /auth/set-password.
// - Case thành công: sign-up tạo user email_confirm=false có marker và mật khẩu ngẫu nhiên rồi gửi mail; session `otp`
//   chưa có cờ đặt được mật khẩu, sau đó cờ d7_password_set được ghi bằng service role.
// - Case thất bại: mọi lỗi createUser/resend trả cùng kết quả trung tính; username trùng hoặc đọc lỗi không tạo user;
//   công tắc đăng ký tắt/không đọc được thì không tạo user; input sai không gọi Supabase.
// - Bảo mật/phân quyền: G4 (fail closed), G5 (kết quả không lộ email đã tồn tại), G8 (chỉ `amr` otp chưa có cờ mới
//   đặt được mật khẩu; mật khẩu ngẫu nhiên không lọt ra kết quả).
// - Ổn định/resilience: lỗi ghi cờ chỉ được log, vẫn redirect; lỗi updateUser trả thông điệp chung để thử lại.
// - Invariant cần giữ: không có đường nào trong action đăng ký trả session hay cho client chọn mật khẩu lúc tạo user.
// - Kết quả verify gần nhất: passed (39 test) bằng `npx vitest run __tests__/actions/auth.test.ts`.

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateServiceRoleClient = vi.mocked(createServiceRoleClient);
const mockedRedirect = vi.mocked(redirect);

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEUTRAL_SIGNUP_RESULT = { success: true, needsEmailConfirmation: true };
const RESEND_RESULT = {
  success: true,
  message: "Nếu email này đang chờ xác minh, mail mới sẽ tới trong vài phút.",
};

function authError(code: string, status = 400) {
  return { code, status, message: code };
}

function mockSessionClient(overrides: Record<string, unknown> = {}) {
  const auth = {
    resend: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: userId, app_metadata: {} } },
      error: null,
    }),
    getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "otp" }] } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    ...overrides,
  };
  mockedCreateClient.mockResolvedValue({ auth, storage: { from: vi.fn() } } as never);
  return auth;
}

function mockServiceClient({
  existingProfile = null as unknown,
  profileError = null as unknown,
  createError = null as unknown,
  flagError = null as unknown,
} = {}) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data: existingProfile, error: profileError });
  const admin = {
    createUser: vi.fn().mockResolvedValue({ data: { user: null }, error: createError }),
    updateUserById: vi.fn().mockResolvedValue({ data: {}, error: flagError }),
  };
  const from = vi.fn(() => query);
  mockedCreateServiceRoleClient.mockReturnValue({ from, auth: { admin } } as never);
  return { from, query, admin };
}

function mockSignupSettings(response: unknown) {
  const fetchMock =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue({ ok: true, json: async () => response });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function registrationForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    username: "learner01",
    email: "learner@example.com",
    full_name: "Nguyễn Văn A",
    phone: "0912345678",
    dob: "2000-01-01T00:00:00.000Z",
    gender: "nam",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) formData.append(key, value);
  return formData;
}

function passwordForm(password = "abc123", confirmPassword = password) {
  const formData = new FormData();
  formData.append("password", password);
  formData.append("confirmPassword", confirmPassword);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signUpUser", () => {
  it("creates an unconfirmed marked user with a random password, then sends the mail", async () => {
    mockSignupSettings({ disable_signup: false });
    const auth = mockSessionClient();
    const { admin } = mockServiceClient();

    const result = await signUpUser(registrationForm());

    expect(result).toEqual(NEUTRAL_SIGNUP_RESULT);
    expect(admin.createUser).toHaveBeenCalledTimes(1);
    const payload = admin.createUser.mock.calls[0][0];
    expect(payload).toMatchObject({
      email: "learner@example.com",
      email_confirm: false,
      app_metadata: { d7_server_created: true },
      user_metadata: { username: "learner01", full_name: "Nguyễn Văn A", gender: "nam" },
    });
    expect(payload.password).toMatch(/[a-z]/);
    expect(payload.password).toMatch(/[A-Z]/);
    expect(payload.password).toMatch(/[0-9]/);
    expect(payload.password).toMatch(/[^A-Za-z0-9]/);
    expect(payload.password.length).toBeGreaterThanOrEqual(40);
    expect(JSON.stringify(result)).not.toContain(payload.password);
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "learner@example.com" });
    expect(admin.createUser.mock.invocationCallOrder[0]).toBeLessThan(
      auth.resend.mock.invocationCallOrder[0],
    );
  });

  it("uses a different random password on every call", async () => {
    mockSignupSettings({ disable_signup: false });
    mockSessionClient();
    const { admin } = mockServiceClient();

    await signUpUser(registrationForm());
    await signUpUser(registrationForm());

    const [first, second] = admin.createUser.mock.calls.map(([payload]) => payload.password);
    expect(first).not.toBe(second);
  });

  it("ignores a password sent by the client", async () => {
    mockSignupSettings({ disable_signup: false });
    mockSessionClient();
    const { admin } = mockServiceClient();

    await signUpUser(registrationForm({ password: "Attacker-123!" }));

    expect(admin.createUser.mock.calls[0][0].password).not.toBe("Attacker-123!");
  });

  it.each([
    ["email_exists", authError("email_exists", 422)],
    ["a save failure", authError("unexpected_failure", 500)],
    ["another error", authError("weak_password", 422)],
  ])("returns the neutral result and still resends when createUser reports %s", async (_label, error) => {
    mockSignupSettings({ disable_signup: false });
    const auth = mockSessionClient();
    mockServiceClient({ createError: error });

    await expect(signUpUser(registrationForm())).resolves.toEqual(NEUTRAL_SIGNUP_RESULT);
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "learner@example.com" });
  });

  it.each([
    ["a rate limit", authError("over_email_send_rate_limit", 429)],
    ["another error", authError("unexpected_failure", 500)],
  ])("returns the neutral result when resend reports %s", async (_label, error) => {
    mockSignupSettings({ disable_signup: false });
    mockSessionClient({ resend: vi.fn().mockResolvedValue({ data: {}, error }) });
    mockServiceClient();

    await expect(signUpUser(registrationForm())).resolves.toEqual(NEUTRAL_SIGNUP_RESULT);
  });

  it("rejects a taken username without creating a user or sending mail", async () => {
    mockSignupSettings({ disable_signup: false });
    const auth = mockSessionClient();
    const { admin } = mockServiceClient({ existingProfile: { id: userId } });

    await expect(signUpUser(registrationForm())).resolves.toEqual({
      error: "Username đã được dùng, hãy thử username khác.",
    });
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it("returns the generic retry message when the username check fails", async () => {
    mockSignupSettings({ disable_signup: false });
    mockSessionClient();
    const { admin } = mockServiceClient({ profileError: { message: "db down" } });

    await expect(signUpUser(registrationForm())).resolves.toEqual({
      error: "Đăng ký chưa thành công, vui lòng thử lại.",
    });
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it("rejects invalid input before any Supabase or settings call", async () => {
    const fetchMock = mockSignupSettings({ disable_signup: false });
    mockSessionClient();
    const { from, admin } = mockServiceClient();

    const result = await signUpUser(registrationForm({ email: "not-an-email" }));

    expect(result).toHaveProperty("error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it.each([
    ["sign-ups are disabled", { disable_signup: true }],
    ["the field is missing", {}],
    ["the settings fetch fails", new Error("network")],
  ])("fails closed when %s", async (_label, settings) => {
    const fetchMock = mockSignupSettings(settings);
    const auth = mockSessionClient();
    const { admin } = mockServiceClient();

    await expect(signUpUser(registrationForm())).resolves.toEqual({
      error: "Đăng ký tạm thời chưa khả dụng",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/v1\/settings$/),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it.each([
    ["the settings response is not OK", { ok: false, json: async () => ({ disable_signup: false }) }],
    [
      "the settings body is not JSON",
      {
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      },
    ],
  ])("fails closed when %s", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const auth = mockSessionClient();
    const { admin } = mockServiceClient();

    await expect(signUpUser(registrationForm())).resolves.toEqual({
      error: "Đăng ký tạm thời chưa khả dụng",
    });
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(auth.resend).not.toHaveBeenCalled();
  });
});

describe("resendSignupConfirmation", () => {
  it.each([
    ["success", null],
    ["an error", authError("unexpected_failure", 500)],
    ["a rate limit", authError("over_email_send_rate_limit", 429)],
  ])("returns the same message on %s", async (_label, error) => {
    const auth = mockSessionClient({ resend: vi.fn().mockResolvedValue({ data: {}, error }) });

    await expect(resendSignupConfirmation("learner@example.com")).resolves.toEqual(RESEND_RESULT);
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "learner@example.com" });
  });

  it("returns the same message for an invalid email without calling Supabase", async () => {
    const auth = mockSessionClient();

    await expect(resendSignupConfirmation("nope")).resolves.toEqual(RESEND_RESULT);
    expect(auth.resend).not.toHaveBeenCalled();
  });
});

describe("signInUser", () => {
  function loginForm(email: string, password: string) {
    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    return formData;
  }

  it("rejects invalid input without calling Supabase", async () => {
    const auth = mockSessionClient();

    await expect(signInUser(loginForm("nope", ""))).resolves.toEqual({ error: "Sai email hoặc mật khẩu!" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns one message for any Supabase error", async () => {
    mockSessionClient({
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: authError("email_not_confirmed") }),
    });

    await expect(signInUser(loginForm("learner@example.com", "abc123"))).resolves.toEqual({
      error: "Sai email hoặc mật khẩu!",
    });
  });
});

describe("setPasswordAfterConfirmation", () => {
  it("updates the password on the otp session, then sets the flag and redirects home", async () => {
    const auth = mockSessionClient();
    const { admin } = mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "abc123" });
    expect(admin.updateUserById).toHaveBeenCalledWith(userId, { app_metadata: { d7_password_set: true } });
    expect(auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      admin.updateUserById.mock.invocationCallOrder[0],
    );
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it("accepts amr in its plain string form", async () => {
    const auth = mockSessionClient({
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: ["otp"] } }, error: null }),
    });
    mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "abc123" });
  });

  it("still redirects home when only the flag write fails, logging the error code", async () => {
    const auth = mockSessionClient();
    mockServiceClient({ flagError: authError("unexpected_failure", 500) });

    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "abc123" });
    expect(console.error).toHaveBeenCalledWith(
      "setPasswordAfterConfirmation flag failed:",
      "unexpected_failure",
    );
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it.each([
    ["a password session", { getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "password" }] } }, error: null }) }],
    ["an oauth session", { getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "oauth" }] } }, error: null }) }],
    [
      "an already flagged user",
      {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId, app_metadata: { d7_password_set: true } } },
          error: null,
        }),
      },
    ],
    ["a signed-out visitor", { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: authError("no_session", 401) }) }],
    ["a session without amr", { getClaims: vi.fn().mockResolvedValue({ data: { claims: {} }, error: null }) }],
    ["unreadable claims", { getClaims: vi.fn().mockResolvedValue({ data: null, error: authError("bad_jwt", 401) }) }],
  ])("refuses %s without calling updateUser", async (_label, overrides) => {
    const auth = mockSessionClient(overrides);
    const { admin } = mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).resolves.toEqual({
      error: "Phiên xác minh không còn hợp lệ để đặt mật khẩu. Vui lòng đăng nhập lại.",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(admin.updateUserById).not.toHaveBeenCalled();
  });

  it("returns a generic retryable message when updateUser fails", async () => {
    mockSessionClient({
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: authError("same_password", 422) }),
    });
    const { admin } = mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).resolves.toEqual({
      error: "Chưa đặt được mật khẩu, vui lòng thử lại.",
    });
    expect(admin.updateUserById).not.toHaveBeenCalled();
  });

  it.each([
    ["a short password", passwordForm("abc12")],
    ["a mismatched confirmation", passwordForm("abc123", "abc124")],
  ])("rejects %s without calling Supabase", async (_label, formData) => {
    const auth = mockSessionClient();

    const result = await setPasswordAfterConfirmation(formData);

    expect(result).toHaveProperty("error");
    expect(mockedCreateClient).not.toHaveBeenCalled();
    expect(auth.getUser).not.toHaveBeenCalled();
  });
});

describe("/auth/set-password page guard", () => {
  it("renders the form for an otp session without the flag", async () => {
    mockSessionClient();

    await expect(SetPasswordPage()).resolves.toBeTruthy();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to /login", async () => {
    mockSessionClient({ getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) });

    await expect(SetPasswordPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockedRedirect).toHaveBeenCalledWith("/login");
  });

  it.each([
    ["password", { getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "password" }] } }, error: null }) }],
    ["oauth", { getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "oauth" }] } }, error: null }) }],
    [
      "already flagged",
      {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId, app_metadata: { d7_password_set: true } } },
          error: null,
        }),
      },
    ],
  ])("sends a %s session home", async (_label, overrides) => {
    mockSessionClient(overrides);

    await expect(SetPasswordPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });
});
