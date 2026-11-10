"use client";
import { Suspense, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Check, ChevronRight, Info, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { signInUser } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { SIGN_IN_REASON_MESSAGES, SIGN_IN_REASON_PARAM } from "@/lib/auth/sign-in-reason";
import { GoogleSignInButton, LastUsedTag } from "@/components/auth/google-sign-in-button";
import { LegalConsentNotice } from "@/components/auth/legal-consent-notice";
import { AuthNotice, EmailField, PasswordField } from "@/components/auth/auth-fields";
import { useAuthShell } from "@/components/auth/auth-shell-context";
import { cn } from "@/lib/utils";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  confirm: "Link xác minh không hợp lệ hoặc đã hết hạn",
  recovery: "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Bạn có thể gửi lại link mới.",
  oauth: "Đăng nhập Google không thành công. Bạn có thể thử lại hoặc đăng nhập bằng email.",
};

// Đọc `auth_error` trong Suspense riêng để trang đăng nhập vẫn prerender được.
function AuthErrorNotice() {
  const authError = useSearchParams().get("auth_error");
  // Chỉ nhận đúng key của map; tra thẳng thì `__proto__`/`constructor` trả về object của prototype.
  const message =
    authError && Object.hasOwn(AUTH_ERROR_MESSAGES, authError) ? AUTH_ERROR_MESSAGES[authError] : undefined;
  if (!message) return null;

  return (
    <AuthNotice tone="error" role="alert" icon={<AlertCircle />}>
      {message}
    </AuthNotice>
  );
}

// Lý do redirect không phải lỗi nên dùng role="status"; chỉ hiện message tra từ map cố định (G1).
function SignInReasonNotice() {
  const reason = useSearchParams().get(SIGN_IN_REASON_PARAM);
  const message = reason && Object.hasOwn(SIGN_IN_REASON_MESSAGES, reason) ? SIGN_IN_REASON_MESSAGES[reason] : undefined;
  if (!message) return null;

  return (
    <AuthNotice tone="info" role="status" icon={<Info />}>
      {message}
    </AuthNotice>
  );
}

const SIGN_IN_FAILED_FALLBACK = "Sai email hoặc mật khẩu!";

export default function LoginPage() {
  const router = useRouter();
  const { lastSignInMethod, setPasswordFocused } = useAuthShell();
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const submitting = useRef(false);

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
        setServerError(res?.error ?? SIGN_IN_FAILED_FALLBACK);
        setStatus("idle");
        form.setFocus("password", { shouldSelect: true });
        return;
      }
      setStatus("success");
      // Đích đã được server kiểm tra theo allowlist (U3 G1); refresh để header lấy phiên mới.
      router.replace(res.redirectTo ?? "/");
      router.refresh();
    } catch {
      setServerError(SIGN_IN_FAILED_FALLBACK);
      setStatus("idle");
    } finally {
      submitting.current = false;
    }
  };

  const googleFirst = lastSignInMethod === "google";
  const google = <GoogleSignInButton lastUsed={googleFirst} />;

  return (
    <>
      <h1 className="text-[28px] leading-9 font-extrabold tracking-[-0.015em] text-slate-900 min-[960px]:text-[32px] min-[960px]:leading-10">
        Chào mừng trở lại
      </h1>
      <p className="mt-2 mb-6 text-base leading-[26px] text-slate-600">Đăng nhập để học tiếp đúng chỗ bạn đã dừng.</p>

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
          <Divider label="hoặc dùng email" className="my-4" />
        </>
      ) : null}

      {/* U3 G10: method="post" để một lần submit trước khi hydrate không đưa mật khẩu lên URL. */}
      <form method="post" noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-[18px]">
        <EmailField
          id="login-email"
          registration={form.register("email")}
          error={errors.email?.message}
          labelAside={lastSignInMethod === "email" ? <LastUsedTag /> : null}
          onApplySuggestion={(value) => form.setValue("email", value, { shouldValidate: Boolean(errors.email) })}
        />
        <div className="grid gap-1">
          <PasswordField
            id="login-password"
            label="Mật khẩu"
            autoComplete="current-password"
            registration={form.register("password")}
            error={errors.password?.message}
            onFocusChange={setPasswordFocused}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center rounded-[8px] px-0.5 text-sm font-semibold text-route hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route"
            >
              Quên mật khẩu?
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
              Đang đăng nhập…
            </>
          ) : status === "success" ? (
            <>
              <Check aria-hidden="true" />
              Đã đăng nhập
            </>
          ) : (
            <>
              Đăng nhập
              <ChevronRight aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      {googleFirst ? null : (
        <>
          <Divider label="hoặc" className="mt-5 mb-4" />
          {google}
        </>
      )}
      <div className="mt-5">
        <LegalConsentNotice />
      </div>
    </>
  );
}

function Divider({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 font-[family-name:var(--font-geist-sans)] text-xs leading-4 font-semibold text-slate-500 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200",
        className,
      )}
    >
      {label}
    </div>
  );
}
