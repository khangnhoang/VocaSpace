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
import { Codepen, Menu, Search } from "lucide-react";
export default function Header() {
  return (
    <div className="bg-white w-full">
      <div className="bg-blue-400 h-16 flex justify-between item-center p-4">
        <div className="flex justify-center items-center gap-1">
          <Codepen size={30}></Codepen>
          <h1 className="font-bold text-xl">VocaSpace</h1>
        </div>
        <div className="max-w-md lg:w-full flex justify-center items-center relative">
          <Input placeholder="Tìm kiếm" className="bg-white rounded-full"></Input>
          <Search className="absolute text-gray-300 right-3"></Search>
        </div>
        <div className="grid grid-cols-1 justify-center items-center lg:hidden">
            <Menu size={30} className="border rounded-sm p-1 bg-white text-black"></Menu>
        </div>
      </div>
    </div>
  );
}
