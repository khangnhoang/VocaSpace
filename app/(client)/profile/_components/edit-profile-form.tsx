// app/(client)/profile/_components/edit-profile-form.tsx
"use client";

import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSchema,
  ProfileFormValues,
  UserProfileDTO,
} from "@/lib/schemas/profile";
import { toast } from "sonner";
import { updateUserProfile } from "@/app/actions/profile";

interface EditProfileFormProps {
  initialData: UserProfileDTO | null;
  onRefreshData: () => void;
}

export default function EditProfileForm({
  initialData,
  onRefreshData,
}: EditProfileFormProps) {
  const [isPending, startTransition] = useTransition();

  // Khởi tạo form với dữ liệu thật kéo từ DB
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      username: initialData?.username || "",
      dob: initialData?.dob || "",
      gender: initialData?.gender || undefined,
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    startTransition(async () => {
      const res = await updateUserProfile(data);

      // Xử lý tách biệt return tránh cảnh báo của React
      if (res.error) {
        toast.error(res.error);
        return;
      }

      if (res.success) {
        toast.success("Đã lưu thông tin hồ sơ thành công!");
        onRefreshData(); // Kéo lại dữ liệu mới nhất cho Sidebar cập nhật
      }
    });
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 font-sans"
    >
      {/* Trường Email - Read Only */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Địa chỉ Email
        </label>
        <input
          type="text"
          value={initialData?.email || "Chưa cập nhật"}
          readOnly
          disabled
          className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500 cursor-not-allowed text-sm font-medium"
        />
      </div>

      {/* Trường Phone - Read Only */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Số điện thoại
        </label>
        <input
          type="text"
          value={initialData?.phone || "Chưa cập nhật"}
          readOnly
          disabled
          className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500 cursor-not-allowed text-sm font-medium"
        />
      </div>

      {/* Trường Họ Tên */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Họ và tên *
        </label>
        <input
          type="text"
          {...form.register("full_name")}
          placeholder="Nhập họ và tên đầy đủ"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none text-sm font-medium transition-colors"
        />
        {form.formState.errors.full_name && (
          <p className="mt-1 text-xs font-semibold text-rose-500">
            {form.formState.errors.full_name.message}
          </p>
        )}
      </div>

      {/* Trường Username - 🔥 ĐÃ CHUYỂN SANG DẠNG READ-ONLY/DISABLED */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Tên định danh (Username)
        </label>
        <input
          type="text"
          value={initialData?.username || "Chưa thiết lập"}
          readOnly
          disabled
          className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500 cursor-not-allowed text-sm font-medium"
        />
      </div>

      {/* Hàng ngang chứa Ngày sinh & Giới tính */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
            Ngày sinh
          </label>
          <input
            type="date"
            {...form.register("dob")}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none text-sm font-medium transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
            Giới tính
          </label>
          <select
            {...form.register("gender")}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none text-sm font-medium bg-white transition-colors"
          >
            <option value="">Chọn giới tính</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
      </div>

      {/* Nút Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 active:scale-95 transition-all shadow-md shadow-emerald-100 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isPending ? "Đang đồng bộ dữ liệu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
