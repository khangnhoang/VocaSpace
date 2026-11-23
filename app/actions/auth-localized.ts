"use server";

import { resendSignupConfirmation, setPasswordAfterConfirmation, signInUser, signUpUser } from "@/app/actions/auth";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// Namespace chứa chuỗi mà các action này trả về; client tra lại khóa trong đó (xem `lib/i18n/message-key.ts`).
const NAMESPACES = ["auth", "validation"] as const;

// Kèm ngôn ngữ của request vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function signInUserLocalized(formData: FormData) {
  return withRequestLocale(await signInUser(formData), NAMESPACES);
}

export async function signUpUserLocalized(formData: FormData) {
  return withRequestLocale(await signUpUser(formData), NAMESPACES);
}

export async function resendSignupConfirmationLocalized(email: string) {
  return withRequestLocale(await resendSignupConfirmation(email), NAMESPACES);
}

export async function setPasswordAfterConfirmationLocalized(formData: FormData) {
  return withRequestLocale(await setPasswordAfterConfirmation(formData), NAMESPACES);
}
