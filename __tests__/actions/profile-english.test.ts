import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUserProfile, updateUserPassword, updateUserProfile, uploadAvatar } from "@/app/actions/profile";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import type { Locale } from "@/lib/i18n/config";

// Test plan:
// - Mục tiêu: English localization U2 AC3 - mọi đường trả message của getUserProfile, updateUserProfile, uploadAvatar và
//   updateUserPassword trả đúng câu đã dịch theo ngôn ngữ của request; dạng trả về `{ error }` giữ nguyên.
// - Loại test: Server Action với next-intl thật (cấu hình request bản test chọn ngôn ngữ); Supabase bị mock.
// - Đối tượng: getUserProfile, updateUserProfile, uploadAvatar, updateUserPassword.
// - Case chính: từng message hằng (chưa đăng nhập, không thấy hồ sơ, lỗi hệ thống, username trùng/đã đặt, thiếu file, sai định dạng,
//   lỗi tải/đồng bộ ảnh, mật khẩu hiện tại sai, phiên cũ, đổi mật khẩu lỗi) ở cả vi (đúng nguyên văn cũ) và en.
// - Case biên: issue của schema (ngắn, giới tính sai, không khớp, trường thiếu → văn bản Zod cũ) trả câu đã dịch, và action trả
//   về trước mọi truy vấn DB/Auth đúng như trước khi dịch.
// - Giới hạn: không kiểm DB thật; __tests__/integration/profile-* giữ phần đó. Hai nhánh mật khẩu trùng/yếu của updateUserPassword
//   nằm trong auth-messages-i18n.test.ts.

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);
const mockedServiceRole = vi.mocked(createServiceRoleClient);
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const TEXT = {
  signIn: { vi: "Vui lòng đăng nhập", en: "Please sign in" },
  notFound: { vi: "Không tìm thấy hồ sơ người dùng", en: "We couldn't find your profile" },
  updateFailed: { vi: "Lỗi hệ thống khi cập nhật hồ sơ.", en: "Something went wrong while updating your profile." },
  usernameTaken: { vi: "Tên người dùng (Username) đã tồn tại!", en: "That username is already taken!" },
  usernameSet: {
    vi: "Username đã được thiết lập, vui lòng tải lại trang.",
    en: "Your username is already set. Please reload the page.",
  },
  noFile: { vi: "Không tìm thấy file tải lên", en: "No file was uploaded" },
  notImage: { vi: "Vui lòng tải lên định dạng hình ảnh hợp lệ", en: "Please upload a valid image file" },
  uploadFailed: { vi: "Lỗi tải ảnh lên hệ thống", en: "Couldn't upload your photo" },
  avatarSync: { vi: "Lỗi đồng bộ ảnh đại diện vào hồ sơ", en: "Couldn't save your photo to your profile" },
  currentWrong: { vi: "Mật khẩu hiện tại không chính xác!", en: "Your current password is incorrect!" },
  reauth: {
    vi: "Phiên đăng nhập đã cũ, bạn đăng nhập lại rồi thử nhé.",
    en: "Your session is too old. Please sign in again and retry.",
  },
  passwordFailed: { vi: "Chưa đổi được mật khẩu, vui lòng thử lại.", en: "Couldn't change your password. Please try again." },
  fullNameMin: { vi: "Họ tên phải có ít nhất 2 ký tự", en: "Your name must be at least 2 characters" },
  usernameMin: { vi: "Username phải từ 3 ký tự trở lên", en: "Username must be at least 3 characters" },
  genderInvalid: { vi: "Giới tính không hợp lệ.", en: "Please choose a valid gender." },
  currentMin: { vi: "Mật khẩu hiện tại quá ngắn", en: "Your current password is too short" },
  newMin: { vi: "Mật khẩu mới phải từ 6 ký tự", en: "Your new password must be at least 6 characters" },
  mismatch: { vi: "Mật khẩu xác nhận không khớp", en: "The passwords don't match" },
  // Văn bản Zod mặc định của trường thiếu: không dịch, giữ đúng như trước khi chuyển sang khóa (G2).
  missingString: {
    vi: "Invalid input: expected string, received undefined",
    en: "Invalid input: expected string, received undefined",
  },
} as const;

const LOCALES: Locale[] = ["vi", "en"];

describe.each(LOCALES)("profile actions in %s", (locale) => {
  const text = (key: keyof typeof TEXT) => TEXT[key][locale];

  beforeEach(() => {
    vi.clearAllMocks();
    setServerTestLocale(locale);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setServerTestLocale("vi");
  });

  function mockAuthOnly(user: { id: string; email?: string } | null) {
    const auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    };
    const from = vi.fn();
    mockedCreateClient.mockResolvedValue({ auth, from } as never);
    return { auth, from };
  }

  describe("getUserProfile", () => {
    it("asks a signed-out caller to sign in before any service-role read", async () => {
      mockAuthOnly(null);
      await expect(getUserProfile()).resolves.toEqual({ error: text("signIn") });
      expect(mockedServiceRole).not.toHaveBeenCalled();
    });

    it("reports a missing or soft-deleted own row", async () => {
      mockAuthOnly({ id: userId });
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const method of ["select", "eq", "is"]) query[method] = vi.fn(() => query);
      query.single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
      mockedServiceRole.mockReturnValue({ from: vi.fn(() => query) } as never);
      await expect(getUserProfile()).resolves.toEqual({ error: text("notFound") });
    });
  });

  describe("updateUserProfile", () => {
    const valid = { full_name: "An Nguyen", username: "", dob: "", gender: "" };

    // `read` là select("username").eq().single(); `write` là update(...).eq(...).select("id") (có thể thêm .is()).
    function mockProfiles(
      read: { data: { username: string | null } | null; error?: unknown },
      write: { data?: { id: string }[] | null; error?: unknown } = { data: [{ id: userId }] },
    ) {
      const updates: Record<string, unknown>[] = [];
      const from = vi.fn(() => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: read.data, error: read.error ?? null }) }) }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          const chain = {
            eq: () => chain,
            is: () => chain,
            select: async () => ({ data: write.data ?? null, error: write.error ?? null }),
          };
          return chain;
        },
      }));
      mockedCreateClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
        from,
      } as never);
      return { from, updates };
    }

    it("asks a signed-out caller to sign in without any database call", async () => {
      const { from } = mockAuthOnly(null);
      await expect(updateUserProfile(valid)).resolves.toEqual({ error: text("signIn") });
      expect(from).not.toHaveBeenCalled();
    });

    it.each([
      ["a full name under 2 characters", { ...valid, full_name: "A" }, "fullNameMin"],
      ["a username under 3 characters", { ...valid, username: "ab" }, "usernameMin"],
      ["an unknown gender", { ...valid, gender: "nam" }, "genderInvalid"],
      ["a gender of the wrong type", { ...valid, gender: 1 }, "genderInvalid"],
      ["a missing full name", { username: "", dob: "", gender: "" }, "missingString"],
    ] as const)("returns the translated schema issue for %s before any database call", async (_label, input, key) => {
      const { from } = mockProfiles({ data: { username: null } });
      await expect(updateUserProfile(input)).resolves.toEqual({ error: text(key) });
      expect(from).not.toHaveBeenCalled();
    });

    it.each([
      ["the read fails", { data: null, error: { code: "XX000" } }, undefined, "updateFailed"],
      ["the read finds no row", { data: null }, undefined, "updateFailed"],
      ["the first set hits a unique violation", { data: { username: null } }, { data: null, error: { code: "23505" } }, "usernameTaken"],
      ["the first set fails otherwise", { data: { username: null } }, { data: null, error: { code: "XX000" } }, "updateFailed"],
      ["the first set writes no row", { data: { username: null } }, { data: [] }, "usernameSet"],
    ] as const)("returns the translated message when %s", async (_label, read, write, key) => {
      mockProfiles(read as never, write as never);
      await expect(updateUserProfile({ ...valid, username: "my_name" })).resolves.toEqual({ error: text(key) });
    });

    it("returns the system error when the ordinary update writes no row", async () => {
      mockProfiles({ data: { username: "existing" } }, { data: [] });
      await expect(updateUserProfile(valid)).resolves.toEqual({ error: text("updateFailed") });
    });

    it("still succeeds with the same shape", async () => {
      mockProfiles({ data: { username: null } });
      await expect(updateUserProfile({ ...valid, username: "my_name" })).resolves.toEqual({ success: true });
    });
  });

  describe("uploadAvatar", () => {
    function mockStorage(options: { uploadError?: unknown; updateError?: unknown } = {}) {
      const upload = vi.fn().mockResolvedValue({ error: options.uploadError ?? null });
      const update = vi.fn(() => ({ eq: async () => ({ error: options.updateError ?? null }) }));
      mockedCreateClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
        storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: "https://example.test/a.png" } }) }) },
        from: () => ({ update }),
      } as never);
      return { upload, update };
    }
    const form = (file?: File) => {
      const data = new FormData();
      if (file) data.append("avatar", file);
      return data;
    };
    const png = () => new File(["x"], "a.png", { type: "image/png" });

    it("asks a signed-out caller to sign in without touching Storage", async () => {
      const { from } = mockAuthOnly(null);
      await expect(uploadAvatar(form(png()))).resolves.toEqual({ error: text("signIn") });
      expect(from).not.toHaveBeenCalled();
    });

    it("reports a missing file and a non-image file before any upload", async () => {
      const { upload } = mockStorage();
      await expect(uploadAvatar(form())).resolves.toEqual({ error: text("noFile") });
      await expect(uploadAvatar(form(new File(["x"], "a.txt", { type: "text/plain" })))).resolves.toEqual({
        error: text("notImage"),
      });
      expect(upload).not.toHaveBeenCalled();
    });

    it("reports a failed upload and a failed profile sync", async () => {
      mockStorage({ uploadError: { message: "raw" } });
      await expect(uploadAvatar(form(png()))).resolves.toEqual({ error: text("uploadFailed") });
      mockStorage({ updateError: { message: "raw" } });
      await expect(uploadAvatar(form(png()))).resolves.toEqual({ error: text("avatarSync") });
    });

    it("still succeeds with the same shape", async () => {
      mockStorage();
      await expect(uploadAvatar(form(png()))).resolves.toEqual({ success: true, avatarUrl: "https://example.test/a.png" });
    });
  });

  describe("updateUserPassword", () => {
    const valid = { currentPassword: "old-pass-1", newPassword: "new-pass-1", confirmPassword: "new-pass-1" };

    it("asks a signed-out caller to sign in without calling Auth mutations", async () => {
      const { auth } = mockAuthOnly(null);
      await expect(updateUserPassword(valid)).resolves.toEqual({ error: text("signIn") });
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it.each([
      ["a short current password", { ...valid, currentPassword: "abc" }, "currentMin"],
      ["a short new password", { ...valid, newPassword: "abc", confirmPassword: "abc" }, "newMin"],
      ["a mismatched confirmation", { ...valid, confirmPassword: "other-pass-1" }, "mismatch"],
      ["a missing current password", { newPassword: "new-pass-1", confirmPassword: "new-pass-1" }, "missingString"],
    ] as const)("returns the translated schema issue for %s before any Auth call", async (_label, input, key) => {
      const { auth } = mockAuthOnly({ id: userId, email: "a@example.test" });
      await expect(updateUserPassword(input)).resolves.toEqual({ error: text(key) });
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
      expect(auth.updateUser).not.toHaveBeenCalled();
    });

    it("reports a wrong current password at sign-in without calling updateUser", async () => {
      const { auth } = mockAuthOnly({ id: userId, email: "a@example.test" });
      auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials", message: "raw" } });
      await expect(updateUserPassword(valid)).resolves.toEqual({ error: text("currentWrong") });
      expect(auth.updateUser).not.toHaveBeenCalled();
    });

    it.each([
      ["current_password_invalid", "currentWrong"],
      ["current_password_required", "currentWrong"],
      ["reauthentication_needed", "reauth"],
      ["unexpected_failure", "passwordFailed"],
    ] as const)("maps updateUser error %s to the translated message", async (code, key) => {
      const { auth } = mockAuthOnly({ id: userId, email: "a@example.test" });
      auth.updateUser.mockResolvedValue({ data: {}, error: { code, status: 400, message: "raw" } });
      await expect(updateUserPassword(valid)).resolves.toEqual({ error: text(key) });
    });
  });
});
