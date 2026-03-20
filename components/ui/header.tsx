import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
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
import { Codepen, Menu, Search, LibraryBig } from "lucide-react";
export default function Header() {
  return (
    <header className="bg-white w-full">
      <div className="bg-blue-400 h-16 flex justify-between item-center p-4">
        <div className="w-2/3 flex justify-between">
          <div className="flex justify-center items-center gap-1">
            <Codepen size={30} className="text-white"></Codepen>
            <h1 className="font-bold text-xl text-white">VocaSpace</h1>
          </div>
          <div className="max-w-md w-2/3 md:flex lg:flex xl:flex justify-center items-center relative hidden">
            <Input
              placeholder="Tìm kiếm"
              className="bg-white rounded-full"
            ></Input>
            <Search className="absolute text-gray-300 right-3"></Search>
          </div>
        </div>
        <div className="hidden lg:block">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>avatar</AvatarFallback>
          </Avatar>
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
