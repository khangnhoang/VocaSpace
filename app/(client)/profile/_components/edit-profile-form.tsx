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
import { useLocale, useTranslations } from "next-intl";
import { asTranslate, translateIssueMessage } from "@/lib/i18n/translate";
import { useLatest } from "@/lib/i18n/held-message";
import { showProfileNotice, type EmitProfileNotice } from "./profile-notice";
import type { Locale } from "@/lib/i18n/config";
import { updateUserProfileLocalized } from "@/app/actions/profile-localized";

interface EditProfileFormProps {
  initialData: UserProfileDTO | null;
  onRefreshData: () => void;
  // Do `ProfileSidebar` cấp để toast không phụ thuộc form còn mounted hay không; thiếu thì form tự phát (xem profile-notice.ts).
  onNotice?: EmitProfileNotice;
}

export default function EditProfileForm({
  initialData,
  onRefreshData,
  onNotice,
}: EditProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("profile.editForm");
  const tRoot = asTranslate(useTranslations());
  const locale = useLocale() as Locale;
  // Toast phát sau khi request xong nên dịch theo ngôn ngữ lúc đó, không phải lúc bấm lưu.
  const latest = useLatest({ t: tRoot, locale });
  const notify = onNotice ?? ((notice) => showProfileNotice(notice, latest));
  // Message của schema là khóa trong `validation` (U2 H3); form dịch khi hiển thị, nên mỗi lỗi hiện đúng ở ngôn ngữ đang dùng.
  const tValidation = asTranslate(useTranslations("validation"));

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
  // theo dõi lỗi này và message không hiện trong trình duyệt (jsdom vẫn hiện; smoke E2E profile-username-once bắt lỗi này).
  const usernameError = form.formState.errors.username;

  const onSubmit = (data: ProfileFormValues) => {
    startTransition(async () => {
      const { result: res, ...reply } = await updateUserProfileLocalized(data);

      // Xử lý tách biệt return tránh cảnh báo của React
      if (res.error) {
        notify({ type: "error", text: res.error, reply, fallbackKey: "profile.actions.updateFailed" });
        return;
      }

      if (res.success) {
        notify({ type: "success", key: "profile.editForm.saved" });
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
          {t("email")}
        </label>
        <input
          type="text"
          value={initialData?.email || t("notProvided")}
          readOnly
          disabled
          className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500 cursor-not-allowed text-sm font-medium"
        />
      </div>

      {/* Trường Phone - Read Only */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          {t("phone")}
        </label>
        <input
          type="text"
          value={initialData?.phone || t("notProvided")}
          readOnly
          disabled
          className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500 cursor-not-allowed text-sm font-medium"
        />
      </div>

      {/* Trường Họ Tên */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
          {t("fullName")}
        </label>
        <input
          type="text"
          {...form.register("full_name")}
          placeholder={t("fullNamePlaceholder")}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-route focus:outline-none focus:ring-2 focus:ring-route-line text-sm font-medium transition-colors"
        />
        {form.formState.errors.full_name && (
          <p className="mt-1 text-xs font-semibold text-correction">
            {translateIssueMessage(tValidation, form.formState.errors.full_name.message ?? "")}
          </p>
        )}
      </div>

      {/* Trường Username - chỉ đặt được một lần, khóa khi đã có giá trị */}
      <div>
        <label
          htmlFor={canSetUsername ? "profile-username" : undefined}
          className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1"
        >
          {t("username")}
        </label>
        {canSetUsername ? (
          <>
            <input
              id="profile-username"
              type="text"
              {...form.register("username")}
              aria-describedby="profile-username-help"
              placeholder={t("usernamePlaceholder")}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-route focus:outline-none focus:ring-2 focus:ring-route-line text-sm font-medium transition-colors"
            />
            <p id="profile-username-help" className="mt-1 text-xs text-slate-500">
              {t("usernameHelp")}
            </p>
            {usernameError && (
              <p className="mt-1 text-xs font-semibold text-correction">
                {translateIssueMessage(tValidation, usernameError.message ?? "")}
              </p>
            )}
          </>
        ) : (
          <input
            type="text"
            value={initialData?.username || t("usernameUnset")}
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
            {t("dob")}
          </label>
          <input
            type="date"
            {...form.register("dob")}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-route focus:outline-none focus:ring-2 focus:ring-route-line text-sm font-medium transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
            {t("gender")}
          </label>
          <select
            {...form.register("gender")}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:border-route focus:outline-none focus:ring-2 focus:ring-route-line text-sm font-medium bg-white transition-colors"
          >
            <option value="">{t("genderPlaceholder")}</option>
            <option value="male">{t("genderMale")}</option>
            <option value="female">{t("genderFemale")}</option>
            <option value="other">{t("genderOther")}</option>
          </select>
        </div>
      </div>

      {/* Nút Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="mt-6 w-full rounded-xl bg-action px-4 py-3 text-sm font-bold text-action-foreground hover:bg-action/90 active:scale-95 transition-all shadow-md shadow-route-line/40 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
