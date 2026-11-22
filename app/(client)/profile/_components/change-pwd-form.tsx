// app/(client)/profile/_components/change-pwd-form.tsx
"use client";

import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordSchema, PasswordFormValues } from "@/lib/schemas/profile";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { asTranslate, translateIssueMessage } from "@/lib/i18n/translate";
import { updateUserPassword } from "@/app/actions/profile";

export default function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("profile.passwordForm");
  // Message của schema là khóa trong `validation` (U2 H3); form dịch khi hiển thị.
  const tValidation = asTranslate(useTranslations("validation"));

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
        toast.success(t("changed"));
        form.reset(); // Dọn sạch form
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 font-sans">
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          {t("current")}
        </label>
        <input
          type="password"
          {...form.register("currentPassword")}
          placeholder={t("currentPlaceholder")}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-route focus:outline-none focus:ring-2 focus:ring-route-line text-sm font-medium transition-colors"
        />
        {form.formState.errors.currentPassword && (
          <p className="mt-1 text-xs font-semibold text-correction">
            {translateIssueMessage(tValidation, form.formState.errors.currentPassword.message ?? "")}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          {t("new")}
        </label>
        <input
          type="password"
          {...form.register("newPassword")}
          placeholder={t("newPlaceholder")}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-route focus:outline-none focus:ring-2 focus:ring-route-line text-sm font-medium transition-colors"
        />
        {form.formState.errors.newPassword && (
          <p className="mt-1 text-xs font-semibold text-correction">
            {translateIssueMessage(tValidation, form.formState.errors.newPassword.message ?? "")}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          {t("confirm")}
        </label>
        <input
          type="password"
          {...form.register("confirmPassword")}
          placeholder={t("confirmPlaceholder")}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-route focus:outline-none focus:ring-2 focus:ring-route-line text-sm font-medium transition-colors"
        />
        {form.formState.errors.confirmPassword && (
          <p className="mt-1 text-xs font-semibold text-correction">
            {translateIssueMessage(tValidation, form.formState.errors.confirmPassword.message ?? "")}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 w-full rounded-xl bg-action px-4 py-3 text-sm font-bold text-action-foreground hover:bg-action/90 active:scale-95 transition-all shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}