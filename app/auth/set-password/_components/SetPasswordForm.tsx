"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { unstable_rethrow } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { setPasswordSchema, type SetPasswordInput } from "@/lib/schemas/auth";
import { setPasswordAfterConfirmation } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { AUTH_LEAD_CLASS, AUTH_TITLE_CLASS, AuthNotice, PasswordField } from "@/components/auth/auth-fields";
import { ProgressionRail } from "@/components/auth/progression-rail";
import { PASSWORD_STRENGTH_KEYS, passwordStrength } from "@/lib/auth/password-strength";
import { asTranslate, translateIssueMessage } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

const STRENGTH_COLORS = ["bg-correction", "bg-correction", "bg-attention", "bg-recall", "bg-growth"] as const;
const STRENGTH_TEXT = ["text-correction", "text-correction", "text-attention", "text-recall", "text-growth"] as const;

export function SetPasswordForm() {
  const t = useTranslations("auth");
  const tx = asTranslate(useTranslations("validation"));
  const fieldError = (message: string | undefined) => (message ? translateIssueMessage(tx, message) : undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const password = useWatch({ control: form.control, name: "password" });
  const confirmPassword = useWatch({ control: form.control, name: "confirmPassword" });
  const strength = passwordStrength(password);
  const matches = password.length >= 6 && confirmPassword === password;

  const onSubmit = async (data: SetPasswordInput) => {
    setIsLoading(true);
    setServerError(null);
    const formData = new FormData();
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);

    // Thành công thì action redirect về "/"; chỉ quay lại đây khi có lỗi.
    try {
      const res = await setPasswordAfterConfirmation(formData);
      if (res?.error) setServerError(res.error);
    } catch (error) {
      unstable_rethrow(error);
      setServerError(t("actions.setPasswordFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ProgressionRail label={t("setPassword.railLabel")} steps={[t("setPassword.step1"), t("setPassword.step2")]} current={2} />
      <h1 className={AUTH_TITLE_CLASS}>{t("setPassword.title")}</h1>
      <p className={AUTH_LEAD_CLASS}>{t("setPassword.lead")}</p>

      {serverError ? (
        <AuthNotice tone="error" role="alert" icon={<AlertCircle />}>
          {serverError}
        </AuthNotice>
      ) : null}

      {/* U3 G10: method="post" để một lần submit trước khi hydrate không đưa mật khẩu lên URL. */}
      <form method="post" noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-[18px]">
        <PasswordField
          id="new-password"
          label={t("setPassword.newPassword")}
          autoComplete="new-password"
          registration={form.register("password")}
          error={fieldError(form.formState.errors.password?.message)}
          details={{
            id: "new-password-strength",
            node: (
              <div className="grid gap-1.5">
                <div aria-hidden="true" className="grid grid-cols-4 gap-1">
                  {[0, 1, 2, 3].map((bar) => (
                    <span
                      key={bar}
                      className={cn(
                        "h-1 rounded-full bg-slate-200 transition-colors duration-200",
                        password && bar < Math.max(strength, 1) && STRENGTH_COLORS[strength],
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 font-[family-name:var(--font-geist-sans)] text-xs leading-4">
                  <span className="font-medium text-slate-500">{t("setPassword.minHint")}</span>
                  <span aria-live="polite" className={cn("font-semibold", STRENGTH_TEXT[strength])}>
                    {password ? t("setPassword.strength", { level: asTranslate(t)(PASSWORD_STRENGTH_KEYS[strength]) }) : ""}
                  </span>
                </div>
              </div>
            ),
          }}
        />
        <PasswordField
          id="confirm-new-password"
          label={t("setPassword.confirmPassword")}
          autoComplete="new-password"
          registration={form.register("confirmPassword")}
          error={fieldError(form.formState.errors.confirmPassword?.message)}
          details={
            matches
              ? {
                  id: "confirm-new-password-match",
                  node: (
                    <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold text-growth">
                      <Check aria-hidden="true" className="size-4" />
                      {t("setPassword.match")}
                    </p>
                  ),
                }
              : undefined
          }
        />
        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          aria-busy={isLoading}
          className="h-11 w-full rounded-[8px] text-sm font-semibold disabled:opacity-100"
        >
          {isLoading ? (
            <>
              <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />
              {t("setPassword.saving")}
            </>
          ) : (
            t("setPassword.save")
          )}
        </Button>
      </form>
    </>
  );
}
