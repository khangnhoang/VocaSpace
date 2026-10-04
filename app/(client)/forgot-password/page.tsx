"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordRecovery } from "@/app/actions/auth";
import { passwordRecoveryRequestSchema, type PasswordRecoveryRequestInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RECOVERY_MESSAGE =
  "Nếu email này có tài khoản VocaSpace, link đặt lại mật khẩu sẽ tới trong vài phút. Bạn kiểm tra cả mục Spam nhé!";

export default function ForgotPasswordPage() {
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  const form = useForm<PasswordRecoveryRequestInput>({
    resolver: zodResolver(passwordRecoveryRequestSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = async (data: PasswordRecoveryRequestInput) => {
    if (submitting.current || cooldown > 0) return;
    submitting.current = true;
    setIsSending(true);
    setCooldown(60);
    try {
      await requestPasswordRecovery(data.email);
    } catch {
      // G5: cả lỗi transport cũng dùng cùng thông báo và cooldown, không lộ trạng thái email.
    } finally {
      setNotice(RECOVERY_MESSAGE);
      setIsSending(false);
      submitting.current = false;
    }
  };

  const submitLabel = isSending ? "Đang gửi..."
    : cooldown > 0 ? `Gửi link đặt lại (${cooldown}s)` : "Gửi link đặt lại";

  return (
    <div className="min-h-[calc(100vh-64px)] w-full flex flex-col items-center justify-center bg-slate-50 p-4">
      <Card className="mx-auto w-full max-w-sm border-none shadow-2xl rounded-2xl p-0">
        <CardHeader className="border-b py-6">
          <CardTitle className="text-center text-2xl">Quên mật khẩu?</CardTitle>
          <CardDescription className="text-center">
            Nhập email tài khoản VocaSpace để nhận link đặt mật khẩu mới.
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <CardContent className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(form.formState.errors.email)}
                aria-describedby={form.formState.errors.email ? "recovery-email-error" : undefined}
                {...form.register("email")}
                className={`h-11 ${form.formState.errors.email ? "border-red-500" : ""}`}
              />
              {form.formState.errors.email && (
                <p id="recovery-email-error" role="alert" className="text-red-700 text-xs">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            {notice && <p role="status" className="text-sm text-slate-600">{notice}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pb-6">
            <Button type="submit" size="lg" disabled={isSending || cooldown > 0} aria-busy={isSending} className="w-full">
              {submitLabel}
            </Button>
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-md text-sm text-blue-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              Quay lại đăng nhập
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
