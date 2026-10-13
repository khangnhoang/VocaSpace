// File: app/admin/user-management/page.tsx
import { requireAdminPage } from "@/lib/auth/admin-access";
import UsermanagementPage from "./_components/UserManagementClient";

export default async function UserManagementRoute() {
  // Layout có thể được giữ nguyên khi điều hướng client, nên mỗi trang admin tự kiểm tra lại (AD1 AC3).
  await requireAdminPage();
  return <UsermanagementPage />;
}
