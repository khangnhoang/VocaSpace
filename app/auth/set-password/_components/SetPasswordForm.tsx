"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { setPasswordSchema, SetPasswordInput } from "@/lib/schemas/auth";
import { setPasswordAfterConfirmation } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: SetPasswordInput) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);

    // Thành công thì action redirect về "/"; chỉ quay lại đây khi có lỗi.
    const res = await setPasswordAfterConfirmation(formData);
    setIsLoading(false);
    if (res?.error) toast.error(res.error);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] w-full flex flex-col items-center justify-center bg-slate-50 p-4">
      <Card className="mx-auto w-full max-w-sm border-none shadow-2xl rounded-2xl p-0">
        <CardHeader className="bg-blue-400 text-white py-6">
          <CardTitle className="flex justify-center text-2xl">Đặt mật khẩu</CardTitle>
          <CardDescription className="text-center text-blue-50">
            Email đã được xác minh. Đặt mật khẩu để lần sau đăng nhập bằng email.
          </CardDescription>
        </CardHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <CardContent className="grid grid-cols-1 gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register("password")}
                className={`h-11 ${form.formState.errors.password ? "border-red-500" : ""}`}
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-xs">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-new-password">Nhập lại mật khẩu</Label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                {...form.register("confirmPassword")}
                className={`h-11 ${form.formState.errors.confirmPassword ? "border-red-500" : ""}`}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-red-500 text-xs">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="pb-6">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-400 hover:bg-blue-500 text-white h-11 transition-all"
            >
              {isLoading ? "Đang lưu..." : "Lưu mật khẩu"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
