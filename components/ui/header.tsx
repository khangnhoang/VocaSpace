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
import {
  LibraryBig,
  User as UserIcon,
  BookOpen,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { signOutUser } from "@/app/actions/auth";
import { getTeacherCourseListPath } from "@/lib/course-authoring/routes";
import MobileAccountSheet from "@/components/ui/mobile-account-sheet";
import HeaderNav from "@/components/ui/header-nav";
import { getAccountMenuState } from "@/lib/account-menu";

export default async function Header() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Nếu có user, lấy thêm thông tin từ bảng profiles để hiển thị cho xịn
  let profile = null;
  let hasCourseWorkspace = false;
  let hasPendingCourseInvitation = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", user.id)
      .single();
    profile = data;

    const { data: membership } = await supabase
      .from("course_collaborators")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    hasCourseWorkspace = Boolean(membership?.length);
    const { count } = await supabase
      .from("course_collaborator_invitations")
      .select("id", { count: "exact", head: true })
      .eq("invitee_user_id", user.id)
      .eq("status", "pending");
    hasPendingCourseInvitation = (count ?? 0) > 0;
  }
  const accountMenu = getAccountMenuState({
    role: profile?.role,
    hasMembership: hasCourseWorkspace,
    hasPendingInvitation: hasPendingCourseInvitation,
  });

  return (
    <header className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2"
        >
          <Image
            src="/brand/vocaspace-logo.svg"
            alt="VocaSpace"
            width={587}
            height={117}
            loading="eager"
            className="h-7 w-auto"
          />
        </Link>
        <HeaderNav className="hidden flex-1 lg:block" />
        {/* CỤM NÚT BÊN PHẢI (DESKTOP) */}
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {user ? (
            // NẾU ĐÃ ĐĂNG NHẬP: HIỆN AVATAR DROPDOWN
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label="Mở menu tài khoản"
                  className="relative h-10 w-10 rounded-full cursor-pointer"
                >
                  <Avatar className="h-10 w-10 border-2 border-slate-200 transition-colors hover:border-route-line">
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
                  {accountMenu.isAdmin && (
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
                  {accountMenu.courseWorkspaceLabel && (
                    <DropdownMenuItem
                      asChild
                      className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600"
                    >
                      <Link href={getTeacherCourseListPath()}>
                        <BookOpen size={18} className="text-slate-400" />
                        <span>{accountMenu.courseWorkspaceLabel}</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
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
              <Button asChild variant="link" className="px-2">
                <Link href="/login">Đăng nhập</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Đăng ký ngay</Link>
              </Button>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center lg:hidden">
          <MobileAccountSheet
            avatarUrl={profile?.avatar_url}
            fullName={profile?.full_name}
            email={user?.email}
            isAuthenticated={Boolean(user)}
            isAdmin={accountMenu.isAdmin}
            courseWorkspaceLabel={accountMenu.courseWorkspaceLabel}
          />
        </div>
      </div>
    </header>
  );
}
