// File: app/admin/user-management/page.tsx
"use client";
"use no memo";

import React, { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { adminUserSchema, AdminUserInput } from "@/lib/schemas/auth";
import { getAllUsers, createUserByAdmin, updateUserByAdmin, deleteUserByAdmin } from "@/app/actions/user";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

// Import các mảnh ghép vừa tạo
import { AppUser, ProfileData } from "./_components/types";
import UserStats from "./_components/UserStats";
import UserTable from "./_components/UserTable";
import UserFormModal from "./_components/UserFormModal";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";

const ITEMS_PER_PAGE = 6;

export default function UsermanagementPage() {
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);

  const form = useForm<AdminUserInput>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: { email: "", phone: "", username: "", full_name: "", role: "student" },
  });

  const fetchUsers = async () => {
    setIsLoadingData(true);
    const res = await getAllUsers();
    if (res.error) toast.error(res.error);
    else if (res.data) {
      const formattedUsers: AppUser[] = res.data.map((p: ProfileData) => ({
        id: p.id,
        name: p.full_name || "Chưa cập nhật",
        email: p.email,
        username: p.username || "",
        phone: p.phone || "",
        avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.email}`,
        role: p.role,
        joinDate: new Date(p.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
      }));
      setUsersList(formattedUsers);
    }
    setIsLoadingData(false);
  };

  useEffect(() => {
    const loadInitialData = async () => await fetchUsers();
    loadInitialData();
  }, []);

  const stats = useMemo(() => ({
    student: usersList.filter((u) => u.role === "student").length,
    teacher: usersList.filter((u) => u.role === "teacher").length,
    admin: usersList.filter((u) => u.role === "admin").length,
    total: usersList.length,
  }), [usersList]);

  const { paginatedUsers, totalPages, safeCurrentPage } = useMemo(() => {
    const filtered = usersList.filter((user) => {
      const matchRole = roleFilter === "all" || user.role === roleFilter;
      const lowerQuery = searchQuery.toLowerCase();
      const matchSearch = user.name.toLowerCase().includes(lowerQuery) || user.email.toLowerCase().includes(lowerQuery);
      return matchRole && matchSearch;
    });
    const totalPagesCount = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const safePage = Math.min(currentPage, Math.max(1, totalPagesCount));
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return { paginatedUsers: filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE), totalPages: totalPagesCount, safeCurrentPage: safePage };
  }, [roleFilter, searchQuery, currentPage, usersList]);

  const handleRoleChange = (value: string) => { setRoleFilter(value); setCurrentPage(1); };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); setCurrentPage(1); };

  const onSubmitForm = async (data: AdminUserInput) => {
    setIsSubmitting(true);
    const res = editingUserId ? await updateUserByAdmin(editingUserId, data) : await createUserByAdmin(data);
    if (res.error) toast.error(res.error);
    else { toast.success(res.message); fetchUsers(); setIsFormOpen(false); }
    setIsSubmitting(false);
  };

  const openAddForm = () => {
    setEditingUserId(null);
    form.reset({ email: "", phone: "", username: "", full_name: "", role: "student" });
    setIsFormOpen(true);
  };

  const openEditForm = (user: AppUser) => {
    setEditingUserId(user.id);
    form.reset({ email: user.email, phone: user.phone, username: user.username, full_name: user.name, role: user.role });
    setIsFormOpen(true);
  };

  const openDeleteConfirm = (user: AppUser) => { setUserToDelete(user); setIsDeleteModalOpen(true); };

  const handleConfirmDelete = async () => {
    if (userToDelete) {
      setIsSubmitting(true);
      const res = await deleteUserByAdmin(userToDelete.id);
      if (res.error) toast.error(res.error);
      else { toast.success(res.message); fetchUsers(); }
      setIsSubmitting(false);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  return (
    <div className="bg-[#0F172A] p-6 rounded-xl shadow-lg border border-slate-800 min-h-125 relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r "></div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Quản lý người dùng</h1>
          <p className="text-slate-400 text-sm">Danh sách tài khoản học viên và cán bộ quản lý trên hệ thống.</p>
        </div>
        <button onClick={openAddForm} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 cursor-pointer rounded-lg text-sm font-semibold transition-all shadow-lg shadow-cyan-900/20 active:scale-95">
          <UserPlus size={18} /> Thêm người dùng
        </button>
      </div>

      <UserStats stats={stats} />

      <UserTable 
        searchQuery={searchQuery} onSearchChange={handleSearchChange}
        roleFilter={roleFilter} onRoleChange={handleRoleChange}
        isLoadingData={isLoadingData} paginatedUsers={paginatedUsers}
        totalPages={totalPages} safeCurrentPage={safeCurrentPage}
        setCurrentPage={setCurrentPage} openEditForm={openEditForm} openDeleteConfirm={openDeleteConfirm}
      />

      <UserFormModal 
        isOpen={isFormOpen} setIsOpen={setIsFormOpen} editingUserId={editingUserId}
        form={form} onSubmitForm={onSubmitForm} isSubmitting={isSubmitting}
      />

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen} setIsOpen={setIsDeleteModalOpen}
        userToDelete={userToDelete} setUserToDelete={setUserToDelete}
        handleConfirmDelete={handleConfirmDelete} isSubmitting={isSubmitting}
      />
    </div>
  );
}