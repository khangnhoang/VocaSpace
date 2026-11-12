import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import {
  resendSignupConfirmation,
  requestPasswordRecovery,
  setPasswordAfterConfirmation,
  signInUser,
  signUpUser,
} from "@/app/actions/auth";
import SetPasswordPage from "@/app/auth/set-password/page";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/utils/supabase/server";
import { getPasswordSetupEligibility } from "@/lib/auth/password-setup";

// Test plan:
// - Mục tiêu: bảo vệ đăng ký A1/A1b và ngoại lệ recovery A2 theo session, không nới quyền của session khác.
// - Loại test: Server Action + server page unit test với Supabase boundary mock.
// - Đối tượng: signUpUser, resendSignupConfirmation, requestPasswordRecovery, signInUser, setPasswordAfterConfirmation, /auth/set-password.
// - Case thành công: sign-up tạo user email_confirm=false có marker và mật khẩu ngẫu nhiên rồi gửi mail; session `otp`
//   chưa có marker đặt được mật khẩu, sau đó bảng user_password_setups được ghi; app không còn đọc/ghi cờ d7_password_set (A5 AUTH-015).
// - Case thất bại: mọi lỗi createUser/resend trả cùng kết quả trung tính; username trùng hoặc đọc lỗi không tạo user;
//   công tắc đăng ký tắt/không đọc được thì không tạo user; input sai không gọi Supabase.
// - Bảo mật/phân quyền: G4, G5 (recovery trung tính cả 429/input sai/lỗi, không redirectTo/log email), G8/G8-R:
//   ma trận amr × marker × bằng chứng chỉ cho otp chưa đặt hoặc khớp session qua cả action và page.
// - Ổn định/resilience: đọc marker lỗi thì từ chối; ghi bảng lỗi chỉ log rồi redirect; trùng khóa không sửa marker;
//   cờ legacy bị bỏ qua (không đọc, không ghi); consume sau marker và scope user_id/session_id; consume lỗi vẫn redirect;
//   session quá 24 giờ (A2b, reauthentication_needed) báo xin link mới, không ghi marker, không consume.
// - U3 AC6/AC7 (signInUser): thành công trả `redirectTo` lấy từ cookie trang đích do proxy ghi (kiểm tra lại allowlist,
//   sai thì `/`), xoá cookie đó và ghi cách đăng nhập `email`; trường form next/redirect_to/redirectTo không được đọc;
//   thất bại không đụng cookie; Secure theo x-forwarded-proto hoặc Origin.
// - Invariant cần giữ: không có đường nào trong action đăng ký trả session hay cho client chọn mật khẩu lúc tạo user.
// - Kết quả verify gần nhất: xem milestone A5 CP1 trong progress.md (`npm run test:run -- __tests__/actions/auth.test.ts`).

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));
const cookieJar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: [] as Array<{ name: string; value: string; options: Record<string, unknown> }>,
  headers: new Headers(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieJar.values.has(name) ? { name, value: cookieJar.values.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieJar.set.push({ name, value, options });
    },
  })),
  headers: vi.fn(async () => cookieJar.headers),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateServiceRoleClient = vi.mocked(createServiceRoleClient);
const mockedRedirect = vi.mocked(redirect);

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NEUTRAL_SIGNUP_RESULT = { success: true, needsEmailConfirmation: true };
const RESEND_RESULT = {
  success: true,
  message: "Mail xác minh mới sẽ tới trong vài phút, bạn kiểm tra cả mục Spam nhé!",
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
    getClaims: vi.fn().mockResolvedValue({ data: { claims: { session_id: sessionId, amr: [{ method: "otp" }] } }, error: null }),
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
  setup = null as unknown,
  setupReadError = null as unknown,
  setupInsertError = null as unknown,
  recovery = null as unknown,
  recoveryReadError = null as unknown,
  recoveryDeleteError = null as unknown,
} = {}) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data: existingProfile, error: profileError });
  const admin = {
    createUser: vi.fn().mockResolvedValue({ data: { user: null }, error: createError }),
    updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  const setupQuery = {
    select: vi.fn(() => setupQuery),
    eq: vi.fn(() => setupQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: setup, error: setupReadError }),
    insert: vi.fn().mockResolvedValue({ error: setupInsertError }),
  };
  const recoveryQuery = {
    select: vi.fn(() => recoveryQuery),
    eq: vi.fn(() => recoveryQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: recovery, error: recoveryReadError }),
    delete: vi.fn(() => recoveryQuery),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: recoveryDeleteError }).then(resolve),
  };
  const from = vi.fn((table: string) => table === "user_password_setups" ? setupQuery
    : table === "user_password_recoveries" ? recoveryQuery : query);
  mockedCreateServiceRoleClient.mockReturnValue({ from, auth: { admin } } as never);
  return { from, query, admin, setupQuery, recoveryQuery };
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
    gender: "male",
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
  cookieJar.values.clear();
  cookieJar.set.length = 0;
  cookieJar.headers = new Headers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockServiceClient();
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
      user_metadata: { username: "learner01", full_name: "Nguyễn Văn A", gender: "male" },
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

describe("requestPasswordRecovery", () => {
  const result = {
    success: true,
    message: "Đã gửi yêu cầu! Bạn kiểm tra hộp thư (cả mục Spam) trong vài phút nhé.",
  };
  it.each([null, authError("over_email_send_rate_limit", 429), authError("unexpected_failure", 500)])(
    "returns the neutral result for success or Supabase error %j without redirect options or email logs", async (error) => {
      const resetPasswordForEmail = vi.fn().mockResolvedValue({ error });
      mockSessionClient({ resetPasswordForEmail });
      await expect(requestPasswordRecovery("learner@example.com")).resolves.toEqual(result);
      expect(resetPasswordForEmail).toHaveBeenCalledWith("learner@example.com");
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("learner@example.com");
    },
  );
  it("returns the same result for malformed input without creating a client", async () => {
    await expect(requestPasswordRecovery("nope")).resolves.toEqual(result);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
  it("returns the same result when the provider throws without logging the payload", async () => {
    mockSessionClient({ resetPasswordForEmail: vi.fn().mockRejectedValue(new Error("learner@example.com")) });
    await expect(requestPasswordRecovery("learner@example.com")).resolves.toEqual(result);
    expect(console.error).toHaveBeenCalledWith("requestPasswordRecovery failed:", "unexpected_failure");
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
    expect(cookieJar.set).toEqual([]);
  });

  it("returns the stored return path, clears it and records the email method", async () => {
    mockSessionClient();
    cookieJar.values.set("vs_return_to", "/profile/orders");
    cookieJar.headers = new Headers({ "x-forwarded-proto": "https" });

    await expect(signInUser(loginForm("learner@example.com", "abc123"))).resolves.toEqual({
      success: true,
      redirectTo: "/profile/orders",
    });
    expect(cookieJar.set).toEqual([
      { name: "vs_return_to", value: "", options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 0 } },
      {
        name: "vs_last_sign_in",
        value: "email",
        options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 180 * 24 * 60 * 60 },
      },
    ]);
  });

  it.each([
    ["no stored path", undefined],
    ["an external URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a non-allowlisted page", "/learn/x"],
  ])("returns the home page for %s", async (_label, stored) => {
    mockSessionClient();
    if (stored !== undefined) cookieJar.values.set("vs_return_to", stored);

    await expect(signInUser(loginForm("learner@example.com", "abc123"))).resolves.toEqual({
      success: true,
      redirectTo: "/",
    });
    expect(cookieJar.set.map((cookie) => cookie.name)).toEqual(["vs_return_to", "vs_last_sign_in"]);
  });

  it("ignores client-sent next, redirect_to and redirectTo fields", async () => {
    mockSessionClient();
    const form = loginForm("learner@example.com", "abc123");
    form.append("next", "/admin");
    form.append("redirect_to", "https://evil.example");
    form.append("redirectTo", "//evil.example");

    await expect(signInUser(form)).resolves.toEqual({ success: true, redirectTo: "/" });
  });

  it("omits Secure without an HTTPS forwarded protocol or origin", async () => {
    mockSessionClient();
    cookieJar.headers = new Headers({ origin: "http://127.0.0.1:3100" });

    await signInUser(loginForm("learner@example.com", "abc123"));

    expect(cookieJar.set.every((cookie) => cookie.options.secure === false)).toBe(true);
  });

  it("leaves both cookies untouched when the input is invalid", async () => {
    mockSessionClient();
    cookieJar.values.set("vs_return_to", "/profile");

    await signInUser(loginForm("nope", ""));

    expect(cookieJar.set).toEqual([]);
  });
});

describe("setPasswordAfterConfirmation", () => {
  it("updates the otp password, inserts the marker, never writes the legacy flag and redirects home", async () => {
    const auth = mockSessionClient();
    const { admin, from, setupQuery } = mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "abc123" });
    expect(from).toHaveBeenCalledWith("user_password_setups");
    expect(setupQuery.select).toHaveBeenCalledWith("user_id");
    expect(setupQuery.eq).toHaveBeenCalledWith("user_id", userId);
    expect(setupQuery.insert).toHaveBeenCalledWith({ user_id: userId });
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      setupQuery.insert.mock.invocationCallOrder[0],
    );
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it("ignores a legacy d7_password_set flag: an otp session without a setup row may still set its password", async () => {
    const auth = mockSessionClient({
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, app_metadata: { d7_password_set: true } } },
        error: null,
      }),
    });
    const { admin, setupQuery } = mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "abc123" });
    expect(setupQuery.insert).toHaveBeenCalledWith({ user_id: userId });
    expect(admin.updateUserById).not.toHaveBeenCalled();
  });

  it("accepts amr in its plain string form", async () => {
    const auth = mockSessionClient({
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: ["otp"] } }, error: null }),
    });
    mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "abc123" });
  });

  it("logs the error code and still redirects when the marker insert fails, with no legacy fallback write", async () => {
    mockSessionClient();
    const { admin } = mockServiceClient({ setupInsertError: { code: "08006" } });

    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(console.error).toHaveBeenCalledWith("setPasswordAfterConfirmation marker insert failed:", "08006");
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it("treats a duplicate marker as already persisted without logging", async () => {
    mockSessionClient();
    const { admin } = mockServiceClient({ setupInsertError: { code: "23505" } });

    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(console.error).not.toHaveBeenCalled();
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it.each([
    ["a persisted row without recovery evidence", { setup: { user_id: userId } }],
    ["an unreadable marker table", { setupReadError: { code: "08006" } }],
  ])("refuses %s without changing the password or writing the marker", async (_label, options) => {
    const auth = mockSessionClient();
    const { admin, setupQuery } = mockServiceClient(options);

    await expect(setPasswordAfterConfirmation(passwordForm())).resolves.toEqual({
      error: "Phiên xác minh không còn hợp lệ để đặt mật khẩu. Vui lòng đăng nhập lại.",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(setupQuery.insert).not.toHaveBeenCalled();
    expect(admin.updateUserById).not.toHaveBeenCalled();
  });

  it.each([
    ["a password session", { getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "password" }] } }, error: null }) }],
    ["an oauth session", { getClaims: vi.fn().mockResolvedValue({ data: { claims: { amr: [{ method: "oauth" }] } }, error: null }) }],
    ["a signed-out visitor", { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: authError("no_session", 401) }) }],
    ["a session without amr", { getClaims: vi.fn().mockResolvedValue({ data: { claims: {} }, error: null }) }],
    ["unreadable claims", { getClaims: vi.fn().mockResolvedValue({ data: null, error: authError("bad_jwt", 401) }) }],
  ])("refuses %s without calling updateUser", async (_label, overrides) => {
    const auth = mockSessionClient(overrides);
    const { admin, setupQuery } = mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).resolves.toEqual({
      error: "Phiên xác minh không còn hợp lệ để đặt mật khẩu. Vui lòng đăng nhập lại.",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(setupQuery.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["same_password", 422, "Mật khẩu mới phải khác mật khẩu cũ."],
    ["weak_password", 422, "Mật khẩu này quá yếu hoặc dễ đoán, hãy chọn mật khẩu khác."],
    ["reauthentication_needed", 400, "Phiên xác minh đã quá 24 giờ. Bạn yêu cầu link mới ở trang Quên mật khẩu nhé."],
    ["unexpected_failure", 500, "Chưa đặt được mật khẩu, vui lòng thử lại."],
  ])("maps updateUser error %s to its message without writing the marker or consuming evidence", async (code, status, message) => {
    mockSessionClient({
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: authError(code, status) }),
    });
    const { admin, setupQuery, recoveryQuery } = mockServiceClient();

    await expect(setPasswordAfterConfirmation(passwordForm())).resolves.toEqual({ error: message });
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(setupQuery.insert).not.toHaveBeenCalled();
    expect(recoveryQuery.delete).not.toHaveBeenCalled();
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

describe("A2 recovery eligibility and consume", () => {
  for (const method of ["otp", "password", "oauth"]) {
    // "legacy" = cờ app_metadata cũ còn trên user nhưng không có row: A5 bỏ qua cờ, nên giống "none".
    for (const marker of ["none", "row", "legacy"]) {
      for (const evidence of ["missing", "equal", "different", "read_error"]) {
        const allowed = method === "otp" && (marker !== "row" || evidence === "equal");
        it(`${method}, ${marker} marker, ${evidence} evidence is ${allowed ? "eligible" : "rejected"} at action and page`, async () => {
          const auth = mockSessionClient({
            getClaims: vi.fn().mockResolvedValue({ data: { claims: { session_id: sessionId, amr: [{ method }] } }, error: null }),
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, app_metadata: { d7_password_set: marker === "legacy" } } }, error: null }),
          });
          const { recoveryQuery } = mockServiceClient({
            setup: marker === "row" ? { user_id: userId } : null,
            recovery: evidence === "equal" ? { session_id: sessionId }
              : evidence === "different" ? { session_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" } : null,
            recoveryReadError: evidence === "read_error" ? { code: "08006" } : null,
          });
          if (allowed) {
            await expect(SetPasswordPage()).resolves.toBeTruthy();
            await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");
            expect(auth.updateUser).toHaveBeenCalledWith({ password: "abc123" });
            expect(recoveryQuery.delete).toHaveBeenCalledTimes(1);
            expect(recoveryQuery.eq).toHaveBeenCalledWith("user_id", userId);
            expect(recoveryQuery.eq).toHaveBeenCalledWith("session_id", sessionId);
          } else {
            await expect(SetPasswordPage()).rejects.toThrow("NEXT_REDIRECT");
            expect(mockedRedirect).toHaveBeenCalledWith("/");
            await expect(setPasswordAfterConfirmation(passwordForm())).resolves.toHaveProperty("error");
            expect(auth.updateUser).not.toHaveBeenCalled();
            expect(recoveryQuery.delete).not.toHaveBeenCalled();
          }
        });
      }
    }
  }
  it("fails closed when the setup table cannot be read even with matching recovery evidence", async () => {
    mockSessionClient();
    mockServiceClient({ setupReadError: { code: "08006" }, recovery: { session_id: sessionId } });
    const supabase = await createClient();
    await expect(getPasswordSetupEligibility(supabase)).resolves.toEqual({ status: "not_eligible" });
  });
  it("consumes only after the password update and marker write, and still redirects when evidence deletion fails", async () => {
    const auth = mockSessionClient();
    const { setupQuery, recoveryQuery } = mockServiceClient({
      setup: { user_id: userId }, recovery: { session_id: sessionId }, recoveryDeleteError: { code: "08006" },
    });
    await expect(setPasswordAfterConfirmation(passwordForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(recoveryQuery.delete.mock.invocationCallOrder[0]);
    expect(setupQuery.insert.mock.invocationCallOrder[0]).toBeLessThan(recoveryQuery.delete.mock.invocationCallOrder[0]);
    expect(console.error).toHaveBeenCalledWith("consumePasswordRecovery failed:", "08006");
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });
});

describe("/auth/set-password page guard", () => {
  it.each([
    ["a persisted row without recovery evidence", { setup: { user_id: userId } }],
    ["a marker read failure", { setupReadError: { code: "08006" } }],
  ])("sends an otp session home with %s", async (_label, options) => {
    mockSessionClient();
    mockServiceClient(options);

    await expect(SetPasswordPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });

  it("renders the form for an otp session without a setup row", async () => {
    mockSessionClient();

    await expect(SetPasswordPage()).resolves.toBeTruthy();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it("renders the form for an otp session that only carries the legacy flag", async () => {
    mockSessionClient({
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, app_metadata: { d7_password_set: true } } },
        error: null,
      }),
    });

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
  ])("sends a %s session home", async (_label, overrides) => {
    mockSessionClient(overrides);

    await expect(SetPasswordPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockedRedirect).toHaveBeenCalledWith("/");
  });
});
