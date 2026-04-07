// File: app/admin/user-management/_components/UserTable.tsx
import React from "react";
import { Search, Filter, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppUser, roleDisplayNames } from "./types";

interface UserTableProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  roleFilter: string;
  onRoleChange: (value: string) => void;
  isLoadingData: boolean;
  paginatedUsers: AppUser[];
  totalPages: number;
  safeCurrentPage: number;
  setCurrentPage: (page: number) => void;
  openEditForm: (user: AppUser) => void;
  openDeleteConfirm: (user: AppUser) => void;
}

export default function UserTable({
  searchQuery, onSearchChange, roleFilter, onRoleChange,
  isLoadingData, paginatedUsers, totalPages, safeCurrentPage,
  setCurrentPage, openEditForm, openDeleteConfirm
}: UserTableProps) {
  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-[#1E293B]/30 rounded-xl border border-slate-800/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={searchQuery} onChange={onSearchChange} placeholder="Tìm kiếm theo tên, email..." className="w-full pl-10 bg-[#0F172A] text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 border-slate-700" />
        </div>
        <div className="flex gap-4">
          <Select value={roleFilter} onValueChange={onRoleChange}>
            <SelectTrigger className="w-full md:w-45 bg-[#0F172A] border-slate-700 text-white focus:ring-cyan-500 focus:ring-offset-0">
              <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-cyan-500" /><SelectValue placeholder="Lọc theo Vai trò" /></div>
            </SelectTrigger>
            <SelectContent position="popper" className="dark bg-[#1E293B] border-slate-700 text-white p-2">
              <SelectItem value="all" className="focus:text-white cursor-pointer">Tất cả vai trò</SelectItem>
              <SelectItem value="admin" className="focus:text-white cursor-pointer">Quản trị viên</SelectItem>
              <SelectItem value="teacher" className="focus:text-white cursor-pointer">Giáo viên</SelectItem>
              <SelectItem value="student" className="focus:text-white cursor-pointer">Học viên</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between px-6 pb-4 mb-2 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-widest">
        <div className="w-[35%]">Thông tin người dùng</div>
        <div className="w-[20%] text-center">Vai trò</div>
        <div className="w-[25%] text-center">Ngày tham gia</div>
        <div className="w-[20%] text-right">Thao tác</div>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {isLoadingData ? (
          <div className="text-center py-10 text-cyan-500 font-medium">Đang tải dữ liệu từ máy chủ...</div>
        ) : paginatedUsers.length > 0 ? (
          paginatedUsers.map((user) => (
            <div key={user.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 px-6 rounded-xl border border-slate-800 bg-[#1E293B]/40 hover:border-cyan-500/40 hover:bg-[#1E293B]/80 transition-all duration-300 group gap-4">
              <div className="flex items-center gap-4 md:w-[35%]">
                <Avatar className="h-11 w-11 border-2 border-slate-700 group-hover:border-cyan-500 transition-colors bg-slate-800">
                  <AvatarImage src={user.avatar} className="object-cover" />
                  <AvatarFallback className="bg-slate-800 text-slate-300 font-bold uppercase text-sm">
                    {user.name ? user.name.charAt(0) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-white font-semibold text-sm group-hover:text-cyan-400 transition-colors">{user.name}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">{user.email}</p>
                </div>
              </div>
              <div className="md:w-[20%] md:text-center">
                <span className="md:hidden text-xs text-slate-500 mr-2 font-bold uppercase">Vai trò:</span>
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${user.role === "admin" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : user.role === "teacher" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-700/30 text-slate-400 border-slate-700/50"}`}>
                  {roleDisplayNames[user.role]}
                </span>
              </div>
              <div className="md:w-[25%] md:text-center text-sm text-slate-400 font-medium">
                <span className="md:hidden text-xs text-slate-500 mr-2 font-bold uppercase">Tham gia:</span>
                {user.joinDate}
              </div>
              <div className="md:w-[20%] flex items-center justify-end gap-2">
                <button onClick={() => openEditForm(user)} className="p-2 cursor-pointer text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all"><Pencil size={18} /></button>
                <button onClick={() => openDeleteConfirm(user)} className="p-2 cursor-pointer text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"><Trash2 size={18} /></button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-slate-500 text-sm">Không tìm thấy người dùng nào phù hợp.</div>
        )}
      </div>

      {totalPages > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="text-sm text-slate-400">Trang <span className="font-semibold text-white">{safeCurrentPage}</span> / <span className="font-semibold text-white">{totalPages}</span></div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentPage(safeCurrentPage - 1)} disabled={safeCurrentPage === 1} className="p-2 cursor-pointer rounded-lg border border-slate-700 bg-[#1E293B]/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft size={16} /></button>
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              const isActive = safeCurrentPage === pageNumber;
              return (
                <button key={pageNumber} onClick={() => setCurrentPage(pageNumber)} className={`w-8 h-8 rounded-lg font-medium text-sm flex items-center justify-center transition-all ${isActive ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{pageNumber}</button>
              );
            })}
            <button onClick={() => setCurrentPage(safeCurrentPage + 1)} disabled={safeCurrentPage === totalPages} className="p-2 cursor-pointer rounded-lg border border-slate-700 bg-[#1E293B]/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}