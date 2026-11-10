"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { unstable_rethrow } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { setPasswordSchema, type SetPasswordInput } from "@/lib/schemas/auth";
import { setPasswordAfterConfirmation } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { AUTH_LEAD_CLASS, AUTH_TITLE_CLASS, AuthNotice, PasswordField } from "@/components/auth/auth-fields";
import { ProgressionRail } from "@/components/auth/progression-rail";
import { PASSWORD_STRENGTH_LABELS, passwordStrength } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils";

const SET_PASSWORD_FAILED_MESSAGE = "Chưa đặt được mật khẩu, vui lòng thử lại.";
const STRENGTH_COLORS = ["bg-correction", "bg-correction", "bg-attention", "bg-recall", "bg-growth"] as const;
const STRENGTH_TEXT = ["text-correction", "text-correction", "text-attention", "text-recall", "text-growth"] as const;

export function SetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const password = form.watch("password");
  const confirmPassword = form.watch("confirmPassword");
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
      setServerError(SET_PASSWORD_FAILED_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ProgressionRail label="Tiến trình đặt mật khẩu" steps={["Xác minh email", "Đặt mật khẩu"]} current={2} />
      <h1 className={AUTH_TITLE_CLASS}>Đặt mật khẩu</h1>
      <p className={AUTH_LEAD_CLASS}>Email của bạn đã được xác minh. Đặt mật khẩu để từ giờ đăng nhập bằng email.</p>

      {serverError ? (
        <AuthNotice tone="error" role="alert" icon={<AlertCircle />}>
          {serverError}
        </AuthNotice>
      ) : null}

      {/* U3 G10: method="post" để một lần submit trước khi hydrate không đưa mật khẩu lên URL. */}
      <form method="post" noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-[18px]">
        <PasswordField
          id="new-password"
          label="Mật khẩu mới"
          autoComplete="new-password"
          registration={form.register("password")}
          error={form.formState.errors.password?.message}
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
                  <span className="font-medium text-slate-500">Ít nhất 6 ký tự.</span>
                  <span aria-live="polite" className={cn("font-semibold", STRENGTH_TEXT[strength])}>
                    {password ? `Độ mạnh: ${PASSWORD_STRENGTH_LABELS[strength]}` : ""}
                  </span>
                </div>
              </div>
            ),
          }}
        />
        <PasswordField
          id="confirm-new-password"
          label="Nhập lại mật khẩu"
          autoComplete="new-password"
          registration={form.register("confirmPassword")}
          error={form.formState.errors.confirmPassword?.message}
          details={
            matches
              ? {
                  id: "confirm-new-password-match",
                  node: (
                    <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold text-growth">
                      <Check aria-hidden="true" className="size-4" />
                      Hai mật khẩu đã khớp
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
              Đang lưu…
            </>
          ) : (
            "Lưu mật khẩu"
          )}
        </Button>
      </form>
    </>
  );
}
