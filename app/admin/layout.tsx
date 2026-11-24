import AreaLocale from "@/components/i18n/area-locale";
import AdminSidebar from "@/components/ui/admin-sidebar";
import AdminHeader from "@/components/ui/admin-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { requireAdminPage } from "@/lib/auth/admin-access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Chặn trước khi render sidebar/header: người không phải admin nhận trang 404, không thấy khung admin (AD1 AC2).
  await requireAdminPage();

  return (
    <AreaLocale>
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#0F172A] font-sans dark">
        
        <AdminSidebar />

        <div className="flex flex-col flex-1 w-full overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
        
      </div>
    </SidebarProvider>
    </AreaLocale>
  );
}