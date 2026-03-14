import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  return (
    <Card className="mx-auto w-full max-w-sm border-none shadow-2xl rounded-2xl p-0">
      <CardHeader className="bg-blue-400 text-white py-6">
        <CardTitle className="flex justify-center text-2xl">
          Đăng nhập
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden py-1">
        <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-left-8 duration-500">
          <div className="relative mt-2">
            <Input
              type="email"
              placeholder=" "
              className="h-11 peer block w-full px-3 py-2 text-base text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-0 "
            />
            <Label
              htmlFor="email"
              className="absolute text-base text-gray-500 duration-300 transform peer-[:not(:placeholder-shown)]:-translate-y-5 scale-75 top-3 z-10 origin-[0] left-3 bg-white px-1 text-sm peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 peer-focus:text-blue-400 cursor-text"
            >
              Nhập Email
            </Label>
          </div>

          <div className="relative mt-2">
            <Input
              type="password"
              placeholder=" "
              className="h-11 peer block w-full px-3 py-2 text-base text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-1 focus:border-blue-400"
            />
            <Label
              htmlFor="password"
              className="absolute left-3 top-3 z-10 origin-[0] transform cursor-text bg-white px-1 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:-translate-y-5 peer-[:not(:placeholder-shown)]:scale-75"
            >
              Nhập mật khẩu
            </Label>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="grid grid-cols-1 gap-2 justify-between w-full">
          <Button className="w-full bg-blue-400 hover:bg-blue-500 text-white h-11 text-base transition-all">
            Đăng nhập <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-11 text-base font-medium"
          >
            <FcGoogle className="mr-2 h-5 w-5" /> Đăng nhập bằng Google
          </Button>
          <p className="mt-2 text-center text-sm text-gray-600">
            Bạn đã chưa tài khoản?{" "}
            <a href="/login" className=" text-blue-400 hover:underline">
              Đăng ký
            </a>
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
