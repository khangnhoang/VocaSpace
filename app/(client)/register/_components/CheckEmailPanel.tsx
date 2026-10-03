"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { resendSignupConfirmation } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const RESEND_COOLDOWN_SECONDS = 60;

type CheckEmailPanelProps = {
  email: string;
  onEditForm: () => void;
};

export function CheckEmailPanel({ email, onEditForm }: CheckEmailPanelProps) {
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

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
      setResendMessage(result.message);
    } catch {
      toast.error("Chưa gửi lại được email, vui lòng thử lại sau.");
    } finally {
      setIsSending(false);
    }
  };

  const resendLabel = isSending
    ? "Đang gửi..."
    : cooldown > 0
      ? `Gửi lại email (${cooldown}s)`
      : "Gửi lại email";

  return (
    <Card className="mx-auto w-full max-w-sm border-none shadow-2xl rounded-2xl p-0">
      <CardHeader className="border-b py-6">
        <CardTitle className="flex justify-center text-xl">Kiểm tra email của bạn</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-2 text-center">
        <MailCheck aria-hidden="true" className="h-10 w-10 text-route" />
        <p className="text-sm text-gray-700">
          Chúng tôi đã gửi link xác minh tới{" "}
          <span className="font-semibold break-all text-gray-900">{email}</span>. Bấm vào link
          trong email để xác minh và đặt mật khẩu.
        </p>
        <p className="text-xs text-gray-500">
          Không thấy email? Hãy xem thư mục Spam hoặc gửi lại sau ít phút.
        </p>
        <p aria-live="polite" className="min-h-4 text-xs text-gray-600">
          {resendMessage}
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pb-6">
        <Button
          type="button"
          size="lg"
          onClick={handleResend}
          disabled={isSending || cooldown > 0}
          aria-busy={isSending}
          className="w-full"
        >
          {resendLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onEditForm}
          className="w-full"
        >
          Gửi lại form đăng ký
        </Button>
        <p className="text-sm text-gray-600">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-medium text-blue-600 underline-offset-4 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
