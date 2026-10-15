// app/admin/page.tsx
import { getAdminDashboardData } from "@/app/actions/admin-dashboard";
import { requireAdminPage } from "@/lib/auth/admin-access";
import { AdminDashboard } from "./_components/admin-dashboard";

export default async function AdminDashboardPage() {
  // Layout có thể được giữ nguyên khi điều hướng client, nên trang tự kiểm tra lại (AD1 AC3).
  await requireAdminPage();

  const { data, error } = await getAdminDashboardData();

  return <AdminDashboard data={data ?? null} error={error ?? null} />;
}
