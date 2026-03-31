"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/lib/schemas/auth";
import { signInUser } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);

    const res = await signInUser(formData);
    setIsLoading(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Đăng nhập thành công!");
      setTimeout(() => {
        router.push("/");
        router.refresh(); // Ép header load lại lấy Auth mới
      }, 1000);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] w-full flex flex-col items-center justify-center bg-slate-50 p-4">
      <Card className="mx-auto w-full max-w-sm border-none shadow-2xl rounded-2xl p-0">
      <CardHeader className="bg-blue-400 text-white py-6">
        <CardTitle className="flex justify-center text-2xl">Đăng nhập</CardTitle>
      </CardHeader>
      
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="overflow-hidden py-1">
          <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-left-8 duration-500 mt-2">
            
            <div className="relative mt-2">
              <Input
                type="email"
                placeholder=" "
                {...form.register("email")}
                className={`h-11 peer block w-full px-3 py-2 text-gray-900 bg-transparent border rounded-md appearance-none focus:outline-none focus:ring-0 ${form.formState.errors.email ? "border-red-500" : "border-gray-300"}`}
              />
              <Label className="absolute text-gray-500 duration-300 transform peer-[:not(:placeholder-shown)]:-translate-y-5 scale-75 top-3 z-10 origin-left left-3 bg-white px-1 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 peer-focus:text-blue-400 cursor-text">
                Nhập Email
              </Label>
              {form.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>}
            </div>

            <div className="relative mt-2">
              <Input
                type="password"
                placeholder=" "
                {...form.register("password")}
                className={`h-11 peer block w-full px-3 py-2 text-gray-900 bg-transparent border rounded-md appearance-none focus:outline-none focus:ring-1 focus:border-blue-400 ${form.formState.errors.password ? "border-red-500" : "border-gray-300"}`}
              />
              <Label className="absolute left-3 top-3 z-10 origin-left transform cursor-text bg-white px-1 text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:-translate-y-5 peer-[:not(:placeholder-shown)]:scale-75">
                Nhập mật khẩu
              </Label>
              {form.formState.errors.password && <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>}
            </div>

          </div>
        </CardContent>
        <CardFooter>
          <div className="grid grid-cols-1 gap-2 justify-between w-full">
            <Button type="submit" disabled={isLoading} className="w-full bg-blue-400 hover:bg-blue-500 text-white h-11 transition-all">
              {isLoading ? "Đang xử lý..." : <>Đăng nhập <ChevronRight /></>}
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-full h-11 font-medium">
              <FcGoogle className="mr-2 h-5 w-5" /> Đăng nhập bằng Google
            </Button>
            <p className="mt-2 text-center text-gray-600">
              Bạn chưa có tài khoản?{" "}
              <Link href="/register" className="text-blue-400 hover:underline">
                Đăng ký
              </Link>
            </p>
          </div>
        </CardFooter>
      </form>
    </Card>
    </div>
  );
}