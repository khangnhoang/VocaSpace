"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookMarked,
  BookOpen,
  ChevronRight,
  GraduationCap,
  House,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  User as UserIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { signOutUser } from "@/app/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getTeacherCourseListPath } from "@/lib/course-authoring/routes";
import { isCurrentPath, PRIMARY_NAV_LABEL, PRIMARY_NAV_LINKS } from "@/components/ui/header-nav";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type MobileAccountSheetProps = {
  avatarUrl?: string | null;
  fullName?: string | null;
  email?: string | null;
  isAuthenticated: boolean;
  /** Quyền admin và nhãn link khóa học đến từ `getAccountMenuState` ở Header, cùng nguồn với menu desktop. */
  isAdmin?: boolean;
  courseWorkspaceLabel?: string | null;
};

const DESKTOP_BREAKPOINT_QUERY = "(min-width: 1024px)";

export default function MobileAccountSheet({
  avatarUrl,
  fullName,
  email,
  isAuthenticated,
  isAdmin = false,
  courseWorkspaceLabel = null,
}: MobileAccountSheetProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    const desktopMediaQuery = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    const closeOnDesktop = () => {
      if (desktopMediaQuery.matches) {
        setOpen(false);
      }
    };

    closeOnDesktop();
    desktopMediaQuery.addEventListener("change", closeOnDesktop);
    return () => desktopMediaQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Mở điều hướng tài khoản"
        className="flex size-11 items-center justify-center rounded-[8px] border border-slate-300 bg-white text-slate-700 transition-colors duration-[120ms] hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <Menu aria-hidden="true" className="size-5" />
      </SheetTrigger>
      <SheetContent
        showCloseButton={false}
        className="gap-0 overflow-y-auto border-slate-200 bg-white p-0 data-[side=right]:w-[90vw] data-[side=right]:max-w-[360px] sm:data-[side=right]:max-w-[360px]"
      >
        <SheetTitle className="sr-only">Điều hướng tài khoản</SheetTitle>
        <SheetDescription className="sr-only">
          Các tùy chọn tài khoản và điều hướng học tập.
        </SheetDescription>
        <div className="flex min-h-full flex-col">
          <div className="flex items-center justify-between px-5 pt-5">
            <Image
              src="/brand/vocaspace-logo.svg"
              alt="VocaSpace"
              width={587}
              height={117}
              className="h-6 w-auto"
            />
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Đóng điều hướng tài khoản"
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  ×
                </span>
              </Button>
            </SheetClose>
          </div>

          <div className="px-5 pb-5 pt-4">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="h-14 w-14 shrink-0 border border-blue-100 bg-blue-50">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-blue-50 font-semibold text-blue-700">
                  {fullName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="truncate font-semibold text-slate-900">
                  {fullName || "Khách VocaSpace"}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {email || "Chưa đăng nhập"}
                </p>
              </div>
            </div>
          </div>

          <nav aria-label={PRIMARY_NAV_LABEL} className="border-t border-slate-100 px-4 py-3">
            <ul className="space-y-1">
              {PRIMARY_NAV_LINKS.slice(0, 2).map(({ label, href }) => {
                const Icon = href === "/" ? House : BookMarked;
                const isCurrent = isCurrentPath(pathname, href);
                return (
                  <li key={href}>
                    <SheetClose asChild>
                      <Link
                        href={href}
                        aria-current={isCurrent ? "page" : undefined}
                        className="group flex h-12 items-center gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600 focus-visible:outline-none aria-[current=page]:text-route"
                      >
                        <Icon
                          size={20}
                          className="text-slate-500 transition-colors group-hover:text-blue-600 group-focus-visible:text-blue-600 group-aria-[current=page]:text-route"
                        />
                        <span>{label}</span>
                      </Link>
                    </SheetClose>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-slate-100 px-4 py-3">
            {!isAuthenticated && (
              <div className="space-y-2">
                <SheetClose asChild>
                  <Button asChild size="lg" className="w-full">
                    <Link href="/login">Đăng nhập</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild size="lg" variant="outline" className="w-full">
                    <Link href="/register">Đăng ký ngay</Link>
                  </Button>
                </SheetClose>
              </div>
            )}
            {isAuthenticated && (
              <div className="space-y-1">
                <SheetClose asChild>
                  <Link
                    href="/learn"
                    className="group flex h-12 items-center gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600 focus-visible:outline-none"
                  >
                    <LibraryBig
                      size={20}
                      className="text-slate-500 transition-colors group-hover:text-blue-600 group-focus-visible:text-blue-600"
                    />
                    <span>Không gian học tập</span>
                    <ChevronRight
                      size={18}
                      className="ml-auto text-slate-400 transition-colors group-hover:text-blue-600 group-focus-visible:text-blue-600"
                    />
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/profile"
                    className="group flex h-12 items-center gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600 focus-visible:outline-none"
                  >
                    <UserIcon
                      size={20}
                      className="text-slate-500 transition-colors group-hover:text-blue-600 group-focus-visible:text-blue-600"
                    />
                    <span>Hồ sơ cá nhân</span>
                    <ChevronRight
                      size={18}
                      className="ml-auto text-slate-400 transition-colors group-hover:text-blue-600 group-focus-visible:text-blue-600"
                    />
                  </Link>
                </SheetClose>
                {isAdmin && (
                  <SheetClose asChild>
                    <Link
                      href="/admin"
                      className="group flex h-12 items-center gap-3 rounded-xl bg-emerald-50 px-3 font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:bg-emerald-100 focus-visible:outline-none"
                    >
                      <LayoutDashboard size={20} className="text-emerald-600" />
                      <span>Quản trị hệ thống</span>
                      <ChevronRight size={18} className="ml-auto text-emerald-600" />
                    </Link>
                  </SheetClose>
                )}
                {courseWorkspaceLabel && (
                  <SheetClose asChild>
                    <Link
                      href={getTeacherCourseListPath()}
                      className="group flex h-12 items-center gap-3 rounded-xl px-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:bg-blue-50 focus-visible:text-blue-600 focus-visible:outline-none"
                    >
                      <BookOpen size={20} className="text-slate-500" />
                      <span>{courseWorkspaceLabel}</span>
                      <ChevronRight size={18} className="ml-auto text-slate-400" />
                    </Link>
                  </SheetClose>
                )}
              </div>
            )}
          </div>

          {isAuthenticated && (
            <>
              <div className="mx-5 border-t border-slate-200" />
              <form action={signOutUser} className="px-4 py-3">
                <button
                  type="submit"
                  className="flex h-12 w-full items-center gap-3 rounded-xl bg-rose-50 px-3 font-semibold text-rose-600 transition-colors hover:bg-rose-100 hover:text-rose-700 focus-visible:bg-rose-100 focus-visible:outline-none"
                >
                  <LogOut size={20} />
                  Đăng xuất
                </button>
              </form>
              <div className="mt-auto px-4 pb-5">
                <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-700">Học mỗi ngày</p>
                    <p className="text-sm leading-5 text-slate-500">
                      Tiến gần hơn đến mục tiêu của bạn.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
