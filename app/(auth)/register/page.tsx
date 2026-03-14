"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { ChevronRight, User, CalendarIcon, Camera } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
} from "@/components/ui/select";
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
  const [step, setStep] = useState(1);
  const [date, setDate] = useState<Date>();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Tạo một cái link ảo (blob URL) để ép trình duyệt hiện ảnh ngay lập tức
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };
  return (
    <Card className="mx-auto w-full max-w-sm border-none shadow-2xl rounded-2xl p-0">
      <CardHeader className="bg-blue-400 text-white py-6">
        <CardTitle className="flex justify-center text-xl">
          Đăng ký tài khoản
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden py-1">
        {step === 1 && (
          <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-left-8 duration-500">
            <div className="relative mt-2">
              <Input
                type="text"
                placeholder=" "
                className="h-11 peer block w-full px-3 py-2 text-base text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-0 "
              />
              <Label
                htmlFor="text"
                className="absolute text-base text-gray-500 duration-300 transform peer-[:not(:placeholder-shown)]:-translate-y-5 scale-75 top-3 z-10 origin-[0] left-3 bg-white px-1 text-sm peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 peer-focus:text-blue-400 cursor-text"
              >
                Tên tài khoản
              </Label>
            </div>
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

            <div className="relative mt-2">
              <Input
                type="password"
                placeholder=" "
                className="h-11 peer block w-full px-3 py-2 text-base text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-400"
              />
              <Label
                htmlFor="password"
                className="absolute left-3 top-3 z-10 origin-[0] transform cursor-text bg-white px-1 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:-translate-y-5 peer-[:not(:placeholder-shown)]:scale-75"
              >
                Xác nhận mật khẩu
              </Label>
            </div>
          </div>
        )}
        {step == 2 && (
          <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="relative mt-2">
              <Input
                type="phone"
                placeholder=" "
                className="h-11 peer block w-full px-3 py-2 text-base text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-0 "
              />
              <Label
                htmlFor="phone"
                className="absolute text-base text-gray-500 duration-300 transform peer-[:not(:placeholder-shown)]:-translate-y-5 scale-75 top-2.5 z-10 origin-[0] left-3 bg-white px-1 text-sm peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 peer-focus:text-blue-400 cursor-text"
              >
                Nhập SĐT
              </Label>
            </div>

            <div className="relative mt-2">
              <Input
                type="text"
                placeholder=" "
                className="h-11 peer block w-full px-3 py-2 text-base text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-1 focus:border-blue-400"
              />
              <Label
                htmlFor="textd"
                className="absolute left-3 top-3 z-10 origin-[0] transform cursor-text bg-white px-1 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:-translate-y-5 peer-[:not(:placeholder-shown)]:scale-75"
              >
                Nhập địa chỉ
              </Label>
            </div>

            <div className="relative mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={`h-11 w-full justify-start ${!date ? "text-gray-500" : "text-gray-900"} justify-between`}
                  >
                    {date ? (
                      format(date, "dd/MM/yyyy")
                    ) : (
                      <span>Chọn ngày sinh</span>
                    )}
                    <CalendarIcon className="mr-2 h-5 w-5 text-gtay-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={vi}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-1-1")
                    }
                    captionLayout="dropdown"
                    fromYear={1950}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="relative mt-2">
              <Select>
                <SelectTrigger className="w-full px-4 py-5">
                  <SelectValue
                    className="placeholder-gray-900"
                    placeholder="Chọn giới tính"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Chọn Giới tính</SelectLabel>
                    <SelectItem value="nam">Nam</SelectItem>
                    <SelectItem value="nữ">Nữ</SelectItem>
                    <SelectItem value="other">Khác</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step == 3 && (
          <div className="flex flex-col items-center justify-center gap-2 mt-2 mb-4 animate-in fade-in slide-in-from-right-8 duration-500">
            <label
              htmlFor="avatar-upload"
              className="relative cursor-pointer group"
            >
              <Avatar className="h-24 w-24 border-2 border-dashed border-gray-300 group-hover:border-blue-500 transition-all duration-300">
                <AvatarImage
                  src={avatarPreview || ""}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gray-50">
                  <User className="h-10 w-10 text-gray-400" />
                </AvatarFallback>
              </Avatar>

              <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Camera className="h-6 w-6 text-white mb-1" />
                <span className="text-white text-[10px] font-medium">
                  Tải ảnh lên
                </span>
              </div>
            </label>

            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            <p className="text-xs text-gray-500">Ảnh đại diện (Tùy chọn)</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {step === 1 && (
          <div className="grid grid-cols-1 gap-2 justify-between w-full">
            <Button
              onClick={() => setStep(2)}
              className="w-full bg-blue-400 hover:bg-blue-500 text-white h-11 text-base transition-all"
            >
              Tiếp tục <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-11 text-base font-medium"
            >
              <FcGoogle className="mr-2 h-5 w-5" /> Đăng nhập bằng Google
            </Button>
            <p className="mt-2 text-center text-sm text-gray-600">
              Bạn đã có tài khoản?{" "}
              <a href="/login" className=" text-blue-400 hover:underline">
                Đăng nhập
              </a>
            </p>
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-1 gap-2 justify-between w-full">
            <Button
              onClick={() => setStep(3)}
              className="w-full bg-blue-400 hover:bg-blue-500 text-white h-11 text-base transition-all"
            >
              Tiếp tục <ChevronRight />
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="w-full h-11 text-base"
            >
              Quay lại
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-11 text-base font-medium"
            >
              <FcGoogle className="mr-2 h-5 w-5" /> Đăng nhập bằng Google
            </Button>
            <p className="mt-2 text-center text-sm text-gray-600">
              Bạn đã có tài khoản?{" "}
              <a href="/login" className=" text-blue-400 hover:underline">
                Đăng nhập
              </a>
            </p>
          </div>
        )}
        {step === 3 && (
          <div className="grid grid-cols-1 gap-2 w-full">
            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white h-11 text-base font-medium ">
              Hoàn tất Đăng ký
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="w-full h-11 text-base"
            >
              Quay lại
            </Button>

            <p className="mt-2 text-center text-sm text-gray-600">
              Bạn đã có tài khoản?{" "}
              <a href="/login" className=" text-blue-400 hover:underline">
                Đăng nhập
              </a>
            </p>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
