"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MailCheck } from "lucide-react";
import { resendSignupConfirmation } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { AUTH_LEAD_CLASS, AUTH_TEXT_ACTION_CLASS, AUTH_TITLE_CLASS } from "@/components/auth/auth-fields";
import { mailboxLinkFor } from "@/lib/auth/email-help";
import { cn } from "@/lib/utils";

export const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_FAILED_MESSAGE = "Chưa gửi lại được email, vui lòng thử lại sau.";

type CheckEmailPanelProps = {
  email: string;
  onEditForm: () => void;
};

export function CheckEmailPanel({ email, onEditForm }: CheckEmailPanelProps) {
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState<{ tone: "status" | "error"; text: string } | null>(null);
  const mailbox = mailboxLinkFor(email);

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
      setNotice({ tone: "status", text: result.message });
    } catch {
      setNotice({ tone: "error", text: RESEND_FAILED_MESSAGE });
    } finally {
      setIsSending(false);
    }
  };

  const resendLabel = isSending
    ? "Đang gửi…"
    : cooldown > 0
      ? `Gửi lại email (${cooldown}s)`
      : "Gửi lại email";

  return (
    <section aria-labelledby="check-email-title">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-route-quiet text-route">
        <MailCheck aria-hidden="true" className="size-6" />
      </span>
      <h1 id="check-email-title" tabIndex={-1} className={AUTH_TITLE_CLASS}>
        Kiểm tra email của bạn
      </h1>
      <p className="mt-2 text-base leading-[26px] text-slate-600">Chúng tôi đã gửi link xác minh tới</p>
      <p className="mt-1 mb-3.5 rounded-[12px] bg-slate-100 px-3.5 py-2.5 text-base leading-6 font-bold break-all text-slate-900">
        {email}
      </p>
      <p className={cn(AUTH_LEAD_CLASS, "mt-0 text-sm leading-[22px]")}>
        Bấm link trong email để xác minh, rồi đặt mật khẩu ở chặng cuối.
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
          Sửa thông tin đăng ký
        </button>
      </div>
      <p className="mt-1.5 text-center font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-medium text-slate-500">
        Không thấy email? Xem thư mục Spam hoặc gửi lại sau ít phút.
      </p>
    </section>
  );
}
