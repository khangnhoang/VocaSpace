"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Codepen,
  GraduationCap,
  LibraryBig,
  LogOut,
  Menu,
  Settings,
  User as UserIcon,
} from "lucide-react";

import { signOutUser } from "@/app/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
};

const DESKTOP_BREAKPOINT_QUERY = "(min-width: 1024px)";

export default function MobileAccountSheet({
  avatarUrl,
  fullName,
  email,
  isAuthenticated,
}: MobileAccountSheetProps) {
  const [open, setOpen] = React.useState(false);

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
      <SheetTrigger aria-label="Mở điều hướng tài khoản">
        <Menu
          size={30}
          className="border rounded-sm p-1 bg-white text-black"
        />
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
            <div className="flex items-center gap-2 text-blue-600">
              <Codepen size={22} aria-hidden="true" />
              <span className="text-lg font-bold tracking-tight">VocaSpace</span>
            </div>
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

          <div className="border-t border-slate-100 px-4 py-3">
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
                <div className="flex h-12 items-center gap-3 rounded-xl px-3 font-medium text-slate-700">
                  <Settings size={20} className="text-slate-500" />
                  <span>Cài đặt</span>
                </div>
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
