"use client";

import React, { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
} from "@/components/ui/card";
import { Pencil, Trash2, ArrowLeft, ImagePlus } from "lucide-react";

// === 1. TẠO BẢN VẼ KIỂU DỮ LIỆU ĐỂ CHIỀU LÒNG TYPESCRIPT ===
type CourseFormValues = {
  title: string;
  slug: string;
  description: string;
  price: string;
  thumbnail_file: File | null; // Báo rõ cho TypeScript biết đây là File hoặc null
};

// MOCK DATA KHÓA HỌC
const mockCourses = [
  {
    id: "course-1",
    title: "Chinh phục TOEIC 800+",
    slug: "chinh-phuc-toeic-800",
    description: "Lộ trình cấp tốc trong 3 tháng dành cho người mất gốc.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=2070&auto=format&fit=crop",
    price: 500000,
    status: "published",
    order_index: 1,
  },
  {
    id: "course-2",
    title: "Làm chủ Figma UI/UX từ A-Z",
    slug: "lam-chu-figma",
    description:
      "Thực hành thiết kế app thực tế và tối ưu trải nghiệm người dùng.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop",
    price: 799000,
    status: "published",
    order_index: 2,
  },
  {
    id: "course-3",
    title: "Lập trình ReactJS Cơ bản",
    slug: "reactjs-co-ban",
    description: "Nền tảng xây dựng website động với thư viện ReactJS chuẩn.",
    thumbnail_url:
      "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=1000&auto=format&fit=crop",
    price: 0,
    status: "draft",
    order_index: 3,
  },
];

export default function CreateCoursePage() {
  const [showForm, setShowForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // === 2. GẮN KIỂU DỮ LIỆU VÀO HOOK ===
  const form = useForm<CourseFormValues>({
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      price: "",
      thumbnail_file: null,
    },
  });

  const watchedValues = useWatch({
    control: form.control,
  });

  // === 3. XÓA 'any' TRONG HÀM SUBMIT ===
  function onSubmit(values: CourseFormValues) {
    console.log("Dữ liệu chuẩn bị gửi cho Backend (Gồm cả File Ảnh):", values);
    alert("Đã nhận dữ liệu! Mở Console (F12) để xem chi tiết File.");

    setShowForm(false);
    form.reset();
    setPreviewUrl(null);
  }

  const formatPrice = (price: number) => {
    if (price === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (showForm) {
    return (
      <div className="min-h-screen w-full bg-[#F9FAFB] flex flex-col p-4 sm:p-8 text-slate-800 font-sans">
        <div className="w-full max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500 mx-auto">
          <button
            onClick={() => {
              setShowForm(false);
              form.reset();
              setPreviewUrl(null);
            }}
            className="group flex items-center text-slate-500 hover:text-[#00C4D4] font-medium mb-6 transition-all w-fit"
          >
            <ArrowLeft
              size={20}
              className="mr-2 group-hover:-translate-x-1 transition-transform"
            />
            Quay lại danh sách
          </button>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 sm:p-10">
            <h2 className="text-2xl font-bold mb-8 text-slate-900 border-b border-slate-100 pb-5">
              ✨ Tạo khóa học mới
            </h2>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
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
                      render={({
                        field: { value, onChange, ...fieldProps },
                      }) => (
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

                              {/* === 4. TYPESCRIPT ĐÃ HIỂU value CHẮC CHẮN LÀ FILE HOẶC NULL === */}
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
                                    const objectUrl = URL.createObjectURL(file);
                                    setPreviewUrl(objectUrl);
                                  } else {
                                    onChange(null);
                                    setPreviewUrl(null);
                                  }
                                }}
                                name={fieldProps.name}
                                ref={fieldProps.ref}
                                onBlur={fieldProps.onBlur}
                              />
                            </div>
                          </FormControl>
                          <FormDescription className="text-slate-400 italic">
                            Khuyến nghị tải lên ảnh tỷ lệ 16:9, dung lượng dưới
                            2MB.
                          </FormDescription>
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

                  <div className="lg:col-span-5 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 h-fit sticky top-6">
                    <div>
                      <FormLabel className="font-semibold text-slate-700 mb-4 block text-center">
                        👁️ Xem trước hiển thị (Preview)
                      </FormLabel>

                      <Card className="w-full max-w-[320px] mx-auto p-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md pointer-events-none">
                        <div className="w-full aspect-video bg-slate-200 flex items-center justify-center overflow-hidden relative">
                          {previewUrl ? (
                            <Image
                              src={previewUrl}
                              alt="Preview"
                              fill
                              className="object-cover"
                              unoptimized={true}
                              sizes="(max-width: 768px) 100vw, 400px"
                            />
                          ) : (
                            <div className="flex flex-col items-center text-slate-400">
                              <ImagePlus
                                size={32}
                                className="mb-2 opacity-50"
                              />
                              <span className="text-sm font-medium">
                                Chưa chọn ảnh bìa
                              </span>
                            </div>
                          )}
                        </div>
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg font-bold text-slate-900 leading-tight line-clamp-2">
                            {watchedValues.title ||
                              "Tên khóa học sẽ hiển thị ở đây"}
                          </CardTitle>
                          <CardDescription className="text-sm font-medium text-slate-600 mt-1 line-clamp-2 min-h-10">
                            {watchedValues.description ||
                              "Mô tả ngắn gọn về khóa học..."}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="p-4 pt-2 flex items-center justify-between bg-white border-t border-slate-50">
                          <div className="font-bold text-[#5FAFFF]">
                            {watchedValues.price
                              ? formatPrice(Number(watchedValues.price))
                              : "Miễn phí"}
                          </div>
                          <div className="flex items-center gap-1 opacity-50">
                            <button
                              type="button"
                              className="p-2 text-slate-500 rounded-md"
                            >
                              <Pencil size={18} strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              className="p-2 text-slate-500 rounded-md"
                            >
                              <Trash2 size={18} strokeWidth={2.5} />
                            </button>
                          </div>
                        </CardFooter>
                      </Card>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6 mt-8 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false);
                      form.reset();
                      setPreviewUrl(null);
                    }}
                    className="rounded-xl px-6 py-6 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl px-8 py-6 bg-[#5FE8EF] text-slate-900 font-bold text-base hover:bg-[#38dadd] shadow-lg shadow-[#5FE8EF]/30 hover:shadow-[#5FE8EF]/50 hover:-translate-y-1 transition-all"
                  >
                    Tạo khóa học
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-black flex flex-col p-6 min-h-screen w-full bg-[#F9FAFB] font-sans dark">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Khóa học của tôi</h1>
        <button
          onClick={() => setShowForm(true)}
          className="border text-slate-900 text-sm px-4 py-2 rounded-md font-bold bg-[#5FE8EF] hover:bg-[#42d2da] transition-colors shadow-sm"
        >
          + Thêm khóa học
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {mockCourses.map((course) => (
          <Card
            key={course.id}
            className="w-full p-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all flex flex-col group"
          >
            <div className="w-full aspect-video bg-slate-100 overflow-hidden relative">
              <Image
                src={
                  course.thumbnail_url ||
                  "https://via.placeholder.com/600x400?text=No+Image"
                }
                alt={course.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 300px"
              />
            </div>
            <CardHeader className="p-4 pb-2 grow">
              <CardTitle
                className="text-lg font-bold text-slate-900 leading-tight line-clamp-2"
                title={course.title}
              >
                {course.title}
              </CardTitle>
              <CardDescription
                className="text-sm font-medium text-slate-600 mt-1 line-clamp-2"
                title={course.description || ""}
              >
                {course.description}
              </CardDescription>
            </CardHeader>
            <CardFooter className="p-4 pt-2 flex items-center justify-between bg-white border-t border-slate-50 mt-auto">
              <div className="font-bold text-[#5FAFFF]">
                {formatPrice(course.price)}
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 text-slate-500 hover:text-black hover:bg-slate-100 rounded-md transition-colors">
                  <Pencil size={18} strokeWidth={2.5} />
                </button>
                <button className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors">
                  <Trash2 size={18} strokeWidth={2.5} />
                </button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
