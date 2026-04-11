"use client"; // BẮT BUỘC PHẢI CÓ DÒNG NÀY

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  BarChart,
  Codepen,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation"; // IMPORT HOOK LẤY ĐƯỜNG DẪN

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Quản lý User", url: "/admin/users", icon: Users },
  { title: "Quản lý Khóa học", url: "/admin/courses", icon: BookOpen },
  { title: "Thống kê & Doanh thu", url: "/admin/stats", icon: BarChart },
  { title: "Cài đặt hệ thống", url: "/admin/settings", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname(); // BẮT LẤY URL HIỆN TẠI

  return (
    <Sidebar className="border-r border-slate-800">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 px-2">
          <Codepen className="text-cyan-500" size={24} />
          <h2 className="text-xl font-bold text-white tracking-wide">
            VocaSpace
          </h2>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase text-slate-400 font-semibold mb-2">
            Menu Quản Trị
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                // TÍNH TOÁN TRẠNG THÁI ACTIVE
                const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                      <Link
                        href={item.url}
                        className={`flex items-center gap-3 py-5 transition-colors rounded-md ${
                          isActive 
                            ? "text-cyan-400 bg-slate-800" // Đổi màu khi đang chọn
                            : "text-slate-300 hover:text-cyan-400 hover:bg-slate-800"
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}