// app/(client)/profile/_components/change-pwd-form.tsx
"use client";

import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordSchema, PasswordFormValues } from "@/lib/schemas/profile";
import { toast } from "sonner";
import { updateUserPassword } from "@/app/actions/profile";

export default function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (data: PasswordFormValues) => {
    startTransition(async () => {
      const res = await updateUserPassword(data);

      // Bắt lỗi an toàn, tuyệt đối không trả về ID của toast
      if (res.error) {
        toast.error(res.error);
        return;
      }

      if (res.success) {
        toast.success("Đổi mật khẩu tài khoản thành công!");
        form.reset(); // Dọn sạch form
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 font-sans">
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Mật khẩu hiện tại *
        </label>
        <input
          type="password"
          {...form.register("currentPassword")}
          placeholder="Nhập mật khẩu đang sử dụng"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none text-sm font-medium transition-colors"
        />
        {form.formState.errors.currentPassword && (
          <p className="mt-1 text-xs font-semibold text-rose-500">
            {form.formState.errors.currentPassword.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Mật khẩu mới *
        </label>
        <input
          type="password"
          {...form.register("newPassword")}
          placeholder="Mật khẩu từ 6 ký tự trở lên"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none text-sm font-medium transition-colors"
        />
        {form.formState.errors.newPassword && (
          <p className="mt-1 text-xs font-semibold text-rose-500">
            {form.formState.errors.newPassword.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          Xác nhận mật khẩu mới *
        </label>
        <input
          type="password"
          {...form.register("confirmPassword")}
          placeholder="Gõ lại chính xác mật khẩu mới"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none text-sm font-medium transition-colors"
        />
        {form.formState.errors.confirmPassword && (
          <p className="mt-1 text-xs font-semibold text-rose-500">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 active:scale-95 transition-all shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {isPending ? "Đang xác thực hệ thống..." : "Cập nhật mật khẩu"}
      </button>
    </form>
  );
}