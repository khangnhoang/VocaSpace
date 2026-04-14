import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { ChapterFormValues } from "@/lib/schemas/chapter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

interface ChapterFormModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  form: UseFormReturn<ChapterFormValues>;
  onSubmitForm: (values: ChapterFormValues) => void;
  isPending: boolean;
}

export default function ChapterFormModal({ isOpen, setIsOpen, form, onSubmitForm, isPending }: ChapterFormModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Thêm Chương Mới</DialogTitle>

          {/* 2. BƠM THÊM DÒNG NÀY VÀO LÀ NÓ NÍN WARNING (DÙNG HIDDEN ĐỂ ẨN ĐI) */}
          <DialogDescription className="hidden">
            Điền thông tin để tạo chương mới cho khóa học.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitForm)} className="space-y-6 mt-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Tiêu đề Chương</FormLabel>
                <FormControl>
                  <Input placeholder="VD: Part 1 - Listening" className="h-12 rounded-xl" {...field} />
                </FormControl>
                {form.formState.errors.title && (
                  <p className="text-sm font-medium text-rose-500 mt-1">{form.formState.errors.title.message}</p>
                )}
              </FormItem>
            )} />

            <FormField control={form.control} name="order_index" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Số thứ tự hiển thị</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    className="h-12 rounded-xl" 
                    {...field} 
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                {form.formState.errors.order_index && (
                  <p className="text-sm font-medium text-rose-500 mt-1">{form.formState.errors.order_index.message}</p>
                )}
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-lg font-bold rounded-xl mt-4">
                {isPending ? <Loader2 className="animate-spin mr-2" /> : "Lưu Chương"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}