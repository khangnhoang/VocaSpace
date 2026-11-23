"use server";

import { resendSignupConfirmation, setPasswordAfterConfirmation, signInUser, signUpUser } from "@/app/actions/auth";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ và khóa catalog của thông báo vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function signInUserLocalized(formData: FormData) {
  return withRequestLocale(() => signInUser(formData));
}

export async function signUpUserLocalized(formData: FormData) {
  return withRequestLocale(() => signUpUser(formData));
}

export async function resendSignupConfirmationLocalized(email: string) {
  return withRequestLocale(() => resendSignupConfirmation(email));
}

export async function setPasswordAfterConfirmationLocalized(formData: FormData) {
  return withRequestLocale(() => setPasswordAfterConfirmation(formData));
}
