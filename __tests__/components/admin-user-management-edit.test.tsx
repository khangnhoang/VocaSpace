// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsermanagementPage from "@/app/admin/user-management/_components/UserManagementClient";
import { getAllUsers, updateUserByAdmin } from "@/app/actions/user";

// Test plan:
// - Mục tiêu: AD7 khóa riêng Role khi tự sửa, vẫn gửi đúng các trường thông tin cá nhân.
// - Loại test: form interaction qua page/modal thật, mock action chỉ cho hành vi hiển thị/kết quả.
// - Đối tượng: UserManagementClient và UserFormModal.
// - Case thành công: self-edit giữ admin; role của người khác vẫn chọn được; form tạo user không bị khóa.
// - Case thất bại: server từ chối thì giữ form và dữ liệu; không có thông báo thành công.
// - Bảo mật/phân quyền: actor prop chỉ phục vụ UI, server guard được kiểm riêng ở action/integration.
// - Ổn định/resilience: pending khóa submit, không gửi hai lần.
// - Invariant cần giữ: khóa Select không làm mất giá trị role/email mà RHF đang giữ.
// - Kết quả verify gần nhất: passed (4 test), npx vitest run __tests__/components/admin-user-management-edit.test.tsx.

vi.mock("@/app/actions/user", () => ({ getAllUsers: vi.fn(), createUserByAdmin: vi.fn(), updateUserByAdmin: vi.fn(), deleteUserByAdmin: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const profiles = [ACTOR, OTHER].map((id, i) => ({
  id, full_name: i ? "Admin Khác" : "Admin Hiện Tại", username: i ? "other_admin" : "current_admin",
  email: i ? "other@example.com" : "current@example.com", phone: "0912345678", role: "admin",
  avatar_url: null, created_at: "2026-01-01T00:00:00Z",
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAllUsers).mockResolvedValue({ data: profiles } as never);
  vi.mocked(updateUserByAdmin).mockResolvedValue({ success: true, message: "Cập nhật thành công!" });
});

async function openSelf() {
  render(<UsermanagementPage currentAdminId={ACTOR} />);
  fireEvent.click(await screen.findByRole("button", { name: "Chỉnh sửa Admin Hiện Tại" }));
}

describe("admin self-edit form", () => {
  it("locks only role and saves personal details with the retained admin value", async () => {
    await openSelf();
    expect(screen.getByRole("combobox", { name: "Vai trò" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Bạn không thể tự thay đổi vai trò của tài khoản đang đăng nhập.")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("VD: Nguyễn Văn A"), { target: { value: "Admin Đã Sửa" } });
    fireEvent.change(screen.getByPlaceholderText("VD: nguyenvana"), { target: { value: "renamed_admin" } });
    fireEvent.change(screen.getByPlaceholderText("VD: 0987654321"), { target: { value: "0987654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(updateUserByAdmin).toHaveBeenCalledWith(ACTOR, expect.objectContaining({ role: "admin", full_name: "Admin Đã Sửa", username: "renamed_admin", phone: "0987654321" })));
    await waitFor(() => expect(screen.queryByText("Chỉnh sửa thông tin")).toBeNull());
    expect(getAllUsers).toHaveBeenCalledTimes(2);
  });

  it("keeps the other account's role selector enabled", async () => {
    render(<UsermanagementPage currentAdminId={ACTOR} />);
    fireEvent.click(await screen.findByRole("button", { name: "Chỉnh sửa Admin Khác" }));
    expect(screen.getByRole("combobox", { name: "Vai trò" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("Bạn không thể tự thay đổi vai trò của tài khoản đang đăng nhập.")).toBeNull();
  });

  it("keeps the form and changed input after a denied edit", async () => {
    vi.mocked(updateUserByAdmin).mockResolvedValue({ error: "Không thể cập nhật tài khoản, vui lòng thử lại." });
    await openSelf();
    fireEvent.change(screen.getByPlaceholderText("VD: Nguyễn Văn A"), { target: { value: "Giữ Lại" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect((screen.getByPlaceholderText("VD: Nguyễn Văn A") as HTMLInputElement).value).toBe("Giữ Lại");
    expect(toast.success).not.toHaveBeenCalled();
    expect(getAllUsers).toHaveBeenCalledTimes(1);
  });

  it("prevents another submit while the edit is pending", async () => {
    let finish!: (result: { success: boolean; message: string }) => void;
    vi.mocked(updateUserByAdmin).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await openSelf();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    const pending = await screen.findByRole("button", { name: "Đang xử lý..." });
    expect(pending.hasAttribute("disabled")).toBe(true);
    fireEvent.click(pending);
    expect(updateUserByAdmin).toHaveBeenCalledTimes(1);
    finish({ success: true, message: "Cập nhật thành công!" });
    await waitFor(() => expect(screen.queryByText("Chỉnh sửa thông tin")).toBeNull());
  });
});
