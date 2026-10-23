"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CourseForm from "../../_components/CourseForm";
import { useCourseInfoEdit, type EditableCourseInfo } from "../../_components/use-course-info-edit";

interface CourseInfoEditDialogProps {
  course: EditableCourseInfo;
  emphasis: "filled" | "outline";
}

// Sửa thông tin khóa học ngay trên Tổng quan (khóa học bị từ chối niêm yết). Dùng chung hook lưu với
// /teacher/courses nên validation, action và khóa chống gửi trùng giống hệt; Radix trả focus về nút mở.
export default function CourseInfoEditDialog({ course, emphasis }: CourseInfoEditDialogProps) {
  const router = useRouter();
  const mutationLock = useRef(false);
  const editor = useCourseInfoEdit({ mutationLock, onSaved: () => router.refresh() });
  const isOpen = editor.editing !== null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) editor.open(course);
        else if (!editor.isPending) editor.close();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={emphasis === "filled" ? "default" : "outline"}
          size="lg"
          className="w-full whitespace-normal"
        >
          <Pencil aria-hidden="true" />
          Sửa thông tin khóa học
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Sửa thông tin khóa học</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin theo góp ý của quản trị viên. Dữ liệu bạn nhập được giữ lại nếu lưu chưa thành công.
          </DialogDescription>
        </DialogHeader>
        {isOpen ? (
          <CourseForm
            form={editor.form}
            onSubmit={editor.submit}
            isPending={editor.isPending}
            previewUrl={editor.preview}
            setPreviewUrl={editor.setPreview}
            onCancel={() => { if (!editor.isPending) editor.close(); }}
            isEditMode
            layout="embedded"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
