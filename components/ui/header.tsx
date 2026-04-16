import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
} from "@/components/ui/navigation-menu";
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
import { Codepen, Menu, Search, LibraryBig, User as UserIcon, BookOpen, Settings, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { signOutUser } from "@/app/actions/auth";


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
            <h1 className="font-bold text-xl text-white">VocaSpace</h1>
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
                <Button variant="ghost" className="relative h-10 w-10 rounded-full cursor-pointer">
                  <Avatar className="h-10 w-10 border-2 border-white/20 hover:border-white transition-colors">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>{profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-56 mt-2" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-gray-900">
                      {profile?.full_name || "Học viên VocaSpace"}
                    </p>
                    <p className="text-xs leading-none text-gray-500">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="cursor-pointer gap-2 py-2">
                    <UserIcon size={16} className="text-slate-500" />
                    <span className="font-medium text-slate-700">Hồ sơ cá nhân</span>
                  </DropdownMenuItem>
                  
                  {/* CHỈ RENDER NẾU LÀ TEACHER HOẶC ADMIN */}
                  {(profile?.role === "teacher" || profile?.role === "admin") && (
                    <DropdownMenuItem asChild className="cursor-pointer gap-2 py-2">
                      <Link href="/courses">
                        <BookOpen size={16} className="text-slate-500" />
                        <span className="font-medium text-slate-700">Khóa học của tôi</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuItem className="cursor-pointer gap-2 py-2">
                    <Settings size={16} className="text-slate-500" />
                    <span className="font-medium text-slate-700">Cài đặt</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <form action={signOutUser}>
                  <button type="submit" className="w-full text-left">
                    <DropdownMenuItem className="text-rose-600 cursor-pointer font-medium hover:bg-rose-50 hover:text-rose-700 gap-2 py-2">
                      <LogOut size={16} />
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
                <Button variant="ghost" className="text-white hover:bg-white/20 hover:text-white font-medium cursor-pointer">
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
          <Sheet>
            <SheetTrigger>
              <Menu
                size={30}
                className="border rounded-sm p-1 bg-white text-black"
              ></Menu>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle></SheetTitle>
              <SheetHeader className="mt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>avatar</AvatarFallback>
                  </Avatar>
                  <div className="grid gap-2">
                    <h1 className="font-bold">Nguyễn Văn A</h1>
                    <p>nguyenvana@gmail.com</p>
                  </div>
                </div>
              </SheetHeader>
              <div className="grid grid-cols-1 gap-4">
                <div className="border"></div>
                <div className="flex items-center hover:bg-gray-200 h-16 cursor-pointer">
                  <LibraryBig className="ml-8" size={35} />
                  <p className="font-bold text-xl">Courses</p>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
