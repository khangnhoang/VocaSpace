"use server";

import { resendSignupConfirmation, setPasswordAfterConfirmation, signInUser, signUpUser } from "@/app/actions/auth";
import { withRequestLocale } from "@/lib/i18n/request-locale-result";

// Kèm ngôn ngữ của request vào kết quả; lý do và hợp đồng ở `lib/i18n/request-locale-result.ts`.
export async function signInUserLocalized(formData: FormData) {
  return withRequestLocale(await signInUser(formData));
}

export async function signUpUserLocalized(formData: FormData) {
  return withRequestLocale(await signUpUser(formData));
}

export async function resendSignupConfirmationLocalized(email: string) {
  return withRequestLocale(await resendSignupConfirmation(email));
}

export async function setPasswordAfterConfirmationLocalized(formData: FormData) {
  return withRequestLocale(await setPasswordAfterConfirmation(formData));
}
