"use client";
"use no memo";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpUser } from "@/app/actions/auth";
import { registerSchema, RegisterInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { ChevronRight, User, CalendarIcon, Camera } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null); // State mới để giữ file ảnh gửi lên server

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file); // Lưu file thật để tý đẩy lên Supabase
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  // 1. Khởi tạo bộ não quản lý form
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    // BẮT BUỘC PHẢI CÓ CÁI NÀY ĐỂ INPUT KHÔNG BỊ KẸT
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      full_name: "",
    },
  });

  // 2. Logic chuyển bước an toàn (Phải valid xong mới cho qua)
  const handleNextStep = async (fields: (keyof RegisterInput)[]) => {
    const isStepValid = await form.trigger(fields);
    if (isStepValid) setStep((prev) => prev + 1);
  };

  // 3. Xử lý submit cuối cùng
  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(
        key,
        value instanceof Date ? value.toISOString() : String(value),
      );
    });

    // Gọi API (truyền thêm avatarFile nếu Khang đã viết logic upload trong server action)
    const res = await signUpUser(formData);
    setIsLoading(false);

    if (res?.error) {
      alert(res.error);
    } else {
      alert("Đăng ký thành công! Đi tập Gym thôi!");
    }
  };

  // Trích xuất errors để code gọn hơn
  const { errors } = form.formState;

  return (
    // BỌC TOÀN BỘ CARD BẰNG THẺ FORM
    <form onSubmit={form.handleSubmit(onSubmit)}>
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
                  id="username"
                  {...form.register("username")} // Gắn logic
                  type="text"
                  placeholder=" "
                  className="h-11 peer block w-full px-3 py-2 text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-0 "
                />
                <Label
                  htmlFor="text"
                  className="pointer-events-none absolute text-gray-500 duration-300 transform peer-[:not(:placeholder-shown)]:-translate-y-5 scale-75 top-3 z-10 origin-left left-3 bg-white px-1 text-sm peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 peer-focus:text-blue-400 cursor-text"
                >
                  Tên tài khoản
                </Label>
                {errors.username && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div className="relative mt-2">
                <Input
                  id="email"
                  {...form.register("email")}
                  type="email"
                  placeholder=" "
                  className="h-11 peer block w-full px-3 py-2 text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-0 "
                />
                <Label className="pointer-events-none absolute text-gray-500 duration-300 transform peer-[:not(:placeholder-shown)]:-translate-y-5 scale-75 top-3 z-10 origin-left left-3 bg-white px-1 text-sm peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 peer-focus:text-blue-400 cursor-text">
                  Nhập Email
                </Label>
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="relative mt-2">
                <Input
                  id="password"
                  {...form.register("password")}
                  type="password"
                  placeholder=" "
                  className="h-11 peer block w-full px-3 py-2 text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-1 focus:border-blue-400"
                />
                <Label className="pointer-events-none absolute left-3 top-3 z-10 origin-left transform cursor-text bg-white px-1 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:-translate-y-5 peer-[:not(:placeholder-shown)]:scale-75">
                  Nhập mật khẩu
                </Label>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="relative mt-2">
                <Input
                  id="confirmPassword"
                  {...form.register("confirmPassword")}
                  type="password"
                  placeholder=" "
                  className="h-11 peer block w-full px-3 py-2 text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-400"
                />
                <Label className="pointer-events-none absolute left-3 top-3 z-10 origin-left transform cursor-text bg-white px-1 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:-translate-y-5 peer-[:not(:placeholder-shown)]:scale-75">
                  Xác nhận mật khẩu
                </Label>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {step == 2 && (
            <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="relative mt-2">
                <Input
                  id="phone"
                  {...form.register("phone")}
                  type="tel"
                  placeholder=" "
                  className="h-11 peer block w-full px-3 py-2 text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-0 "
                />
                <Label className="pointer-events-none absolute text-gray-500 duration-300 transform peer-[:not(:placeholder-shown)]:-translate-y-5 scale-75 top-2.5 z-10 origin-left left-3 bg-white px-1 text-sm peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 peer-focus:text-blue-400 cursor-text">
                  Nhập SĐT
                </Label>
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              <div className="relative mt-2">
                <Input
                  id="full_name"
                  {...form.register("full_name")} // Đã sửa từ địa chỉ thành Họ và tên
                  type="text"
                  placeholder=" "
                  className="h-11 peer block w-full px-3 py-2 text-gray-900 bg-transparent border rounded-md border-gray-300 appearance-none focus:outline-none focus:ring-1 focus:border-blue-400"
                />
                <Label className="pointer-events-none absolute left-3 top-3 z-10 origin-left transform cursor-text bg-white px-1 text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:-translate-y-5 peer-[:not(:placeholder-shown)]:scale-75">
                  Họ và tên
                </Label>
                {errors.full_name && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.full_name.message}
                  </p>
                )}
              </div>

              <div className="relative mt-2">
                <Controller
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          // Dùng field.value thay cho form.watch()
                          className={`h-11 w-full justify-start ${!field.value ? "text-gray-500" : "text-gray-900"} justify-between`}
                        >
                          {field.value ? (
                            format(field.value, "dd/MM/yyyy")
                          ) : (
                            <span>Chọn ngày sinh</span>
                          )}
                          <CalendarIcon className="mr-2 h-5 w-5 text-gray-500" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          // Khi chọn ngày, field.onChange sẽ tự động báo cho Zod biết
                          onSelect={(date) => field.onChange(date)}
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
                  )}
                />
                {errors.dob && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.dob.message}
                  </p>
                )}
              </div>

              <div className="relative mt-2">
                <Controller
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange} // Truyền thẳng onChange của Zod vào đây
                      value={field.value} // Đồng bộ value với Zod
                    >
                      <SelectTrigger className="w-full px-4 h-11">
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
                  )}
                />
                {errors.gender && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.gender.message}
                  </p>
                )}
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
                type="button"
                onClick={() =>
                  handleNextStep([
                    "username",
                    "email",
                    "password",
                    "confirmPassword",
                  ])
                }
                className="w-full bg-blue-400 hover:bg-blue-500 text-white cursor-pointer h-11 transition-all"
              >
                Tiếp tục <ChevronRight />
              </Button>
              {/* Đống Google Login để tạm, xử lý logic sau */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-11 cursor-pointer font-medium"
              >
                <FcGoogle className="mr-2 h-5 w-5" /> Đăng nhập bằng Google
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-2 justify-between w-full">
              <Button
                type="button"
                onClick={() =>
                  handleNextStep(["phone", "full_name", "dob", "gender"])
                }
                className="w-full bg-blue-400 hover:bg-blue-500 text-white cursor-pointer h-11 transition-all"
              >
                Tiếp tục <ChevronRight />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="w-full h-11 cursor-pointer"
              >
                Quay lại
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 gap-2 w-full">
              {/* Nút Submit chính của form */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white h-11 font-medium cursor-pointer"
              >
                {isLoading ? "Đang xử lý..." : "Hoàn tất Đăng ký"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                className="w-full h-11 cursor-pointer"
              >
                Quay lại
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}
