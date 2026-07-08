import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { ChapterMetadataFormValues } from "@/lib/schemas/chapter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";

interface ChapterFormModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  form: UseFormReturn<ChapterMetadataFormValues>;
  onSubmitForm: (values: ChapterMetadataFormValues) => void;
  isPending: boolean;
  title?: string;
  submitText?: string;
}

export default function ChapterFormModal({
  isOpen,
  setIsOpen,
  form,
  onSubmitForm,
  isPending,
  title = "Thêm chương",
  submitText = "Lưu chương",
}: ChapterFormModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="hidden">
            Điền thông tin chương cho khóa học.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitForm)}
            className="space-y-6 mt-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Tiêu đề chương</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="VD: Part 1 - Listening"
                      className="h-12 rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  {form.formState.errors.title ? (
                    <p className="text-sm font-medium text-rose-500 mt-1">
                      {form.formState.errors.title.message}
                    </p>
                  ) : null}
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-lg font-bold rounded-xl mt-4"
              >
                {isPending ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  submitText
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
