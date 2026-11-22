"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ExternalLink, Loader2, MailCheck } from "lucide-react";
import { requestPasswordRecovery } from "@/app/actions/auth";
import { passwordRecoveryRequestSchema, type PasswordRecoveryRequestInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { AuthNotice, EmailField } from "@/components/auth/auth-fields";
import { useAuthPanel } from "@/components/auth/auth-shell-context";
import { mailboxLinkFor } from "@/lib/auth/email-help";
import { asTranslate, translateIssueMessage } from "@/lib/i18n/translate";
import { forgotPanel } from "@/components/auth/auth-panels";

const COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const tx = asTranslate(useTranslations("validation"));
  const fieldError = (message: string | undefined) => (message ? translateIssueMessage(tx, message) : undefined);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const submitting = useRef(false);
  const form = useForm<PasswordRecoveryRequestInput>({
    resolver: zodResolver(passwordRecoveryRequestSchema),
    defaultValues: { email: "" },
  });

  useAuthPanel(sentTo ? forgotPanel(asTranslate(t), true) : null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = async (data: PasswordRecoveryRequestInput) => {
    if (submitting.current || cooldown > 0) return;
    submitting.current = true;
    setIsSending(true);
    setCooldown(COOLDOWN_SECONDS);
    try {
      await requestPasswordRecovery(data.email);
    } catch {
      // G5: cả lỗi transport cũng dùng cùng thông báo và cooldown, không lộ trạng thái email.
    } finally {
      setSentTo(data.email);
      setIsSending(false);
      submitting.current = false;
    }
  };

  const submitLabel = isSending ? t("forgot.sending")
    : cooldown > 0 ? t("forgot.resendCooldown", { seconds: cooldown }) : sentTo ? t("forgot.resend") : t("forgot.submit");
  const mailbox = sentTo ? mailboxLinkFor(sentTo, asTranslate(t)) : null;

  return (
    <>
      <Link
        href="/login"
        className="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-[8px] text-sm font-semibold text-route hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("forgot.back")}
      </Link>
      <h1 className="text-[28px] leading-9 font-extrabold tracking-[-0.015em] text-slate-900 min-[960px]:text-[32px] min-[960px]:leading-10">
        {t("forgot.title")}
      </h1>
      <p className="mt-2 mb-6 text-base leading-[26px] text-slate-600">
        {t("forgot.lead")}
      </p>

      {sentTo ? (
        <AuthNotice tone="recall" role="status" icon={<MailCheck />}>
          {t("actions.recovery")}
        </AuthNotice>
      ) : null}

      {/* U3 G10: method="post" để một lần submit trước khi hydrate không đưa email lên URL. */}
      <form method="post" noValidate onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} className="grid gap-[18px]">
        <EmailField
          id="recovery-email"
          registration={form.register("email")}
          error={fieldError(form.formState.errors.email?.message)}
          onApplySuggestion={(value) =>
            form.setValue("email", value, { shouldValidate: Boolean(form.formState.errors.email) })
          }
        />
        <div className="grid gap-2.5">
          <Button
            type="submit"
            size="lg"
            disabled={isSending || cooldown > 0}
            aria-busy={isSending}
            className="h-11 w-full rounded-[8px] text-sm font-semibold disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100 aria-busy:bg-action aria-busy:text-white"
          >
            {isSending ? <Loader2 aria-hidden="true" className="motion-safe:animate-spin" /> : null}
            {submitLabel}
          </Button>
          {mailbox ? (
            <Button asChild variant="outline" size="lg" className="h-11 w-full rounded-[8px] border-slate-500 text-sm font-semibold text-slate-900">
              <a href={mailbox.href} target="_blank" rel="noopener noreferrer">
                {mailbox.label}
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </form>
    </>
  );
}
