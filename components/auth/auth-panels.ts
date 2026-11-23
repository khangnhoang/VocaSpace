import type { Translate } from "@/lib/i18n/translate";
import type { AuthPanelState } from "./auth-shell-context";

// Chữ của panel bên phải các trang auth, dựng từ catalog `auth.shell.panel`. Chỉ nhận hàm dịch của namespace `auth` nên dùng được
// cả ở client (useTranslations) lẫn server (getTranslations, ví dụ /auth/set-password).
export function loginPanel(t: Translate): AuthPanelState {
  return {
    variant: { kind: "login" },
    copy: { title: t("shell.panel.loginTitle"), text: t("shell.panel.loginText") },
    showFlashcard: true,
  };
}

export function forgotPanel(t: Translate, sent: boolean): AuthPanelState {
  return sent
    ? {
        variant: { kind: "forgot", sent: true },
        copy: { title: t("shell.panel.forgotSentTitle"), text: t("shell.panel.forgotSentText") },
      }
    : {
        variant: { kind: "forgot", sent: false },
        copy: { title: t("shell.panel.forgotTitle"), text: t("shell.panel.forgotText") },
      };
}

export function registerPanel(t: Translate, stage: 1 | 2 | 3 | 4): AuthPanelState {
  return {
    variant: { kind: "register", stage },
    copy: {
      stage: t("shell.panel.stage", { stage }),
      title: t(`shell.panel.register${stage}Title`),
      text: t(`shell.panel.register${stage}Text`),
    },
  };
}

export function settledPanel(t: Translate): AuthPanelState {
  return {
    variant: { kind: "settled" },
    copy: { title: t("shell.panel.settledTitle"), text: t("shell.panel.settledText") },
  };
}
