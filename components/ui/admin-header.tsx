import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function AdminHeader() {
  return (
    
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 bg-[#0F172A] border-b border-slate-800 shrink-0">
      
      <div className="flex items-center gap-4">
        
        <SidebarTrigger className="text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" />
        
        
        <h1 className="font-semibold text-lg hidden lg:block text-white tracking-wide">
          Quản trị hệ thống
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block w-64">
          
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Tìm kiếm nhanh..."
            
            className="w-full bg-[#1E293B] text-white placeholder:text-slate-500 pl-8 focus-visible:ring-1 border-none shadow-sm transition-shadow"
          />
        </div>

        
        <Avatar className="h-9 w-9 border border-slate-700 cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-offset-[#0F172A] ring-cyan-500 transition-all">
          <AvatarImage src="https://github.com/shadcn.png" />
          
          <AvatarFallback className="bg-slate-800 text-cyan-400 font-bold">AD</AvatarFallback>
        </Avatar>
      </div>

    </header>
  );
}