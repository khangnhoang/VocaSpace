// File: app/admin/user-management/_components/UserFormModal.tsx
"use no memo";
import React from "react";
import { Controller, UseFormReturn } from "react-hook-form";
import { User, Mail, Phone, ShieldCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminUserInput } from "@/lib/schemas/auth";

interface UserFormModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  editingUserId: string | null;
  form: UseFormReturn<AdminUserInput>;
  onSubmitForm: (data: AdminUserInput) => void;
  isSubmitting: boolean;
}

export default function UserFormModal({ isOpen, setIsOpen, editingUserId, form, onSubmitForm, isSubmitting }: UserFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0F172A] border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r"></div>
        <div className="flex items-center justify-between p-6 border-b border-slate-800/80">
          <div><h2 className="text-xl font-bold text-white tracking-tight">{editingUserId ? "Chỉnh sửa thông tin" : "Thêm người dùng mới (Pass: 123456)"}</h2></div>
          <button onClick={() => setIsOpen(false)} className="p-2 cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"><X size={20} /></button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmitForm)} className="p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Họ và tên</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input {...form.register("full_name")} placeholder="VD: Nguyễn Văn A" className="pl-10 bg-[#1E293B]/50 border-slate-700 text-white transition-all duration-300 ease-out focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:ring-offset-0 focus-visible:border-cyan-500" />
              </div>
              {form.formState.errors.full_name && <p className="text-rose-500 text-xs">{form.formState.errors.full_name.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">@</span>
                <Input {...form.register("username")} placeholder="VD: nguyenvana" className="pl-8 bg-[#1E293B]/50 border-slate-700 text-white transition-all duration-300 ease-out focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:ring-offset-0 focus-visible:border-cyan-500" />
              </div>
              {form.formState.errors.username && <p className="text-rose-500 text-xs">{form.formState.errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input type="email" disabled={!!editingUserId} {...form.register("email")} placeholder="VD: email@example.com" className="pl-10 bg-[#1E293B]/50 border-slate-700 text-white transition-all duration-300 ease-out disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:ring-offset-0 focus-visible:border-cyan-500" />
              </div>
              {form.formState.errors.email && <p className="text-rose-500 text-xs">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Số điện thoại</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input type="tel" {...form.register("phone")} placeholder="VD: 0987654321" className="pl-10 bg-[#1E293B]/50 border-slate-700 text-white transition-all duration-300 ease-out focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:ring-offset-0 focus-visible:border-cyan-500" />
              </div>
              {form.formState.errors.phone && <p className="text-rose-500 text-xs">{form.formState.errors.phone.message}</p>}
            </div>
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-300">Vai trò (Role)</label>
              <Controller control={form.control} name="role" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full bg-[#1E293B]/50 border-slate-700 text-white transition-all duration-300 ease-out focus:ring-cyan-500">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-400" /><SelectValue placeholder="Chọn vai trò" /></div>
                  </SelectTrigger>
                  <SelectContent position="popper" className="dark bg-[#1E293B] border-slate-700 text-white">
                    <SelectItem value="student" className="focus:text-white cursor-pointer">Học viên (Student)</SelectItem>
                    <SelectItem value="teacher" className="focus:text-white cursor-pointer">Giáo viên (Teacher)</SelectItem>
                    <SelectItem value="admin" className="focus:text-white cursor-pointer text-rose-400">Quản trị viên (Admin)</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-4 pt-6 border-t border-slate-800/80">
            <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 cursor-pointer rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all">Hủy bỏ</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 cursor-pointer rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/20 active:scale-95 transition-all">{isSubmitting ? "Đang xử lý..." : editingUserId ? "Lưu thay đổi" : "Lưu người dùng"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}