import React, { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import Image from "next/image"; // Thêm lại
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Thêm lại
import { ArrowLeft, Loader2, UserPlus, Users, ImagePlus } from "lucide-react"; // Thêm lại ImagePlus
import { CourseFormValues } from "@/lib/schemas/course";

interface CourseFormProps {
  form: UseFormReturn<CourseFormValues>;
  onSubmit: (values: CourseFormValues) => void;
  isPending: boolean;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  onCancel: () => void;
  isEditMode?: boolean;
}

export default function CourseForm({
  form,
  onSubmit,
  isPending,
  previewUrl,
  setPreviewUrl,
  onCancel,
  isEditMode,
}: CourseFormProps) {
  // Lấy giá trị đang nhập để render phần xem trước
  const watchedValues = useWatch({ control: form.control });

  // Hàm format tiền tệ
  const formatPrice = (price: number | string) => {
    if (!price || Number(price) === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(price));
  };

  // State cho phần cộng tác viên
  const [collabEmail, setCollabEmail] = useState("");
  const [collabRole, setCollabRole] = useState("editor");

  const handleAddCollaborator = () => {
    if (!collabEmail) return;
    console.log("Thêm cộng tác viên:", {
      email: collabEmail,
      role: collabRole,
    });
    setCollabEmail("");
  };

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB] flex flex-col p-4 sm:p-8 text-slate-800 font-sans">
      <div className="w-full max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500 mx-auto">
        <button
          onClick={() => {
            onCancel();
            form.reset();
            setPreviewUrl(null);
          }}
          className="group flex items-center text-slate-500 hover:text-[#00C4D4] font-medium mb-6 transition-all w-fit cursor-pointer"
        >
          <ArrowLeft
            size={20}
            className="mr-2 group-hover:-translate-x-1 transition-transform"
          />
          Quay lại danh sách
        </button>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 sm:p-10">
          <h2 className="text-2xl font-bold mb-8 text-slate-900 border-b border-slate-100 pb-5">
            {isEditMode
              ? "✏️ Cập nhật thông tin khóa học"
              : "✨ Khởi tạo dự án khóa học mới"}
          </h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* CỘT TRÁI: Thông tin khóa học */}
                <div className="lg:col-span-7 space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-slate-700">
                          Tên khóa học
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="VD: Chinh phục TOEIC 800+"
                            className="border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-slate-700">
                            Đường dẫn (Slug)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="VD: chinh-phuc-toeic-800"
                              className="border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-slate-700">
                            Giá bán (VNĐ)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="500000"
                              className="border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base font-semibold text-blue-600"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="thumbnail_file"
                    render={({ field: { value, onChange, ...fieldProps } }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-slate-700">
                          Ảnh bìa khóa học
                        </FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-4">
                            <label
                              htmlFor="file-upload"
                              className="cursor-pointer inline-flex items-center justify-center rounded-lg bg-[#5FE8EF]/10 px-4 py-2 text-sm font-bold text-[#00C4D4] hover:bg-[#5FE8EF]/20 transition-colors border-0"
                            >
                              Tải ảnh lên
                            </label>
                            <span className="text-sm text-slate-500 font-medium truncate max-w-50">
                              {value instanceof File
                                ? value.name
                                : "Chưa chọn file nào"}
                            </span>
                            <input
                              id="file-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  onChange(file);
                                  setPreviewUrl(URL.createObjectURL(file));
                                } else {
                                  onChange(null);
                                  setPreviewUrl(null);
                                }
                              }}
                              {...fieldProps}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-slate-700">
                          Mô tả khóa học
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Khóa học này sẽ giúp học viên..."
                            className="resize-none h-32 border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl p-4 text-base"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* CỘT PHẢI: HIỂN THỊ ĐỘNG DỰA VÀO CHẾ ĐỘ TẠO HAY SỬA */}
                <div className="lg:col-span-5 space-y-6">
                  {!isEditMode ? (
                    // === HIỂN THỊ KHI TẠO MỚI: XEM TRƯỚC (REVIEW) ===
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 h-fit sticky top-6">
                      <FormLabel className="font-semibold text-slate-700 mb-4 block text-center">
                        👁️ Xem trước hiển thị
                      </FormLabel>
                      <Card className="w-full max-w-[320px] mx-auto p-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md pointer-events-none">
                        <div className="w-full aspect-video bg-slate-200 flex items-center justify-center overflow-hidden relative">
                          {previewUrl ? (
                            <Image
                              src={previewUrl}
                              alt="Preview"
                              fill
                              className="object-cover"
                              unoptimized
                              sizes="(max-width: 768px) 100vw, 400px"
                            />
                          ) : (
                            <div className="flex flex-col items-center text-slate-400">
                              <ImagePlus
                                size={32}
                                className="mb-2 opacity-50"
                              />
                              <span className="text-sm font-medium">
                                Chưa chọn ảnh
                              </span>
                            </div>
                          )}
                        </div>
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg font-bold text-slate-900 leading-tight line-clamp-2">
                            {watchedValues.title || "Tên khóa học"}
                          </CardTitle>
                          <CardDescription className="text-sm font-medium text-slate-600 mt-1 line-clamp-2 min-h-10">
                            {watchedValues.description || "Mô tả..."}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="p-4 pt-2 flex items-center justify-between bg-white border-t border-slate-50">
                          <div className="font-bold text-[#5FAFFF]">
                            {formatPrice(watchedValues.price || 0)}
                          </div>
                        </CardFooter>
                      </Card>
                    </div>
                  ) : (
                    // === HIỂN THỊ KHI CHỈNH SỬA: QUẢN LÝ CỘNG TÁC VIÊN ===
                    <div className="bg-slate-50/80 p-6 rounded-3xl border border-slate-100 shadow-sm h-fit sticky top-6">
                      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-4">
                        <Users className="text-[#00C4D4]" size={22} />
                        <h3 className="font-bold text-slate-800 text-lg">
                          Quản lý cộng tác viên
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Email cộng tác viên
                          </FormLabel>
                          <Input
                            type="email"
                            value={collabEmail}
                            onChange={(e) => setCollabEmail(e.target.value)}
                            placeholder="nhanvien@example.com"
                            className="border-slate-200 bg-white focus:border-[#5FE8EF] rounded-xl py-5"
                          />
                        </FormItem>

                        <FormItem>
                          <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Vai trò quyền hạn
                          </FormLabel>
                          <Select
                            value={collabRole}
                            onValueChange={setCollabRole}
                          >
                            <SelectTrigger className="w-full border-slate-200 bg-white rounded-xl py-5 focus:ring-[#5FE8EF]/20 focus:border-[#5FE8EF] transition-all outline-none">
                              <SelectValue placeholder="Chọn quyền" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              sideOffset={4}
                              className="bg-white rounded-xl shadow-xl shadow-slate-200/50 border-slate-100"
                            >
                              <SelectItem
                                value="editor"
                                className="cursor-pointer py-3 text-slate-700 font-medium focus:bg-[#5FE8EF]/10 focus:text-[#00C4D4] rounded-lg transition-colors m-1"
                              >
                                Biên tập viên (Editor)
                              </SelectItem>
                              <SelectItem
                                value="co_owner"
                                className="cursor-pointer py-3 text-slate-700 font-medium focus:bg-[#5FE8EF]/10 focus:text-[#00C4D4] rounded-lg transition-colors m-1"
                              >
                                Đồng sở hữu (Co-owner)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>

                        <Button
                          type="button"
                          onClick={handleAddCollaborator}
                          className="w-full bg-slate-900 hover:bg-black text-white font-bold py-5 rounded-xl transition-all shadow-lg flex gap-2"
                        >
                          <UserPlus size={18} />
                          Thêm thành viên
                        </Button>
                      </div>

                      <div className="mt-8">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                          Danh sách thành viên
                        </p>
                        <div className="text-xs text-slate-400 italic text-center py-4 border border-dashed border-slate-200 rounded-xl">
                          Chưa có cộng tác viên nào được thêm.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* NÚT SUBMIT CHÍNH CỦA KHÓA HỌC */}
              <div className="flex justify-end gap-4 pt-6 mt-8 border-t border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onCancel();
                    form.reset();
                    setPreviewUrl(null);
                  }}
                  className="rounded-xl px-6 py-6 text-slate-600 cursor-pointer font-semibold"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl px-8 py-6 bg-[#5FE8EF] text-slate-900 font-bold text-base cursor-pointer hover:bg-[#38dadd] shadow-lg shadow-[#5FE8EF]/30"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang xử
                      lý...
                    </>
                  ) : isEditMode ? (
                    "Lưu thay đổi"
                  ) : (
                    "Tiến hành tạo"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}