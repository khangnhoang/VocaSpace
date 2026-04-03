"use client";

import React, { useState, useMemo } from "react";
import {
  Pencil,
  Trash2,
  UserPlus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  Users,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 1. MOCK DATA (10 người)
const mockUsers = [
  {
    id: "HV-8472",
    name: "Nguyễn Hải Đăng",
    email: "haidang.dev@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dang",
    role: "Admin",
    joinDate: "15/01/2026",
  },
  {
    id: "HV-3921",
    name: "Trần Bảo Ngọc",
    email: "ngoc.tran@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ngoc",
    role: "Giáo viên",
    joinDate: "02/03/2026",
  },
  {
    id: "HV-1048",
    name: "Lê Minh Trí",
    email: "tri.le99@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tri",
    role: "Học viên",
    joinDate: "10/11/2025",
  },
  {
    id: "HV-5530",
    name: "Phạm Gia Huy",
    email: "huy.pham@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Huy",
    role: "Học viên",
    joinDate: "01/04/2026",
  },
  {
    id: "HV-2291",
    name: "Vũ Thảo My",
    email: "thaomy.vu@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=My",
    role: "Học viên",
    joinDate: "20/02/2026",
  },
  {
    id: "HV-7742",
    name: "Hoàng Nhật Minh",
    email: "minh.hoang99@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Minh",
    role: "Giáo viên",
    joinDate: "05/12/2025",
  },
  {
    id: "HV-1183",
    name: "Đặng Quỳnh Anh",
    email: "quynhanh.dang@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Quynh",
    role: "Học viên",
    joinDate: "12/03/2026",
  },
  {
    id: "HV-9055",
    name: "Bùi Tuấn Kiệt",
    email: "kiet.bui.it@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kiet",
    role: "Học viên",
    joinDate: "28/03/2026",
  },
  {
    id: "HV-4321",
    name: "Phan Thị Hương",
    email: "huong.phan@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Huong",
    role: "Học viên",
    joinDate: "10/01/2026",
  },
  {
    id: "HV-6690",
    name: "Đinh Quang Trường",
    email: "truong.dinh@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Truong",
    role: "Admin",
    joinDate: "01/09/2025",
  },
];

const ITEMS_PER_PAGE = 6;

export default function UsermanagementPage() {
  // === 1. STATE QUẢN LÝ ===
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>(""); // State mới cho ô tìm kiếm
  const [currentPage, setCurrentPage] = useState<number>(1);

  // === 2. TÍNH TOÁN THỐNG KÊ TỰ ĐỘNG ===
  const stats = useMemo(() => {
    return {
      student: mockUsers.filter((u) => u.role === "Học viên").length,
      teacher: mockUsers.filter((u) => u.role === "Giáo viên").length,
      admin: mockUsers.filter((u) => u.role === "Admin").length,
      total: mockUsers.length,
    };
  }, []);

  // === 3. XỬ LÝ KẾT HỢP: TÌM KIẾM + LỌC + PHÂN TRANG ===
  const { paginatedUsers, totalPages } = useMemo(() => {
    // Bước A: Lọc dữ liệu theo Role VÀ theo Từ khóa tìm kiếm
    const filtered = mockUsers.filter((user) => {
      // 1. Kiểm tra vai trò
      const matchRole = roleFilter === "all" || user.role === roleFilter;

      // 2. Kiểm tra từ khóa (chuyển tất cả về chữ thường để so sánh không phân biệt hoa/thường)
      const lowerQuery = searchQuery.toLowerCase();
      const matchSearch =
        user.name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery);

      // Trả về true nếu thỏa mãn CẢ HAI điều kiện
      return matchRole && matchSearch;
    });

    // Bước B: Phân trang mảng đã lọc
    const totalPagesCount = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { paginatedUsers: paginated, totalPages: totalPagesCount };
  }, [roleFilter, searchQuery, currentPage]); // Chạy lại khi 1 trong 3 giá trị này thay đổi

  // === HÀM BẮT SỰ KIỆN ===
  const handleRoleChange = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Gõ tìm kiếm mới thì phải quay về trang 1
  };

  return (
    <div className="bg-[#0F172A] p-6 rounded-xl shadow-lg border border-slate-800 min-h-[500px] relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r "></div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
            Quản lý người dùng
          </h1>
          <p className="text-slate-400 text-sm">
            Danh sách tài khoản học viên và cán bộ quản lý trên hệ thống.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-cyan-900/20 active:scale-95">
          <UserPlus size={18} />
          Thêm người dùng
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-400">Học viên</span>
            <GraduationCap className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.student}</div>
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <TrendingUp size={14} /> <span>+12% tháng này</span>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-400">
              Giáo viên
            </span>
            <Briefcase className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.teacher}</div>
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <TrendingUp size={14} /> <span>+2 nhân sự mới</span>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-400">
              Quản trị viên
            </span>
            <ShieldCheck className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.admin}</div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>Không đổi</span>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-[#1E293B]/30 shadow-sm flex flex-col gap-3 hover:bg-[#1E293B]/50 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-400">
              Tổng tài khoản
            </span>
            <Users className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.total}</div>
          <div className="flex items-center gap-1 text-xs text-cyan-400">
            <TrendingUp size={14} /> <span>+15% so với cùng kỳ</span>
          </div>
        </div>
      </div>

      {/* THANH TÌM KIẾM VÀ LỌC */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-[#1E293B]/30 rounded-xl border border-slate-800/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={handleSearchChange} // Gắn sự kiện gõ phím
            placeholder="Tìm kiếm theo tên, email..."
            className="w-full pl-10 bg-[#0F172A] text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 border-slate-700"
          />
        </div>

        <div className="flex gap-4">
          <Select value={roleFilter} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-full md:w-[180px] bg-[#0F172A] border-slate-700 text-white focus:ring-cyan-500 focus:ring-offset-0">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-cyan-500" />
                <SelectValue placeholder="Lọc theo Vai trò" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#1E293B] border-slate-700 text-white p-2">
              <SelectItem
                value="all"
                className="focus:text-white cursor-pointer"
              >
                Tất cả vai trò
              </SelectItem>
              <SelectItem
                value="Admin"
                className="focus:text-white cursor-pointer"
              >
                Quản trị viên
              </SelectItem>
              <SelectItem
                value="Giáo viên"
                className="focus:text-white cursor-pointer"
              >
                Giáo viên
              </SelectItem>
              <SelectItem
                value="Học viên"
                className="focus:text-white cursor-pointer"
              >
                Học viên
              </SelectItem>
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
        {paginatedUsers.length > 0 ? (
          paginatedUsers.map((user) => (
            <div
              key={user.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 px-6 rounded-xl border border-slate-800 bg-[#1E293B]/40 hover:border-cyan-500/40 hover:bg-[#1E293B]/80 transition-all duration-300 group gap-4"
            >
              <div className="flex items-center gap-4 md:w-[35%]">
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-11 h-11 rounded-full bg-slate-800 border-2 border-slate-700 group-hover:border-cyan-500 transition-colors"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0F172A] rounded-full"></div>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm group-hover:text-cyan-400 transition-colors">
                    {user.name}
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5">{user.email}</p>
                </div>
              </div>
              <div className="md:w-[20%] md:text-center">
                <span className="md:hidden text-xs text-slate-500 mr-2 font-bold uppercase">
                  Vai trò:
                </span>
                <span
                  className={`text-[11px] font-bold px-3 py-1 rounded-full border ${user.role === "Admin" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : user.role === "Giáo viên" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-700/30 text-slate-400 border-slate-700/50"}`}
                >
                  {user.role}
                </span>
              </div>
              <div className="md:w-[25%] md:text-center text-sm text-slate-400 font-medium">
                <span className="md:hidden text-xs text-slate-500 mr-2 font-bold uppercase">
                  Tham gia:
                </span>
                {user.joinDate}
              </div>
              <div className="md:w-[20%] flex items-center justify-end gap-2">
                <button
                  title="Chỉnh sửa"
                  className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all"
                >
                  <Pencil size={18} />
                </button>
                <button
                  title="Xóa tài khoản"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-slate-500 text-sm">
            Không tìm thấy người dùng nào phù hợp.
          </div>
        )}
      </div>

      {/* THANH PHÂN TRANG */}
      {totalPages > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="text-sm text-slate-400">
            Trang{" "}
            <span className="font-semibold text-white">{currentPage}</span> /{" "}
            <span className="font-semibold text-white">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-700 bg-[#1E293B]/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              const isActive = currentPage === pageNumber;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`w-8 h-8 rounded-lg font-medium text-sm flex items-center justify-center transition-all ${isActive ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-700 bg-[#1E293B]/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
