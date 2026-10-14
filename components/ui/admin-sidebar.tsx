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
import { BookOpen, LayoutDashboard, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation"; // IMPORT HOOK LẤY ĐƯỜNG DẪN

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Quản lý User", url: "/admin/user-management", icon: Users },
  { title: "Quản lý khóa học", url: "/admin/courses", icon: BookOpen },
];

export default function AdminSidebar() {
  const pathname = usePathname(); // BẮT LẤY URL HIỆN TẠI

  return (
    <Sidebar className="border-r border-slate-800">
      <SidebarHeader className="p-4">
        <div className="flex items-center px-2">
          {/* Logo gradient: độ tương phản thấp nhất (#2F6FF0 trên #0F172A) là 3,96:1, đạt ngưỡng 3:1 */}
          <Image
            src="/brand/vocaspace-logo.svg"
            alt="VocaSpace"
            width={587}
            height={117}
            className="h-[30px] w-auto"
          />
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
                // /admin là gốc của mọi trang admin nên chỉ active khi khớp chính xác, không active ở /admin/user-management.
                const isActive =
                  pathname === item.url ||
                  (item.url !== "/admin" && pathname.startsWith(`${item.url}/`));

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                    >
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
