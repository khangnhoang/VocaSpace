import React from "react";
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
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Thêm lại
import { ArrowLeft, Loader2, Users, ImagePlus } from "lucide-react"; // Thêm lại ImagePlus
import { CourseFormValues } from "@/lib/schemas/course";
import { cn } from "@/lib/utils";

interface CourseFormProps {
  form: UseFormReturn<CourseFormValues>;
  onSubmit: (values: CourseFormValues) => void;
  isPending: boolean;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  onCancel: () => void;
  isEditMode?: boolean;
}

const getCourseFieldClassName = (isInvalid: boolean, className: string) =>
  cn(
    className,
    isInvalid &&
      "border-destructive bg-red-50/40 focus:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
  );

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

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB] flex flex-col p-4 sm:p-8 text-slate-800 font-sans">
      <div className="w-full max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500 mx-auto">
        <Button
          type="button"
          variant="link"
          onClick={onCancel}
          disabled={isPending}
          className="mb-6 w-fit px-0 coarse-input:h-11"
        >
          <ArrowLeft
            className="size-4.5 coarse-input:size-5"
            aria-hidden="true"
          />
          Quay lại danh sách
        </Button>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 sm:p-10">
          <h2 className="text-2xl font-bold mb-8 text-slate-900 border-b border-slate-100 pb-5">
            {isEditMode
              ? "✏️ Cập nhật thông tin khóa học"
              : "✨ Khởi tạo dự án khóa học mới"}
          </h2>

          <Form {...form}>
            <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* CỘT TRÁI: Thông tin khóa học */}
                <div className="lg:col-span-7 space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-slate-700">
                          Tên khóa học
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="VD: Chinh phục TOEIC 800+"
                            className={getCourseFieldClassName(
                              fieldState.invalid,
                              "border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base",
                            )}
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
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-slate-700">
                            Đường dẫn (Slug)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="VD: chinh-phuc-toeic-800"
                              className={getCourseFieldClassName(
                                fieldState.invalid,
                                "border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base",
                              )}
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
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-slate-700">
                            Giá bán (VNĐ)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="500000"
                              className={getCourseFieldClassName(
                                fieldState.invalid,
                                "border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base font-semibold text-blue-600",
                              )}
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
                          <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => document.getElementById("file-upload")?.click()}
                              className="w-full sm:w-auto coarse-input:h-11 coarse-input:px-5"
                            >
                              Tải ảnh lên
                            </Button>
                            <span className="min-w-0 max-w-full truncate text-sm font-medium text-slate-600 sm:max-w-50">
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
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-slate-700">
                          Mô tả khóa học
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Khóa học này sẽ giúp học viên..."
                            className={getCourseFieldClassName(
                              fieldState.invalid,
                              "resize-none h-32 border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl p-4 text-base",
                            )}
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
                    // === HIỂN THỊ KHI CHỈNH SỬA: ĐIỂM VÀO CỘNG TÁC VIÊN DUY NHẤT ===
                    <div className="bg-slate-50/80 p-6 rounded-3xl border border-slate-100 shadow-sm h-fit sticky top-6">
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-4">
                        <Users className="text-[#00C4D4]" size={22} />
                        <h3 className="font-bold text-slate-800 text-lg">
                          Cộng tác viên
                        </h3>
                      </div>
                      <p className="text-sm leading-6 text-slate-600">
                        Quản lý thành viên, vai trò và quyền duyệt chủ đề tại
                        Course Overview. Đây là điểm vào duy nhất cho quản lý
                        cộng tác viên.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* NÚT SUBMIT CHÍNH CỦA KHÓA HỌC */}
              <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={isPending}
                  className="w-full sm:w-auto coarse-input:h-11 coarse-input:border-slate-500 coarse-input:bg-white coarse-input:px-5"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className="min-w-40 w-full sm:w-auto coarse-input:h-11 coarse-input:px-5"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4.5 motion-safe:animate-spin coarse-input:size-5" aria-hidden="true" />{isEditMode ? "Đang lưu…" : "Đang tạo…"}
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
