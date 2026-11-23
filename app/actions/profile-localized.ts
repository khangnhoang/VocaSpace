"use server";

import { getUserProfile, updateUserPassword, updateUserProfile, uploadAvatar } from "@/app/actions/profile";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ và khóa catalog của thông báo vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function getUserProfileLocalized() {
  return withRequestLocale(() => getUserProfile());
}

export async function updateUserProfileLocalized(rawData: unknown) {
  return withRequestLocale(() => updateUserProfile(rawData));
}

export async function uploadAvatarLocalized(formData: FormData) {
  return withRequestLocale(() => uploadAvatar(formData));
}

export async function updateUserPasswordLocalized(rawData: unknown) {
  return withRequestLocale(() => updateUserPassword(rawData));
}
