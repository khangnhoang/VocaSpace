import AdminSidebar from "@/components/ui/sidebarAdmin";
import AdminHeader from "@/components/ui/headerAdmin";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#0F172A] font-sans">
        
        <AdminSidebar />

        <div className="flex flex-col flex-1 w-full overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
        
      </div>
    </SidebarProvider>
  );
}