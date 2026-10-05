// app/(client)/profile/_components/edit-profile-form.tsx
"use client";

import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSchema,
  ProfileFormInput,
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
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      username: initialData?.username || "",
      dob: initialData?.dob || "",
      gender: initialData?.gender || undefined,
    },
  });

  // Username chỉ nhập được khi hồ sơ chưa có; khi đã có thì ô bị khóa và không được đăng ký vào form.
  // Server vẫn tự đọc username hiện tại và bỏ qua giá trị gửi lên nếu đã có.
  const canSetUsername = !initialData?.username;
  // Đọc lỗi ở đầu render: nếu chỉ đọc trong nhánh JSX có điều kiện thì React Compiler làm form không đăng ký
  // theo dõi lỗi này và message không hiện trong trình duyệt (jsdom vẫn hiện nên test không bắt được).
  const usernameError = form.formState.errors.username;

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

      {/* Trường Username - chỉ đặt được một lần, khóa khi đã có giá trị */}
      <div>
        <label
          htmlFor={canSetUsername ? "profile-username" : undefined}
          className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1"
        >
          Tên định danh (Username)
        </label>
        {canSetUsername ? (
          <>
            <input
              id="profile-username"
              type="text"
              {...form.register("username")}
              aria-describedby="profile-username-help"
              placeholder="Nhập username (từ 3 ký tự)"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none text-sm font-medium transition-colors"
            />
            <p id="profile-username-help" className="mt-1 text-xs text-slate-500">
              Bạn chỉ đặt được username một lần.
            </p>
            {usernameError && (
              <p className="mt-1 text-xs font-semibold text-rose-500">
                {usernameError.message}
              </p>
            )}
          </>
        ) : (
          <input
            type="text"
            value={initialData?.username || "Chưa thiết lập"}
            readOnly
            disabled
            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500 cursor-not-allowed text-sm font-medium"
          />
        )}
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
