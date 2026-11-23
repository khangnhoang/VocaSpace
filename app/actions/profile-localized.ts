"use server";

import { getUserProfile, updateUserPassword, updateUserProfile, uploadAvatar } from "@/app/actions/profile";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// `updateUserPassword` trả cả chuỗi của `auth.actions` (mật khẩu trùng, quá yếu), nên tra thêm namespace `auth`.
const NAMESPACES = ["profile", "auth", "validation"] as const;

// Kèm ngôn ngữ của request vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function getUserProfileLocalized() {
  return withRequestLocale(await getUserProfile(), NAMESPACES);
}

export async function updateUserProfileLocalized(rawData: unknown) {
  return withRequestLocale(await updateUserProfile(rawData), NAMESPACES);
}

export async function uploadAvatarLocalized(formData: FormData) {
  return withRequestLocale(await uploadAvatar(formData), NAMESPACES);
}

export async function updateUserPasswordLocalized(rawData: unknown) {
  return withRequestLocale(await updateUserPassword(rawData), NAMESPACES);
}
