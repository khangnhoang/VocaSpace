"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordSchema, PasswordFormValues } from "@/lib/schemas/profile";
import { toast } from "sonner";

export default function ChangePasswordForm() {
  const [isPending, setIsPending] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setIsPending(true);
    // Fake API Delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log("Mật khẩu đổi thành:", data);
    toast.success("Đổi mật khẩu thành công!");
    form.reset(); // Xóa trắng form sau khi thành công
    setIsPending(false);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Mật khẩu hiện tại
        </label>
        <input
          type="password"
          {...form.register("currentPassword")}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
        />
        {form.formState.errors.currentPassword && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.currentPassword.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Mật khẩu mới
        </label>
        <input
          type="password"
          {...form.register("newPassword")}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
        />
        {form.formState.errors.newPassword && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.newPassword.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Xác nhận mật khẩu
        </label>
        <input
          type="password"
          {...form.register("confirmPassword")}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
        />
        {form.formState.errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
      >
        {isPending ? "Đang xử lý..." : "Cập nhật mật khẩu"}
      </button>
    </form>
  );
}
