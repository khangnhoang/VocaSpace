import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signUpUser } from "@/app/actions/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";

// Test plan:
// - Mục tiêu: English localization U1 AC4 - `signUpUser` trả lỗi registerSchema theo ngôn ngữ của request khi FormData bị
//   gửi thẳng tới action (bỏ qua validate ở client).
// - Loại test: Server Action với next-intl thật (cấu hình request bản test chọn ngôn ngữ); Supabase và fetch bị mock.
// - Đối tượng: signUpUser, registerSchema.
// - Case thất bại: từng trường thiếu, sai kiểu (trường bị bỏ khỏi FormData nên `get()` trả null) và sai định dạng trả
//   `{ error }` là câu đã dịch của lỗi đầu tiên, ở cả tiếng Việt (đúng nguyên văn cũ) và tiếng Anh; không đọc công tắc
//   đăng ký và không tạo client service-role.
// - Invariant cần giữ: thiếu `dob` vẫn qua schema vì action tạo ngày epoch như trước U1 và đi tiếp tới bước kiểm tra
//   công tắc đăng ký; ngày không hợp lệ trả lỗi ngày sinh.
// - Bảo mật/phân quyền: lỗi trả về trước mọi truy vấn, upload hay lời gọi Auth.

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const VALID = {
  username: "learner01",
  email: "learner@example.com",
  full_name: "Nguyễn Văn A",
  phone: "0912345678",
  dob: "2000-01-01",
  gender: "male",
};

function formDataWith(overrides: Partial<Record<keyof typeof VALID, string | null>>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({ ...VALID, ...overrides })) {
    if (value !== null) formData.append(key, value);
  }
  return formData;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  // Công tắc đăng ký đang đóng: dữ liệu qua được schema sẽ dừng ở đây với thông báo riêng, không tạo tài khoản.
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ disable_signup: true }), { status: 200 }));
});

afterEach(() => {
  setServerTestLocale("vi");
  vi.unstubAllGlobals();
});

const CASES: Array<{ name: string; overrides: Partial<Record<keyof typeof VALID, string | null>>; vi: string; en: string }> = [
  { name: "missing username", overrides: { username: null }, vi: "Tên tài khoản phải từ 3 ký tự trở lên", en: "Username must be at least 3 characters" },
  { name: "short username", overrides: { username: "ab" }, vi: "Tên tài khoản phải từ 3 ký tự trở lên", en: "Username must be at least 3 characters" },
  { name: "missing email", overrides: { email: null }, vi: "Email này không đúng định dạng", en: "This email address isn't valid" },
  { name: "malformed email", overrides: { email: "not-an-email" }, vi: "Email này không đúng định dạng", en: "This email address isn't valid" },
  { name: "missing full name", overrides: { full_name: null }, vi: "Vui lòng nhập họ và tên", en: "Please enter your full name" },
  { name: "one-letter full name", overrides: { full_name: "A" }, vi: "Vui lòng nhập họ và tên", en: "Please enter your full name" },
  { name: "missing phone", overrides: { phone: null }, vi: "Số điện thoại không hợp lệ", en: "Phone number isn't valid" },
  { name: "phone with letters", overrides: { phone: "09123abc78" }, vi: "Số điện thoại chỉ được chứa số", en: "Phone number can only contain digits" },
  { name: "short phone", overrides: { phone: "091234" }, vi: "Số điện thoại không hợp lệ", en: "Phone number isn't valid" },
  { name: "long phone", overrides: { phone: "091234567890" }, vi: "Số điện thoại quá dài", en: "Phone number is too long" },
  { name: "invalid date of birth", overrides: { dob: "not-a-date" }, vi: "Vui lòng chọn ngày sinh hợp lệ", en: "Please choose a valid date of birth" },
  { name: "missing gender", overrides: { gender: null }, vi: "Vui lòng chọn giới tính", en: "Please choose a gender" },
  { name: "unknown gender", overrides: { gender: "nam" }, vi: "Vui lòng chọn giới tính", en: "Please choose a gender" },
];

describe("signUpUser validation messages (English localization U1)", () => {
  it.each(CASES)("returns the Vietnamese message for $name before any side effect", async ({ overrides, vi: expected }) => {
    await expect(signUpUser(formDataWith(overrides))).resolves.toEqual({ error: expected });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it.each(CASES)("returns the English message for $name when the request is in English", async ({ overrides, en }) => {
    setServerTestLocale("en");
    await expect(signUpUser(formDataWith(overrides))).resolves.toEqual({ error: en });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it.each(["vi", "en"] as const)("still lets a missing date of birth past validation in %s (epoch date, as before U1)", async (locale) => {
    setServerTestLocale(locale);
    await expect(signUpUser(formDataWith({ dob: null }))).resolves.toEqual({ error: "Đăng ký tạm thời chưa khả dụng" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });
});
