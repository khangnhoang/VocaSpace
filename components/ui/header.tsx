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
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { signOutUser } from "@/app/actions/auth";
import { getTeacherCourseListPath } from "@/lib/course-authoring/routes";
import MobileAccountSheet from "@/components/ui/mobile-account-sheet";
import HeaderNav from "@/components/ui/header-nav";
import { getAccountMenuState } from "@/lib/account-menu";
import LanguageSwitcher from "@/components/ui/language-switcher";
import { isEnglishUiEnabled } from "@/lib/i18n/config";
import { isTeacherAdminLockedRequest } from "@/lib/i18n/request-locale";

// `hideSwitcherInLockedAreas`: chỉ not-found gốc bật, vì đó là nơi duy nhất Header render dưới /teacher hoặc /admin (U9);
// ở đó ngôn ngữ bị khóa tiếng Việt nên bộ chọn không được hứa gì.
export default async function Header({ hideSwitcherInLockedAreas = false }: { hideSwitcherInLockedAreas?: boolean } = {}) {
  const supabase = await createClient();
  const t = await getTranslations("common");

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

  const courseWorkspaceLabel = accountMenu.courseWorkspaceLabel ? t(accountMenu.courseWorkspaceLabel) : null;
  // English localization U1 quyết định 7: bộ chọn ngôn ngữ chỉ xuất hiện khi cờ giao diện tiếng Anh bật.
  const showLanguageSwitcher =
    isEnglishUiEnabled() && !(hideSwitcherInLockedAreas && (await isTeacherAdminLockedRequest()));

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
          {showLanguageSwitcher && <LanguageSwitcher className="mr-2" />}
          {user ? (
            // NẾU ĐÃ ĐĂNG NHẬP: HIỆN AVATAR DROPDOWN
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={t("account.openMenu")}
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
                      {profile?.full_name || t("account.learnerFallbackName")}
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
                      <span>{t("account.learningSpace")}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600"
                  >
                    <Link href="/profile">
                      <UserIcon size={18} className="text-slate-400" />
                      <span>{t("account.profile")}</span>
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
                        <span>{t("account.admin")}</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {/* CHỈ RENDER NẾU LÀ TEACHER HOẶC ADMIN */}
                  {courseWorkspaceLabel && (
                    <DropdownMenuItem
                      asChild
                      className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600"
                    >
                      <Link href={getTeacherCourseListPath()}>
                        <BookOpen size={18} className="text-slate-400" />
                        <span>{courseWorkspaceLabel}</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="mx-2 bg-slate-200/80" />
                <form action={signOutUser} className="p-1">
                  <button type="submit" className="w-full text-left">
                    <DropdownMenuItem className="h-11 cursor-pointer gap-3 rounded-xl px-3 font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50 focus:text-rose-700">
                      <LogOut size={18} />
                      {t("account.signOut")}
                    </DropdownMenuItem>
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // NẾU CHƯA ĐĂNG NHẬP: HIỆN NÚT LOGIN/REGISTER
            <div className="flex items-center gap-2">
              <Button asChild variant="link" className="px-2">
                <Link href="/login">{t("account.signIn")}</Link>
              </Button>
              <Button asChild>
                <Link href="/register">{t("account.signUp")}</Link>
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
            courseWorkspaceLabel={courseWorkspaceLabel}
            showLanguageSwitcher={showLanguageSwitcher}
          />
        </div>
      </div>
    </header>
  );
}
