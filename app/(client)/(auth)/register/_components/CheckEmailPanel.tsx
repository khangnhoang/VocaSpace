"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Loader2, MailCheck } from "lucide-react";
import { resendSignupConfirmation } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { AUTH_LEAD_CLASS, AUTH_TEXT_ACTION_CLASS, AUTH_TITLE_CLASS } from "@/components/auth/auth-fields";
import { mailboxLinkFor } from "@/lib/auth/email-help";
import { asTranslate } from "@/lib/i18n/translate";
import { heldKey, heldText, resolveHeldMessage, type HeldMessage } from "@/lib/i18n/held-message";
import { cn } from "@/lib/utils";

export const RESEND_COOLDOWN_SECONDS = 60;

type CheckEmailPanelProps = {
  email: string;
  onEditForm: () => void;
};

export function CheckEmailPanel({ email, onEditForm }: CheckEmailPanelProps) {
  const t = useTranslations("auth");
  const locale = useLocale() === "en" ? "en" : "vi";
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Thông báo giữ qua lần đổi ngôn ngữ: khóa hoặc chuỗi gắn ngôn ngữ của request, dịch/lọc lúc render (xem held-message.ts).
  const [heldNotice, setNotice] = useState<{ tone: "status" | "error"; message: HeldMessage } | null>(null);
  const noticeText = heldNotice ? resolveHeldMessage(heldNotice.message, locale, asTranslate(t)) : null;
  const notice = heldNotice && noticeText ? { tone: heldNotice.tone, text: noticeText } : null;
  const mailbox = mailboxLinkFor(email, asTranslate(t));

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // G5: server luôn trả cùng một thông điệp, nên mọi lần bấm đều chờ đủ 60 giây như nhau.
  const handleResend = async () => {
    setIsSending(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    try {
      const result = await resendSignupConfirmation(email);
      setNotice({ tone: "status", message: heldText(result.message, locale) });
    } catch {
      setNotice({ tone: "error", message: heldKey("checkEmail.resendFailed") });
    } finally {
      setIsSending(false);
    }
  };

  const resendLabel = isSending
    ? t("checkEmail.sending")
    : cooldown > 0
      ? t("checkEmail.resendCooldown", { seconds: cooldown })
      : t("checkEmail.resend");

  return (
    <section aria-labelledby="check-email-title">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-route-quiet text-route">
        <MailCheck aria-hidden="true" className="size-6" />
      </span>
      <h1 id="check-email-title" tabIndex={-1} className={AUTH_TITLE_CLASS}>
        {t("checkEmail.title")}
      </h1>
      <p className="mt-2 text-base leading-[26px] text-slate-600">{t("checkEmail.sentTo")}</p>
      <p className="mt-1 mb-3.5 rounded-[12px] bg-slate-100 px-3.5 py-2.5 text-base leading-6 font-bold break-all text-slate-900">
        {email}
      </p>
      <p className={cn(AUTH_LEAD_CLASS, "mt-0 text-sm leading-[22px]")}>
        {t("checkEmail.lead")}
      </p>
      <div className="grid gap-2.5">
        {mailbox ? (
          <Button asChild size="lg" className="h-11 w-full rounded-[8px] text-sm font-semibold">
            <a href={mailbox.href} target="_blank" rel="noopener noreferrer">
              {mailbox.label}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          variant={mailbox ? "outline" : "default"}
          onClick={handleResend}
          disabled={isSending || cooldown > 0}
          aria-busy={isSending}
          className={cn(
            "h-11 w-full rounded-[8px] text-sm font-semibold disabled:opacity-100",
            mailbox
              ? "border-slate-500 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
              : "disabled:bg-slate-200 disabled:text-slate-600 aria-busy:bg-action aria-busy:text-white",
          )}
        >
          {isSending ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
          {resendLabel}
        </Button>
        <div aria-live="polite">
          {notice ? (
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={cn(
                "text-center font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-medium",
                notice.tone === "error" ? "text-correction" : "text-slate-600",
              )}
            >
              {notice.text}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={onEditForm} className={AUTH_TEXT_ACTION_CLASS}>
          {t("checkEmail.edit")}
        </button>
      </div>
      <p className="mt-1.5 text-center font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-medium text-slate-500">
        {t("checkEmail.spamNote")}
      </p>
    </section>
  );
}
