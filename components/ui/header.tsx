import {} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Codepen,
  Search,
  LibraryBig,
  User as UserIcon,
  BookOpen,
  Settings,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { signOutUser } from "@/app/actions/auth";
import { getTeacherCourseListPath } from "@/lib/course-authoring/routes";
import MobileAccountSheet from "@/components/ui/mobile-account-sheet";

export default async function Header() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Nếu có user, lấy thêm thông tin từ bảng profiles để hiển thị cho xịn
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <header className="bg-white w-full">
      <div className="bg-blue-400 h-16 flex justify-between item-center p-4">
        <div className="w-2/3 flex justify-between">
          <Link href="/" className="flex justify-center items-center gap-1">
            <Codepen size={30} className="text-white"></Codepen>
            <span className="font-bold text-xl text-white">VocaSpace</span>
          </Link>
          <div className="max-w-md w-2/3 md:flex lg:flex xl:flex justify-center items-center relative hidden">
            <Input
              placeholder="Tìm kiếm"
              className="bg-white rounded-full border-none focus-visible:ring-0 focus-visible:ring-offset-0 pr-10 text-gray-900 shadow-sm"
            />
            <Search className="absolute text-gray-400 right-3 cursor-pointer hover:text-blue-500 transition-colors" />
          </div>
        </div>
        {/* CỤM NÚT BÊN PHẢI (DESKTOP) */}
        <div className="hidden lg:flex items-center gap-4">
          {user ? (
            // NẾU ĐÃ ĐĂNG NHẬP: HIỆN AVATAR DROPDOWN
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full cursor-pointer"
                >
                  <Avatar className="h-10 w-10 border-2 border-white/20 hover:border-white transition-colors">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>
                      {profile?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="mt-3 w-72 rounded-2xl border-slate-200/80 bg-white p-2 shadow-xl shadow-slate-900/10"
                align="end"
                forceMount
              >
                <DropdownMenuLabel className="p-3 font-normal">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0 border border-blue-100 bg-blue-50">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-blue-50 font-semibold text-blue-700">
                        {profile?.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-semibold leading-none text-slate-900">
                      {profile?.full_name || "Học viên VocaSpace"}
                    </p>
                      <p className="truncate text-xs leading-none text-slate-500">
                      {user.email}
                    </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mx-2 bg-slate-200/80" />
                <DropdownMenuGroup className="space-y-1 p-1">
                  <DropdownMenuItem
                    asChild
                    className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600"
                  >
                    <Link href="/learn">
                      <LibraryBig size={18} className="text-slate-400" />
                      <span>Không gian học tập</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600"
                  >
                    <Link href="/profile">
                      <UserIcon size={18} className="text-slate-400" />
                      <span>Hồ sơ cá nhân</span>
                    </Link>
                  </DropdownMenuItem>

                  {/* BƯỚC 2: CHỈ RENDER NÚT NÀY NẾU ROLE LÀ ADMIN */}
                  {profile?.role === "admin" && (
                    <DropdownMenuItem
                      asChild
                      className="h-11 cursor-pointer gap-3 rounded-xl bg-emerald-50 px-3 font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus:bg-emerald-100"
                    >
                      <Link href="/admin">
                        <LayoutDashboard
                          size={18}
                          className="text-emerald-600"
                        />
                        <span>Quản trị hệ thống</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {/* CHỈ RENDER NẾU LÀ TEACHER HOẶC ADMIN */}
                  {(profile?.role === "teacher" ||
                    profile?.role === "admin") && (
                    <DropdownMenuItem
                      asChild
                      className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600"
                    >
                      <Link href={getTeacherCourseListPath()}>
                        <BookOpen size={18} className="text-slate-400" />
                        <span>Khóa học của tôi</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600">
                    <Settings size={18} className="text-slate-400" />
                    <span>Cài đặt</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="mx-2 bg-slate-200/80" />
                <form action={signOutUser} className="p-1">
                  <button type="submit" className="w-full text-left">
                    <DropdownMenuItem className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50 focus:text-rose-700">
                      <LogOut size={18} />
                      Đăng xuất
                    </DropdownMenuItem>
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // NẾU CHƯA ĐĂNG NHẬP: HIỆN NÚT LOGIN/REGISTER
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/20 hover:text-white font-medium cursor-pointer"
                >
                  Đăng nhập
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-white text-blue-500 hover:bg-gray-100 font-bold shadow-sm cursor-pointer">
                  Đăng ký ngay
                </Button>
              </Link>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 justify-center items-center lg:hidden">
          <MobileAccountSheet
            avatarUrl={profile?.avatar_url}
            fullName={profile?.full_name}
            email={user?.email}
            isAuthenticated={Boolean(user)}
          />
        </div>
      </div>
    </header>
  );
}
