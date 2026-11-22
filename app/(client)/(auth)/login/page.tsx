"use client";
import { Suspense, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "motion/react";
import { useAnimate } from "motion/react-mini";
import * as m from "motion/react-m";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Check, ChevronRight, Info, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { signInUser } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { SIGN_IN_REASON_KEYS, SIGN_IN_REASON_PARAM } from "@/lib/auth/sign-in-reason";
import { asTranslate, translateIssueMessage } from "@/lib/i18n/translate";
import { GoogleSignInButton, LastUsedTag } from "@/components/auth/google-sign-in-button";
import { LegalConsentNotice } from "@/components/auth/legal-consent-notice";
import { AuthDivider, AuthNotice, EmailField, PasswordField } from "@/components/auth/auth-fields";
import { useAuthShell } from "@/components/auth/auth-shell-context";
import { cn } from "@/lib/utils";

// Khóa trong catalog `auth`, tra theo `auth_error` trên URL.
const AUTH_ERROR_KEYS: Record<string, string> = {
  confirm: "login.authError.confirm",
  recovery: "login.authError.recovery",
  oauth: "login.authError.oauth",
};

// Đọc `auth_error` trong Suspense riêng để trang đăng nhập vẫn prerender được.
function AuthErrorNotice() {
  const t = asTranslate(useTranslations("auth"));
  const authError = useSearchParams().get("auth_error");
  // Chỉ nhận đúng key của map; tra thẳng thì `__proto__`/`constructor` trả về object của prototype.
  const key = authError && Object.hasOwn(AUTH_ERROR_KEYS, authError) ? AUTH_ERROR_KEYS[authError] : undefined;
  if (!key) return null;
  const message = t(key);

  return (
    <AuthNotice tone="error" role="alert" icon={<AlertCircle />}>
      {message}
    </AuthNotice>
  );
}

// Lý do redirect không phải lỗi nên dùng role="status"; chỉ hiện message tra từ map cố định (G1).
function SignInReasonNotice() {
  const t = asTranslate(useTranslations("auth"));
  const reason = useSearchParams().get(SIGN_IN_REASON_PARAM);
  const key = reason && Object.hasOwn(SIGN_IN_REASON_KEYS, reason) ? SIGN_IN_REASON_KEYS[reason] : undefined;
  if (!key) return null;
  const message = t(key);

  return (
    <AuthNotice tone="info" role="status" icon={<Info />}>
      {message}
    </AuthNotice>
  );
}

// Lời gọi Server Action thất bại (mạng, hoặc máy chủ lỗi/5xx) không phải lỗi thông tin đăng nhập, nên không báo "sai mật
// khẩu" (U3 quyết định 15): dùng `login.networkFailed` thay vì `actions.signInFailed`.
export default function LoginPage() {
  const t = useTranslations("auth");
  const tx = asTranslate(useTranslations("validation"));
  const fieldError = (message: string | undefined) => (message ? translateIssueMessage(tx, message) : undefined);
  const router = useRouter();
  const { lastSignInMethod, setPasswordFocused } = useAuthShell();
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const submitting = useRef(false);
  const [formScope, animate] = useAnimate<HTMLDivElement>();
  const reduceMotion = useReducedMotion();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = async (data: LoginInput) => {
    if (submitting.current) return;
    submitting.current = true;
    setServerError(null);
    setStatus("pending");
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);

    try {
      const res = await signInUser(formData);
      if (res?.error || !res?.success) {
        setServerError(res?.error ?? t("actions.signInFailed"));
        setStatus("idle");
        form.setFocus("password", { shouldSelect: true });
        // Rung một lần để báo thất bại; thông báo lỗi và focus đã có ngay, không chờ hiệu ứng (AC13).
        if (!reduceMotion && typeof formScope.current?.animate === "function") {
          animate(formScope.current, { transform: ["translateX(0px)", "translateX(-6px)", "translateX(6px)", "translateX(-4px)", "translateX(3px)", "translateX(0px)"] }, { duration: 0.34, ease: [0.2, 0, 0, 1] });
        }
        return;
      }
      setStatus("success");
      // Đích đã được server kiểm tra theo allowlist (U3 G1); refresh để header lấy phiên mới.
      router.replace(res.redirectTo ?? "/");
      router.refresh();
    } catch {
      setServerError(t("login.networkFailed"));
      setStatus("idle");
      // Giữ nguyên mật khẩu, không bôi đen và không rung: chỉ cần nhấn Enter để thử lại.
      form.setFocus("password");
    } finally {
      submitting.current = false;
    }
  };

  const googleFirst = lastSignInMethod === "google";
  const google = <GoogleSignInButton lastUsed={googleFirst} />;

  return (
    <>
      <h1 className="text-[28px] leading-9 font-extrabold tracking-[-0.015em] text-slate-900 min-[960px]:text-[32px] min-[960px]:leading-10">
        {t("login.title")}
      </h1>
      <p className="mt-2 mb-6 text-base leading-[26px] text-slate-600">{t("login.lead")}</p>

      <Suspense fallback={null}>
        <SignInReasonNotice />
        <AuthErrorNotice />
      </Suspense>
      {serverError ? (
        <AuthNotice tone="error" role="alert" icon={<AlertCircle />}>
          {serverError}
        </AuthNotice>
      ) : null}

      {googleFirst ? (
        <>
          {google}
          <AuthDivider label={t("login.dividerEmail")} className="my-4" />
        </>
      ) : null}

      {/* U3 G10: method="post" để một lần submit trước khi hydrate không đưa mật khẩu lên URL. */}
      <div ref={formScope}>
      <form method="post" noValidate onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} className="grid gap-[18px]">
        <EmailField
          id="login-email"
          registration={form.register("email")}
          error={fieldError(errors.email?.message)}
          labelAside={lastSignInMethod === "email" ? <LastUsedTag /> : null}
          onApplySuggestion={(value) => form.setValue("email", value, { shouldValidate: Boolean(errors.email) })}
        />
        <div className="grid gap-1">
          <PasswordField
            id="login-password"
            label={t("login.password")}
            autoComplete="current-password"
            registration={form.register("password")}
            error={fieldError(errors.password?.message)}
            onFocusChange={setPasswordFocused}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center rounded-[8px] px-0.5 text-sm font-semibold text-route hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route"
            >
              {t("login.forgot")}
            </Link>
          </div>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={status !== "idle"}
          aria-busy={status === "pending"}
          className={cn(
            "h-11 w-full rounded-[8px] text-sm font-semibold disabled:opacity-100",
            status === "success" && "bg-growth hover:bg-growth",
          )}
        >
          {status === "pending" ? (
            <>
              <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />
              {t("login.submitting")}
            </>
          ) : status === "success" ? (
            <>
              <m.span
                aria-hidden="true"
                initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex"
              >
                <Check />
              </m.span>
              {t("login.success")}
            </>
          ) : (
            <>
              {t("login.submit")}
              <ChevronRight aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
      </div>

      {googleFirst ? null : (
        <>
          <AuthDivider label={t("login.divider")} className="mt-5 mb-4" />
          {google}
        </>
      )}
      <div className="mt-5">
        <LegalConsentNotice />
      </div>
    </>
  );
}
