// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@/__tests__/support/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChangePasswordForm from "@/app/(client)/profile/_components/change-pwd-form";
import EditProfileForm from "@/app/(client)/profile/_components/edit-profile-form";
import ProfileSidebar from "@/app/(client)/profile/_components/profile-sidebar";
import ProfilePage from "@/app/(client)/profile/page";
import type { UserProfileDTO } from "@/lib/schemas/profile";
import { setServerTestLocale } from "@/__tests__/support/i18n-request";
import type { Locale } from "@/lib/i18n/config";

// Test plan:
// - Mục tiêu: English localization U2 AC2/AC4 - thẻ hồ sơ, form sửa hồ sơ và form đổi mật khẩu của /profile hiện đúng ngôn ngữ đang dùng
//   (nhãn, placeholder, tùy chọn giới tính, thông báo lỗi dưới trường, toast, trạng thái chờ), và bản tiếng Việt giữ nguyên văn.
// - Loại test: component trong jsdom với provider next-intl thật; Server Action và sonner bị mock.
// - Đối tượng: ProfilePage (tiêu đề, lịch sử thanh toán rỗng của U5), ProfileSidebar (thẻ hồ sơ, tab, ảnh đại diện), EditProfileForm, ChangePasswordForm.
// - Case chính: từng chuỗi nhìn thấy ở cả vi và en; lỗi schema (ngắn, không khớp) hiện câu đã dịch dưới đúng trường; toast thành công.
// - Case biên: dữ liệu rỗng (tên, email, username) dùng chuỗi dự phòng đã dịch; lỗi server hiện nguyên chuỗi action đã dịch sẵn.
// - Giới hạn: trang chỉ kiểm lịch sử thanh toán ở trạng thái rỗng; các trạng thái khác của lịch sử (U5) kiểm ở payments-english.test.tsx;
//   kiểm tra "không còn chữ Việt" chỉ áp dụng cho phần U2 của /profile.

const mocks = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPassword: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/actions/profile", () => ({
  getUserProfile: mocks.getUserProfile,
  uploadAvatar: mocks.uploadAvatar,
  updateUserProfile: mocks.updateUserProfile,
  updateUserPassword: mocks.updateUserPassword,
}));
vi.mock("@/app/actions/payment-history", () => ({
  getPaymentHistory: vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, pageSize: 5 } }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const profile: UserProfileDTO = {
  id: "u1",
  email: "learner@example.com",
  phone: "",
  full_name: "An Nguyen",
  avatar_url: null,
  role: "student",
  username: null,
  dob: null,
  gender: null,
};

// Chữ có dấu thanh/mũ sau khi tách NFD, cộng đ/Đ: bắt cả chữ dựng sẵn như ớ, ế, ệ.
const hasVietnamese = (value: string) => /[̀-ͯđĐ]/.test(value.normalize("NFD"));

// Văn bản nhìn thấy cộng các thuộc tính người dùng đọc được (placeholder, alt, aria-label).
function readableText(container: HTMLElement) {
  const attributes = [...container.querySelectorAll("[placeholder],[alt],[aria-label]")].flatMap((element) =>
    ["placeholder", "alt", "aria-label"].map((name) => element.getAttribute(name) ?? ""),
  );
  return [container.textContent ?? "", ...attributes].join(" ");
}

const COPY = {
  vi: {
    title: "Quản lý tài khoản",
    historyTitle: "Lịch sử thanh toán",
    historyEmpty: "Bạn chưa có giao dịch thanh toán nào.",
    tabs: ["Hồ sơ cá nhân", "Bảo mật"],
    email: "Địa chỉ Email",
    phone: "Số điện thoại",
    notProvided: "Chưa cập nhật",
    fullName: "Họ và tên *",
    fullNamePlaceholder: "Nhập họ và tên đầy đủ",
    username: "Tên định danh (Username)",
    usernameHelp: "Bạn chỉ đặt được username một lần.",
    usernamePlaceholder: "Nhập username (từ 3 ký tự)",
    dob: "Ngày sinh",
    gender: "Giới tính",
    genderOptions: ["Chọn giới tính", "Nam", "Nữ", "Khác"],
    submit: "Lưu thay đổi",
    saved: "Đã lưu thông tin hồ sơ thành công!",
    fullNameMin: "Họ tên phải có ít nhất 2 ký tự",
    usernameMin: "Username phải từ 3 ký tự trở lên",
    pwLabels: ["Mật khẩu hiện tại *", "Mật khẩu mới *", "Xác nhận mật khẩu mới *"],
    pwPlaceholders: ["Nhập mật khẩu đang sử dụng", "Mật khẩu từ 6 ký tự trở lên", "Gõ lại chính xác mật khẩu mới"],
    pwSubmit: "Cập nhật mật khẩu",
    pwChanged: "Đổi mật khẩu tài khoản thành công!",
    currentMin: "Mật khẩu hiện tại quá ngắn",
    newMin: "Mật khẩu mới phải từ 6 ký tự",
    mismatch: "Mật khẩu xác nhận không khớp",
    avatarUpdated: "Cập nhật ảnh đại diện thành công!",
    uploadPhoto: "Tải ảnh",
    defaultName: "Học viên",
  },
  en: {
    title: "Account settings",
    historyTitle: "Payment history",
    historyEmpty: "You don't have any payments yet.",
    tabs: ["Profile", "Security"],
    email: "Email address",
    phone: "Phone number",
    notProvided: "Not provided",
    fullName: "Full name *",
    fullNamePlaceholder: "Enter your full name",
    username: "Username",
    usernameHelp: "You can only set your username once.",
    usernamePlaceholder: "Enter a username (at least 3 characters)",
    dob: "Date of birth",
    gender: "Gender",
    genderOptions: ["Select gender", "Male", "Female", "Other"],
    submit: "Save changes",
    saved: "Profile saved!",
    fullNameMin: "Your name must be at least 2 characters",
    usernameMin: "Username must be at least 3 characters",
    pwLabels: ["Current password *", "New password *", "Confirm new password *"],
    pwPlaceholders: ["Enter your current password", "At least 6 characters", "Re-enter your new password"],
    pwSubmit: "Update password",
    pwChanged: "Password changed!",
    currentMin: "Your current password is too short",
    newMin: "Your new password must be at least 6 characters",
    mismatch: "The passwords don't match",
    avatarUpdated: "Profile photo updated!",
    uploadPhoto: "Upload photo",
    defaultName: "Learner",
  },
} as const;

describe.each(["vi", "en"] as Locale[])("profile screens in %s", (locale) => {
  const copy = COPY[locale];

  beforeEach(() => {
    vi.clearAllMocks();
    setServerTestLocale(locale);
    mocks.getUserProfile.mockResolvedValue({ data: profile });
    mocks.updateUserProfile.mockResolvedValue({ success: true });
    mocks.updateUserPassword.mockResolvedValue({ success: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
  });
  afterEach(() => {
    cleanup();
    setServerTestLocale("vi");
  });

  it("shows the page title and the empty payment history", async () => {
    render(await ProfilePage({ searchParams: Promise.resolve({}) }), { locale });
    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeTruthy();
    expect((await screen.findAllByText(copy.historyEmpty)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.historyTitle).length).toBeGreaterThan(0);
  });

  describe("EditProfileForm", () => {
    const renderForm = (overrides: Partial<UserProfileDTO> = {}) =>
      render(<EditProfileForm initialData={{ ...profile, ...overrides }} onRefreshData={vi.fn()} />, { locale });

    it("shows every label, placeholder, helper and gender option", () => {
      const { container } = renderForm();
      for (const text of [copy.email, copy.phone, copy.fullName, copy.username, copy.usernameHelp, copy.dob, copy.gender, copy.submit]) {
        expect(screen.getByText(text), text).toBeTruthy();
      }
      expect(screen.getByPlaceholderText(copy.fullNamePlaceholder)).toBeTruthy();
      expect(screen.getByPlaceholderText(copy.usernamePlaceholder)).toBeTruthy();
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([...copy.genderOptions]);
      expect(screen.getAllByDisplayValue(copy.notProvided)).toHaveLength(1); // phone; email and name carry data
      if (locale === "en") expect(hasVietnamese(readableText(container))).toBe(false);
    });

    it("uses the translated fallback for a missing email and a locked empty username", () => {
      renderForm({ email: "", username: "x" });
      expect(screen.getAllByDisplayValue(copy.notProvided)).toHaveLength(2);
    });

    it("shows translated schema errors under the right field and does not call the server", async () => {
      renderForm();
      fireEvent.change(screen.getByPlaceholderText(copy.fullNamePlaceholder), { target: { value: "A" } });
      fireEvent.change(screen.getByPlaceholderText(copy.usernamePlaceholder), { target: { value: "ab" } });
      fireEvent.click(screen.getByRole("button", { name: copy.submit }));

      expect((await screen.findByText(copy.fullNameMin)).previousElementSibling).toBe(screen.getByPlaceholderText(copy.fullNamePlaceholder));
      expect(screen.getByText(copy.usernameMin)).toBeTruthy();
      expect(mocks.updateUserProfile).not.toHaveBeenCalled();
    });

    it("shows the success toast in the active language and passes a server error through unchanged", async () => {
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: copy.submit }));
      await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy.saved));

      // Chờ nút hết trạng thái chờ rồi mới gửi lần hai, đúng như người dùng.
      mocks.updateUserProfile.mockResolvedValue({ error: "already translated by the action" });
      fireEvent.click(await screen.findByRole("button", { name: copy.submit }));
      await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("already translated by the action"));
    });
  });

  describe("ChangePasswordForm", () => {
    it("shows every label, placeholder and the submit button", () => {
      const { container } = render(<ChangePasswordForm />, { locale });
      for (const label of copy.pwLabels) expect(screen.getByText(label), label).toBeTruthy();
      for (const placeholder of copy.pwPlaceholders) expect(screen.getByPlaceholderText(placeholder), placeholder).toBeTruthy();
      expect(screen.getByRole("button", { name: copy.pwSubmit })).toBeTruthy();
      if (locale === "en") expect(hasVietnamese(readableText(container))).toBe(false);
    });

    it("shows translated errors under each field and does not call the server", async () => {
      render(<ChangePasswordForm />, { locale });
      const [current, next, confirm] = copy.pwPlaceholders.map((placeholder) => screen.getByPlaceholderText(placeholder));
      fireEvent.change(current, { target: { value: "abc" } });
      fireEvent.change(next, { target: { value: "abc" } });
      fireEvent.change(confirm, { target: { value: "xyz" } });
      fireEvent.click(screen.getByRole("button", { name: copy.pwSubmit }));

      expect(await screen.findByText(copy.currentMin)).toBeTruthy();
      expect(screen.getByText(copy.newMin)).toBeTruthy();
      expect(screen.getByText(copy.mismatch)).toBeTruthy();
      expect(mocks.updateUserPassword).not.toHaveBeenCalled();
    });

    it("shows the success toast in the active language", async () => {
      render(<ChangePasswordForm />, { locale });
      const [current, next, confirm] = copy.pwPlaceholders.map((placeholder) => screen.getByPlaceholderText(placeholder));
      fireEvent.change(current, { target: { value: "old-pass-1" } });
      fireEvent.change(next, { target: { value: "new-pass-1" } });
      fireEvent.change(confirm, { target: { value: "new-pass-1" } });
      fireEvent.click(screen.getByRole("button", { name: copy.pwSubmit }));
      await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy.pwChanged));
    });
  });

  describe("ProfileSidebar", () => {
    const renderSidebar = (isDesktop: boolean | null = false) =>
      render(<ProfileSidebar isDesktop={isDesktop} paymentsPanel={null} />, { locale });

    it("shows the tabs, the avatar upload label and the learner name", async () => {
      const { container } = renderSidebar();
      expect(await screen.findByText("An Nguyen")).toBeTruthy();
      for (const tab of copy.tabs) expect(screen.getByRole("button", { name: tab }), tab).toBeTruthy();
      expect(screen.getByText(copy.uploadPhoto)).toBeTruthy();
      expect(screen.getByText("student")).toBeTruthy(); // role value is data, uppercased by CSS only
      if (locale === "en") expect(hasVietnamese(readableText(container))).toBe(false);
    });

    it("uses the translated fallback name while the profile has none", async () => {
      mocks.getUserProfile.mockResolvedValue({ data: { ...profile, full_name: "", role: "" } });
      renderSidebar();
      expect(await screen.findByText(copy.defaultName)).toBeTruthy();
      expect(screen.getByText("Student")).toBeTruthy();
    });

    it("passes a server error through as a toast and reports an avatar upload in the active language", async () => {
      mocks.getUserProfile.mockResolvedValue({ error: "translated by the action" });
      const first = renderSidebar();
      await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("translated by the action"));
      first.unmount();

      mocks.getUserProfile.mockResolvedValue({ data: profile });
      mocks.uploadAvatar.mockResolvedValue({ success: true, avatarUrl: "https://example.test/a.png" });
      const second = renderSidebar();
      await screen.findByText("An Nguyen");
      const input = second.container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
      await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(copy.avatarUpdated));
      // Toast được gọi trước khi state ảnh cập nhật, nên chờ ảnh xuất hiện thay vì đọc ngay.
      expect((await screen.findByRole("img")).getAttribute("aria-label")).toBe(locale === "en" ? "Profile photo" : "Avatar");
    });
  });
});
