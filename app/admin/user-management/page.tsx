"use client";

import React, { useState, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  User,
  Mail,
  Phone,
  Link2,
  X,
  AlertTriangle, // Thêm icon cho Modal xóa
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Định nghĩa kiểu dữ liệu
interface UserFormData {
  email: string;
  phone: string;
  username: string;
  full_name: string;
  avatar_url: string;
  role: "admin" | "teacher" | "student";
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "admin" | "teacher" | "student";
  joinDate: string;
}

// Data khởi tạo
const initialUsers: MockUser[] = [
  {
    id: "HV-8472",
    name: "Nguyễn Hải Đăng",
    email: "haidang.dev@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dang",
    role: "admin",
    joinDate: "15/01/2026",
  },
  {
    id: "HV-3921",
    name: "Trần Bảo Ngọc",
    email: "ngoc.tran@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ngoc",
    role: "teacher",
    joinDate: "02/03/2026",
  },
  {
    id: "HV-1048",
    name: "Lê Minh Trí",
    email: "tri.le99@email.com",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tri",
    role: "student",
    joinDate: "10/11/2025",
  },
];

const ITEMS_PER_PAGE = 6;

const roleDisplayNames = {
  admin: "Quản trị viên",
  teacher: "Giáo viên",
  student: "Học viên",
};

export default function UsermanagementPage() {
  // === STATE QUẢN LÝ DANH SÁCH (Hỗ trợ Thêm/Sửa/Xóa tạm) ===
  const [usersList, setUsersList] = useState<MockUser[]>(initialUsers);

  // === STATE QUẢN LÝ HIỂN THỊ ===
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // === STATE CHO FORM (Thêm & Sửa) ===
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserFormData | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    phone: "",
    username: "",
    full_name: "",
    avatar_url: "",
    role: "student",
  });

  // === STATE CHO XÓA TÀI KHOẢN ===
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<MockUser | null>(null);

  // === TÍNH TOÁN THỐNG KÊ ===
  const stats = useMemo(() => {
    return {
      student: usersList.filter((u) => u.role === "student").length,
      teacher: usersList.filter((u) => u.role === "teacher").length,
      admin: usersList.filter((u) => u.role === "admin").length,
      total: usersList.length,
    };
  }, [usersList]);

  // === LỌC & PHÂN TRANG ===
  // Lấy thêm safeCurrentPage ra để sử dụng
  const { paginatedUsers, totalPages, safeCurrentPage } = useMemo(() => {
    const filtered = usersList.filter((user) => {
      const matchRole = roleFilter === "all" || user.role === roleFilter;
      const lowerQuery = searchQuery.toLowerCase();
      const matchSearch =
        user.name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery);
      return matchRole && matchSearch;
    });

    const totalPagesCount = Math.ceil(filtered.length / ITEMS_PER_PAGE);

    // Tính toán trang an toàn nhưng KHÔNG gọi setCurrentPage ở đây nữa
    const safePage = Math.min(currentPage, Math.max(1, totalPagesCount));

    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const paginated = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Trả về safeCurrentPage để giao diện ở dưới tự động đồng bộ
    return {
      paginatedUsers: paginated,
      totalPages: totalPagesCount,
      safeCurrentPage: safePage,
    };
  }, [roleFilter, searchQuery, currentPage, usersList]);

  // === HÀM BẮT SỰ KIỆN LỌC ===
  const handleRoleChange = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // === HÀM BẮT SỰ KIỆN FORM ===
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormRoleChange = (value: "admin" | "teacher" | "student") => {
    setFormData((prev) => ({ ...prev, role: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      setUsersList((prev) =>
        prev.map((u) =>
          u.email === formData.email
            ? { ...u, name: formData.full_name, role: formData.role }
            : u,
        ),
      );
    } else {
      const newUser: MockUser = {
        id: `HV-${Math.floor(Math.random() * 10000)}`,
        name: formData.full_name,
        email: formData.email,
        avatar:
          formData.avatar_url ||
          "https://api.dicebear.com/7.x/avataaars/svg?seed=New",
        role: formData.role,
        joinDate: new Date().toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
      };
      setUsersList((prev) => [newUser, ...prev]);
    }
    setIsFormOpen(false);
  };

  const openEditForm = (user: MockUser) => {
    const editData: UserFormData = {
      full_name: user.name,
      email: user.email,
      username: user.email.split("@")[0],
      phone: "",
      avatar_url: user.avatar,
      role: user.role,
    };
    setEditingUser(editData);
    setFormData(editData);
    setIsFormOpen(true);
  };

  const openAddForm = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      phone: "",
      username: "",
      full_name: "",
      avatar_url: "",
      role: "student",
    });
    setIsFormOpen(true);
  };

  // === HÀM BẮT SỰ KIỆN XÓA ===
  const openDeleteConfirm = (user: MockUser) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      setUsersList((prev) => prev.filter((u) => u.id !== userToDelete.id));
    }
    setIsDeleteModalOpen(false);
    setUserToDelete(null);
  };

  return (
    <div className="bg-[#0F172A] p-6 rounded-xl shadow-lg border border-slate-800 min-h-125 relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r "></div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
            Quản lý người dùng
          </h1>
          <p className="text-slate-400 text-sm">
            Danh sách tài khoản học viên và cán bộ quản lý trên hệ thống.
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-cyan-900/20 active:scale-95"
        >
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

      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-[#1E293B]/30 rounded-xl border border-slate-800/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Tìm kiếm theo tên, email..."
            className="w-full pl-10 bg-[#0F172A] text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 border-slate-700"
          />
        </div>

        <div className="flex gap-4">
          <Select value={roleFilter} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-full md:w-45 bg-[#0F172A] border-slate-700 text-white focus:ring-cyan-500 focus:ring-offset-0">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-cyan-500" />
                <SelectValue placeholder="Lọc theo Vai trò" />
              </div>
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="bg-[#1E293B] border-slate-700 text-white p-2"
            >
              <SelectItem
                value="all"
                className="focus:text-white cursor-pointer"
              >
                Tất cả vai trò
              </SelectItem>
              <SelectItem
                value="admin"
                className="focus:text-white cursor-pointer"
              >
                Quản trị viên
              </SelectItem>
              <SelectItem
                value="teacher"
                className="focus:text-white cursor-pointer"
              >
                Giáo viên
              </SelectItem>
              <SelectItem
                value="student"
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
                  className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                    user.role === "admin"
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      : user.role === "teacher"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-slate-700/30 text-slate-400 border-slate-700/50"
                  }`}
                >
                  {roleDisplayNames[user.role]}
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
                  onClick={() => openEditForm(user)}
                  title="Chỉnh sửa"
                  className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-all"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => openDeleteConfirm(user)}
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
            Trang
            <span className="font-semibold text-white">
              {safeCurrentPage}
            </span>{" "}
            / <span className="font-semibold text-white">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              // Điều chỉnh trừ đi 1 từ trang an toàn
              onClick={() => setCurrentPage(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="p-2 rounded-lg border border-slate-700 bg-[#1E293B]/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              // So sánh trạng thái Active với trang an toàn
              const isActive = safeCurrentPage === pageNumber;
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
              // Điều chỉnh cộng thêm 1 từ trang an toàn
              onClick={() => setCurrentPage(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              className="p-2 rounded-lg border border-slate-700 bg-[#1E293B]/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0F172A] border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r"></div>

            <div className="flex items-center justify-between p-6 border-b border-slate-800/80">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {editingUser ? "Chỉnh sửa thông tin" : "Thêm người dùng mới"}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {editingUser
                    ? "Cập nhật dữ liệu tài khoản trên hệ thống."
                    : "Điền thông tin chi tiết để cấp tài khoản hệ thống."}
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              className="p-6 flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Họ và tên
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleFormChange}
                      placeholder="VD: Nguyễn Văn A"
                      required
                      className="pl-10 bg-[#1E293B]/50 border-slate-700 text-white focus-visible:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">
                      @
                    </span>
                    <Input
                      name="username"
                      value={formData.username}
                      onChange={handleFormChange}
                      placeholder="VD: nguyenvana"
                      required
                      className="pl-8 bg-[#1E293B]/50 border-slate-700 text-white focus-visible:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      placeholder="VD: email@example.com"
                      required
                      className="pl-10 bg-[#1E293B]/50 border-slate-700 text-white focus-visible:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      placeholder="VD: 0987654321"
                      className="pl-10 bg-[#1E293B]/50 border-slate-700 text-white focus-visible:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Vai trò (Role)
                  </label>
                  <Select
                    value={formData.role}
                    onValueChange={handleFormRoleChange}
                  >
                    <SelectTrigger className="w-full bg-[#1E293B]/50 border-slate-700 text-white focus:ring-cyan-500">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                        <SelectValue placeholder="Chọn vai trò" />
                      </div>
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="bg-[#1E293B] border-slate-700 text-white"
                    >
                      <SelectItem
                        value="student"
                        className=" focus:text-white cursor-pointer"
                      >
                        Học viên (Student)
                      </SelectItem>
                      <SelectItem
                        value="teacher"
                        className=" focus:text-white cursor-pointer"
                      >
                        Giáo viên (Teacher)
                      </SelectItem>
                      <SelectItem
                        value="admin"
                        className=" focus:text-white cursor-pointer text-rose-400"
                      >
                        Quản trị viên (Admin)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-6 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/20 active:scale-95 transition-all"
                >
                  {editingUser ? "Lưu thay đổi" : "Lưu người dùng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA TÀI KHOẢN */}
      <AlertDialog
        open={isDeleteModalOpen}
        onOpenChange={(isOpen) => {
          setIsDeleteModalOpen(isOpen);
          if (!isOpen) setUserToDelete(null);
        }}
      >
        <AlertDialogContent className="bg-[#050B14] border border-[#1EE3CF]/30 text-white max-w-[90%] sm:max-w-md rounded-3xl p-6 shadow-2xl shadow-[#1EE3CF]/5 transition-all outline-none">
          <AlertDialogHeader>
            <div className="flex flex-col items-center text-center pb-2">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-rose-500" />
              </div>
              <AlertDialogTitle className="text-xl font-bold">
                Xác nhận xóa tài khoản
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 mt-2">
                Bạn có chắc chắn muốn xóa tài khoản của{" "}
                <span className="text-white font-semibold">
                  {userToDelete?.name}
                </span>{" "}
                không? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>

          <div className="mt-8 grid grid-cols-2 gap-3 w-full">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="w-full px-4 py-2.5 bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all rounded-xl font-medium"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleConfirmDelete}
              className="w-full px-4 py-2.5 bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-900/20 active:scale-95 transition-all rounded-xl font-medium"
            >
              Xóa tài khoản
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
