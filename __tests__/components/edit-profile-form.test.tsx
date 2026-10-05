// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditProfileForm from "@/app/(client)/profile/_components/edit-profile-form";
import type { UserProfileDTO } from "@/lib/schemas/profile";

const mocks = vi.hoisted(() => ({
  updateUserProfile: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/actions/profile", () => ({ updateUserProfile: mocks.updateUserProfile }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

// Test plan:
// - Mục tiêu: form /profile cho đặt username đúng một lần và cho lưu khi username/ngày sinh/giới tính để trống (A3, AC7).
// - Loại test: component/form interaction trong jsdom (RTL); Server Action được mock.
// - Đối tượng: EditProfileForm.
// - Case thành công: username rỗng → ô nhập mở kèm dòng "Bạn chỉ đặt được username một lần."; chỉ nhập username thì
//   payload mang username và dob/gender null; để trống username vẫn gửi được với username null; sau khi dữ liệu
//   làm mới có username, ô chuyển sang khóa và hiện username mới.
// - Case thất bại: username ngắn hơn 3 ký tự chặn submit ngay dưới ô; server trả lỗi → toast lỗi, giữ nguyên input,
//   không làm mới dữ liệu.
// - Bảo mật/phân quyền: user đã có username thấy ô khóa, không có ô nhập username; form vẫn gửi username hiện có
//   (giá trị mặc định) và server là nơi cưỡng chế bỏ qua nó (xem integration test).
// - Ổn định/resilience: nút lưu bị khóa trong lúc chờ server (không submit đôi).
// - Invariant cần giữ: ô username chỉ sửa được khi username lưu trữ đang rỗng.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/edit-profile-form.test.tsx`.

const baseProfile: UserProfileDTO = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "learner@example.com",
  phone: "",
  full_name: "Nguyễn Văn A",
  avatar_url: null,
  role: "student",
  username: null,
  dob: null,
  gender: null,
};

const HELPER = "Bạn chỉ đặt được username một lần.";

function renderForm(overrides: Partial<UserProfileDTO> = {}) {
  const onRefreshData = vi.fn();
  const utils = render(<EditProfileForm initialData={{ ...baseProfile, ...overrides }} onRefreshData={onRefreshData} />);
  return { ...utils, onRefreshData };
}

const usernameInput = () => screen.getByLabelText(/Tên định danh/) as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

describe("EditProfileForm username", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateUserProfile.mockResolvedValue({ success: true });
  });
  afterEach(cleanup);

  it("lets a user without a username type one, with the one-time helper, and submits only that change", async () => {
    const { onRefreshData } = renderForm();

    expect(usernameInput().disabled).toBe(false);
    expect(screen.getByText(HELPER)).toBeTruthy();
    fireEvent.change(usernameInput(), { target: { value: "my_name" } });
    submit();

    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledTimes(1));
    expect(mocks.updateUserProfile).toHaveBeenCalledWith({
      full_name: "Nguyễn Văn A",
      username: "my_name",
      dob: null,
      gender: null,
    });
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
    expect(onRefreshData).toHaveBeenCalledTimes(1);
  });

  it("saves with the username left blank and sends it as null", async () => {
    const { onRefreshData } = renderForm();

    fireEvent.change(screen.getByPlaceholderText("Nhập họ và tên đầy đủ"), { target: { value: "Tên Mới" } });
    submit();

    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledTimes(1));
    expect(mocks.updateUserProfile).toHaveBeenCalledWith({ full_name: "Tên Mới", username: null, dob: null, gender: null });
    await waitFor(() => expect(onRefreshData).toHaveBeenCalledTimes(1));
  });

  it("blocks a username under 3 characters with a message under the field and no server call", async () => {
    renderForm();

    fireEvent.change(usernameInput(), { target: { value: "ab" } });
    submit();

    expect(await screen.findByText("Username phải từ 3 ký tự trở lên")).toBeTruthy();
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });

  it("shows a server error as a toast, keeps the typed input and does not refresh data", async () => {
    mocks.updateUserProfile.mockResolvedValue({ error: "Tên người dùng (Username) đã tồn tại!" });
    const { onRefreshData } = renderForm();

    fireEvent.change(usernameInput(), { target: { value: "taken_name" } });
    submit();

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Tên người dùng (Username) đã tồn tại!"));
    expect(usernameInput().value).toBe("taken_name");
    expect(onRefreshData).not.toHaveBeenCalled();
  });

  it("disables the save button while the server request is pending", async () => {
    let finish!: (value: { success: true }) => void;
    mocks.updateUserProfile.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderForm();

    submit();

    const button = await screen.findByRole("button", { name: "Đang đồng bộ dữ liệu..." });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    finish({ success: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeTruthy());
  });

  it("locks the username field and shows the new value once refreshed data carries a username", () => {
    const { rerender } = renderForm();
    expect(screen.queryByLabelText(/Tên định danh/)).not.toBeNull();

    rerender(<EditProfileForm initialData={{ ...baseProfile, username: "my_name" }} onRefreshData={vi.fn()} />);

    expect(screen.queryByLabelText(/Tên định danh/)).toBeNull();
    expect(screen.queryByText(HELPER)).toBeNull();
    const locked = screen.getByDisplayValue("my_name") as HTMLInputElement;
    expect(locked.disabled).toBe(true);
    expect(locked.readOnly).toBe(true);
  });

  it("shows a user who already has a username a locked field and still lets them save other fields", async () => {
    renderForm({ username: "local_student" });

    const locked = screen.getByDisplayValue("local_student") as HTMLInputElement;
    expect(locked.disabled).toBe(true);
    expect(screen.queryByText(HELPER)).toBeNull();
    expect(screen.queryByLabelText(/Tên định danh/)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Nhập họ và tên đầy đủ"), { target: { value: "Tên Mới" } });
    submit();

    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledTimes(1));
    expect(mocks.updateUserProfile.mock.calls[0][0]).toMatchObject({ full_name: "Tên Mới" });
  });
});
