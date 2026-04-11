import React from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ImagePlus, Loader2 } from "lucide-react";
import { CourseFormValues } from "@/lib/schemas/course";

interface CourseFormProps {
  form: UseFormReturn<CourseFormValues>;
  onSubmit: (values: CourseFormValues) => void;
  isPending: boolean;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  onCancel: () => void;
}

export default function CourseForm({ form, onSubmit, isPending, previewUrl, setPreviewUrl, onCancel }: CourseFormProps) {
  const watchedValues = useWatch({ control: form.control });

  const formatPrice = (price: number | string) => {
    if (!price || Number(price) === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(price));
  };

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB] flex flex-col p-4 sm:p-8 text-slate-800 font-sans">
      <div className="w-full max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500 mx-auto">
        <button onClick={() => { onCancel(); form.reset(); setPreviewUrl(null); }} className="group flex items-center text-slate-500 hover:text-[#00C4D4] font-medium mb-6 transition-all w-fit cursor-pointer">
          <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Quay lại danh sách
        </button>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6 sm:p-10">
          <h2 className="text-2xl font-bold mb-8 text-slate-900 border-b border-slate-100 pb-5">✨ Khởi tạo dự án khóa học mới</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7 space-y-6">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold text-slate-700">Tên khóa học</FormLabel><FormControl><Input placeholder="VD: Chinh phục TOEIC 800+" className="border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField control={form.control} name="slug" render={({ field }) => (
                      <FormItem><FormLabel className="font-semibold text-slate-700">Đường dẫn (Slug)</FormLabel><FormControl><Input placeholder="VD: chinh-phuc-toeic-800" className="border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="price" render={({ field }) => (
                      <FormItem><FormLabel className="font-semibold text-slate-700">Giá bán (VNĐ)</FormLabel><FormControl><Input type="number" placeholder="500000" className="border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl py-6 text-base font-semibold text-blue-600" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="thumbnail_file" render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-slate-700">Ảnh bìa khóa học</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-4">
                          <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-lg bg-[#5FE8EF]/10 px-4 py-2 text-sm font-bold text-[#00C4D4] hover:bg-[#5FE8EF]/20 transition-colors border-0">Tải ảnh lên</label>
                          <span className="text-sm text-slate-500 font-medium truncate max-w-50">{value instanceof File ? value.name : "Chưa chọn file nào"}</span>
                          <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { onChange(file); setPreviewUrl(URL.createObjectURL(file)); } else { onChange(null); setPreviewUrl(null); } }} name={fieldProps.name} ref={fieldProps.ref} onBlur={fieldProps.onBlur} />
                        </div>
                      </FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel className="font-semibold text-slate-700">Mô tả khóa học</FormLabel><FormControl><Textarea placeholder="Khóa học này sẽ giúp học viên..." className="resize-none h-32 border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5FE8EF] focus:ring-4 focus:ring-[#5FE8EF]/20 transition-all rounded-xl p-4 text-base" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="lg:col-span-5 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 h-fit sticky top-6">
                  <FormLabel className="font-semibold text-slate-700 mb-4 block text-center">👁️ Xem trước hiển thị</FormLabel>
                  <Card className="w-full max-w-[320px] mx-auto p-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md pointer-events-none">
                    <div className="w-full aspect-video bg-slate-200 flex items-center justify-center overflow-hidden relative">
                      {previewUrl ? <Image src={previewUrl} alt="Preview" fill className="object-cover" unoptimized sizes="(max-width: 768px) 100vw, 400px" /> : <div className="flex flex-col items-center text-slate-400"><ImagePlus size={32} className="mb-2 opacity-50" /><span className="text-sm font-medium">Chưa chọn ảnh</span></div>}
                    </div>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-lg font-bold text-slate-900 leading-tight line-clamp-2">{watchedValues.title || "Tên khóa học"}</CardTitle>
                      <CardDescription className="text-sm font-medium text-slate-600 mt-1 line-clamp-2 min-h-10">{watchedValues.description || "Mô tả..."}</CardDescription>
                    </CardHeader>
                    <CardFooter className="p-4 pt-2 flex items-center justify-between bg-white border-t border-slate-50">
                      <div className="font-bold text-[#5FAFFF]">{formatPrice(watchedValues.price || 0)}</div>
                    </CardFooter>
                  </Card>
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-6 mt-8 border-t border-slate-200">
                <Button type="button" variant="ghost" onClick={() => { onCancel(); form.reset(); setPreviewUrl(null); }} className="rounded-xl px-6 py-6 text-slate-600 cursor-pointer font-semibold">Hủy bỏ</Button>
                <Button type="submit" disabled={isPending} className="rounded-xl px-8 py-6 bg-[#5FE8EF] text-slate-900 font-bold text-base cursor-pointer hover:bg-[#38dadd] shadow-lg shadow-[#5FE8EF]/30">
                  {isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tạo...</> : "Tiến hành tạo"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}