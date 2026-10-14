// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsermanagementPage from "@/app/admin/user-management/_components/UserManagementClient";
import { createUserByAdmin, getAllUsers } from "@/app/actions/user";

vi.mock("@/app/actions/user", () => ({
  getAllUsers: vi.fn(),
  createUserByAdmin: vi.fn(),
  updateUserByAdmin: vi.fn(),
  deleteUserByAdmin: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const mockedGetAllUsers = vi.mocked(getAllUsers);
const mockedCreateUserByAdmin = vi.mocked(createUserByAdmin);

// Test plan:
// - Mục tiêu: A5 AC5 — form "Thêm người dùng" xử lý đúng kết quả của createUserByAdmin, nhất là khi tài khoản đã tạo nhưng vai trò/mail lỗi.
// - Loại test: component page trong jsdom (RTL), mock Server Action và toast.
// - Đối tượng: app/admin/user-management/_components/UserManagementClient.tsx (onSubmitForm; AD1 chuyển file này khỏi page.tsx) cùng UserFormModal thật.
// - Case thành công: tạo thành công thì toast.success, tải lại danh sách và đóng form.
// - Case thất bại:
//   - Lỗi trước khi tạo tài khoản (không có accountCreated): toast.error, form còn mở, danh sách không tải lại.
//   - Tài khoản đã tạo nhưng mail/vai trò lỗi (accountCreated: true): toast.error với thông báo từng phần, form đóng và danh sách tải lại để admin không gửi lại cùng một lần tạo.
// - Bảo mật/phân quyền: không áp dụng (requireAdmin nằm trong Server Action, có test riêng).
// - Ổn định/resilience: gửi lại form sau lỗi từng phần không gọi createUserByAdmin lần hai.
// - Kết quả verify gần nhất: xem milestone A5 correction round trong progress.md (`npx vitest run __tests__/components/admin-user-management-create.test.tsx`).

async function openFormAndSubmit() {
  fireEvent.click(await screen.findByRole("button", { name: /Thêm người dùng/ }));
  fireEvent.change(screen.getByPlaceholderText("VD: Nguyễn Văn A"), { target: { value: "Nguyễn Văn Mới" } });
  fireEvent.change(screen.getByPlaceholderText("VD: nguyenvana"), { target: { value: "nguyenvanmoi" } });
  fireEvent.change(screen.getByPlaceholderText("VD: email@example.com"), { target: { value: "moi@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("VD: 0987654321"), { target: { value: "0987654321" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu người dùng" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetAllUsers.mockResolvedValue({ data: [] });
});

describe("admin user management create form", () => {
  it("closes the form and reloads the list after a successful create", async () => {
    mockedCreateUserByAdmin.mockResolvedValue({ success: true, message: "Đã tạo tài khoản và gửi email đặt mật khẩu" });
    render(<UsermanagementPage currentAdminId="11111111-1111-4111-8111-111111111111" />);

    await openFormAndSubmit();

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Đã tạo tài khoản và gửi email đặt mật khẩu"));
    expect(screen.queryByText("Thêm người dùng mới")).toBeNull();
    expect(mockedGetAllUsers).toHaveBeenCalledTimes(2);
  });

  it("keeps the form open and does not reload when the account was not created", async () => {
    mockedCreateUserByAdmin.mockResolvedValue({ error: "Database error creating new user" });
    render(<UsermanagementPage currentAdminId="11111111-1111-4111-8111-111111111111" />);

    await openFormAndSubmit();

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Database error creating new user"));
    expect(screen.getByText("Thêm người dùng mới")).toBeTruthy();
    expect(mockedGetAllUsers).toHaveBeenCalledTimes(1);
  });

  it("closes the form and reloads the list when the account exists but the mail or role step failed", async () => {
    const message = 'Đã tạo tài khoản nhưng chưa gửi được email đặt mật khẩu. Hãy nhờ người dùng chọn "Quên mật khẩu?" ở trang đăng nhập.';
    mockedCreateUserByAdmin.mockResolvedValue({ error: message, accountCreated: true });
    render(<UsermanagementPage currentAdminId="11111111-1111-4111-8111-111111111111" />);

    await openFormAndSubmit();

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(message));
    expect(screen.queryByText("Thêm người dùng mới")).toBeNull();
    expect(mockedGetAllUsers).toHaveBeenCalledTimes(2);
    expect(mockedCreateUserByAdmin).toHaveBeenCalledTimes(1);
  });
});
