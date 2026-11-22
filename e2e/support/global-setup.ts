import { ensureSharedAccounts } from "../../scripts/e2e/support/shared-accounts.mjs";

// Chạy một lần trước mọi worker: đưa admin/teacher/student seed về trạng thái chuẩn để fixture không phải
// gọi `updateUserById` trên tài khoản dùng chung khi worker khác đang đăng nhập (G3).
export default async function globalSetup() {
  await ensureSharedAccounts(process.env);
}
