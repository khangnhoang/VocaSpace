// app/(teacher)/courses/[id]/topics/[topicId]/_components/AddExerciseDialog.tsx
"use client";
import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowLeft,
  Headphones,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useForm, useFieldArray, UseFormReturn, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  exerciseSchema,
  type ExerciseFormValues,
} from "@/lib/schemas/exercise";
import { createExercise } from "@/app/actions/exercise";
// 🔥 INTÉGRATION CỐT LÕI: Import bộ máy phân tách cú pháp Aiken nâng cao
import { parseAikenToGroups } from "@/lib/utils/aiken-parser";

interface AddExerciseDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  topicId: string;
  onSuccess: () => void;
}

export default function AddExerciseDialog({
  isOpen,
  setIsOpen,
  topicId,
  onSuccess,
}: AddExerciseDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema) as Resolver<ExerciseFormValues>,
    defaultValues: {
      title: "",
      part_type: "part7",
      order_index: 1,
      groups: [
        {
          passage_text: "",
          audio_url: "",
          questions: [
            {
              content: "",
              options: [
                { content: "", is_correct: true },
                { content: "", is_correct: false },
                { content: "", is_correct: false },
                { content: "", is_correct: false },
              ],
            },
          ],
        },
      ],
    },
  });

  const {
    fields: groupFields,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({
    control: form.control,
    name: "groups",
  });

  // 🔥 THI CÔNG LOGIC LẮP RÁP LIÊN THÔNG ĐẦU CUỐI (END-TO-END DATA ASSEMBLY)
  const handleFormSubmit = (values: ExerciseFormValues) => {
    if (isBulkMode && !bulkText.trim()) {
      toast.error("Vui lòng nhập nội dung bài tập theo định dạng Aiken!");
      return;
    }

    startTransition(async () => {
      let finalPayload: ExerciseFormValues = values;

      // Xử lý đóng gói cây dữ liệu nếu đang ở chế độ Nhập hàng loạt
      if (isBulkMode) {
        try {
          // Chuyển văn bản thô từ Textarea thành cấu trúc JSON 4 tầng lồng nhau
          const parsedGroups = parseAikenToGroups(bulkText);

          // Gom thông tin metadata từ Form kết hợp với mảng data vừa bóc tách
          const rawPayload = {
            title: values.title,
            part_type: values.part_type,
            order_index: values.order_index || 1,
            groups: parsedGroups,
          };

          // Chốt chặn bảo mật dữ liệu đầu vào nghiêm ngặt thông qua Zod contract
          const validation = exerciseSchema.safeParse(rawPayload);

          if (!validation.success) {
            // Tuân thủ nghiêm ngặt chuẩn quản lý lỗi issues[0].message
            toast.error(
              `Lỗi cú pháp Aiken: ${validation.error.issues[0].message}`,
            );
            return;
          }

          finalPayload = validation.data;
        } catch (parseError) {
          toast.error(
            "Bộ phân tích cú pháp Aiken gặp sự cố không thể bóc tách dữ liệu.",
          );
          return;
        }
      }

      // Đẩy payload hoàn chỉnh (Form thô hoặc Bulk đã parse) xuống tầng Server Action
      const res = await createExercise(topicId, finalPayload);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message);
        form.reset();
        setBulkText("");
        setIsOpen(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="bg-slate-50 border-slate-200 shadow-2xl w-[95vw]! sm:max-w-[95vw]! h-[95vh]! rounded-2xl p-0 flex flex-col z-60"
      >
        {/* THANH HEADER ĐỒNG BỘ */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            <ArrowLeft size={22} />
          </Button>
          <DialogTitle className="text-xl font-bold">
            Thêm Bài tập mới
          </DialogTitle>
          <DialogDescription className="hidden">
            Form thêm bài tập đa tầng hỗ trợ cả Aiken Markdown nâng cao
          </DialogDescription>

          {/* 🔥 VÁ LỖI SILENT FAILURE: Điều hướng luồng kiểm tra dữ liệu chủ động */}
          <Button
            disabled={isPending}
            onClick={async () => {
              if (isBulkMode) {
                // 1. Chỉ ép validate Title và Part Type trên UI, gạt mảng groups mặc định sang một bên
                const isHeaderValid = await form.trigger([
                  "title",
                  "part_type",
                ]);

                // 2. Nếu thông tin chung hợp lệ, bốc toàn bộ dữ liệu form đi xử lý bóc tách chuỗi[cite: 21]
                if (isHeaderValid) {
                  handleFormSubmit(form.getValues());
                }
              } else {
                // Chế độ thủ công giữ nguyên cơ chế validate toàn bộ form của RHF[cite: 21]
                form.handleSubmit(handleFormSubmit)();
              }
            }}
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl font-bold px-6"
          >
            {isPending ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              "Lưu Bài Tập"
            )}
          </Button>
        </div>

        <Form {...form}>
          <form className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6">
            {/* TẦNG 1: THÔNG TIN CHUNG (LUÔN CỐ ĐỊNH Ở TRÊN CÙNG) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tên bài tập
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="VD: Reading Practice Test 1"
                        className="h-12 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-rose-500 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="part_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Loại bài (Part)
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue placeholder="Chọn Part" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="z-70">
                        <SelectItem value="part1">
                          Part 1: Photographs (Listening)
                        </SelectItem>
                        <SelectItem value="part3">
                          Part 3: Conversations (Listening)
                        </SelectItem>
                        <SelectItem value="part7">
                          Part 7: Reading Comprehension
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-rose-500 text-xs" />
                  </FormItem>
                )}
              />
            </div>

            {/* THANH ĐIỀU HƯỚNG CHẾ ĐỘ NHẬP LIỆU */}
            <div className="flex bg-slate-200/60 p-1 rounded-xl max-w-md shadow-inner">
              <button
                type="button"
                onClick={() => setIsBulkMode(false)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${!isBulkMode ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <FileText size={14} /> Nhập thủ công (Form)
              </button>
              <button
                type="button"
                onClick={() => setIsBulkMode(true)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${isBulkMode ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Sparkles size={14} /> Nhập hàng loạt (Aiken)
              </button>
            </div>

            {/* PHÂN NHÁNH GIAO DIỆN PHÍA DƯỚI DỰA TRÊN STATE */}
            {!isBulkMode ? (
              <div className="space-y-6">
                {groupFields.map((group, gIndex) => (
                  <div
                    key={group.id}
                    className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm relative animate-in fade-in duration-300"
                  >
                    <div className="absolute top-4 right-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeGroup(gIndex)}
                        className="text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-4">
                      Nhóm câu hỏi {gIndex + 1}
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                            Đoạn văn (Reading Passage)
                          </label>
                          <Textarea
                            placeholder="Nhập đoạn văn cho nhóm câu hỏi này..."
                            className="min-h-37.5 rounded-xl resize-none"
                            {...form.register(`groups.${gIndex}.passage_text`)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Headphones size={14} /> Link Audio (Listening)
                          </label>
                          <Input
                            placeholder="Nhập đường dẫn file âm thanh (.mp3, .wav)..."
                            className="h-12 rounded-xl"
                            {...form.register(`groups.${gIndex}.audio_url`)}
                          />
                        </div>
                      </div>
                      <QuestionList form={form} gIndex={gIndex} />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    appendGroup({
                      passage_text: "",
                      audio_url: "",
                      questions: [
                        {
                          content: "",
                          options: [
                            { content: "", is_correct: true },
                            { content: "", is_correct: false },
                            { content: "", is_correct: false },
                            { content: "", is_correct: false },
                          ],
                        },
                      ],
                    })
                  }
                  className="w-full h-14 border-dashed border-2 text-blue-600 hover:bg-blue-50 font-bold rounded-2xl"
                >
                  <Plus className="mr-2" /> Thêm Nhóm câu hỏi (Ngữ liệu)
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
                <div className="lg:col-span-7 flex flex-col space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Nội dung văn bản thô (Aiken Format)
                  </label>
                  <Textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="Dán nội dung đề thi TOEIC đã soạn theo cấu trúc Aiken vào đây..."
                    className="flex-1 min-h-[50vh] font-mono text-sm bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-inner border border-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Khung Hướng Dẫn Cú Pháp */}
                <div className="lg:col-span-5 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4 h-fit sticky top-24">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-500" /> Quy định
                    cấu trúc Aiken mở rộng
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Hệ thống tự động nhận dạng phân tầng dựa trên từ khóa đầu
                    dòng. Vui lòng viết chính xác cấu trúc sau để tránh gãy dữ
                    liệu:
                  </p>

                  <div className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-xl space-y-1 select-all whitespace-pre leading-relaxed border border-slate-900 shadow-md">
                    {`Passage: Read the text and answer questions
[Audio]: https://vocaspace.com/audio/sample.mp3
Q: What is indicated about Mr. Nguyễn Hoàng Khang?
A) He is an Information Technology student.
B) He is a professional chef.
C) He doesn't go to the gym.
D) He hates coffee.
ANSWER: A

Q: What does the word "Absolute" mean?
A) Hoàn toàn, tuyệt đối
B) Tương đối
C) Tạm thời
D) Mong manh
ANSWER: A`}
                  </div>

                  <div className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100 font-medium">
                    <p className="flex items-center gap-2 text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>
                        Keyword{" "}
                        <code className="bg-slate-100 text-rose-500 px-1 py-0.5 rounded font-mono font-bold">
                          Passage:
                        </code>{" "}
                        kích hoạt tạo nhóm ngữ liệu mới.
                      </span>
                    </p>
                    <p className="flex items-center gap-2 text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>
                        Keyword{" "}
                        <code className="bg-slate-100 text-rose-500 px-1 py-0.5 rounded font-mono font-bold">
                          Q:
                        </code>{" "}
                        đại diện cho câu hỏi.
                      </span>
                    </p>
                    <p className="flex items-center gap-2 text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>
                        Đáp án phải bắt đầu bằng{" "}
                        <code className="bg-slate-100 text-rose-500 px-1 py-0.5 rounded font-mono font-bold">
                          A) B) C) D)
                        </code>{" "}
                        viết hoa.
                      </span>
                    </p>
                    <p className="flex items-center gap-2 text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>
                        Chốt đáp án đúng bằng chữ{" "}
                        <code className="bg-slate-100 text-rose-500 px-1 py-0.5 rounded font-mono font-bold">
                          ANSWER:
                        </code>{" "}
                        ở cuối câu.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function QuestionList({ form, gIndex }: { form: UseFormReturn<ExerciseFormValues>; gIndex: number }) {
  const {
    fields: questionFields,
    append: appendQuestion,
    remove: removeQuestion,
  } = useFieldArray({
    control: form.control,
    name: `groups.${gIndex}.questions`,
  });

  return (
    <div className="space-y-6">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
        Các câu hỏi
      </label>
      {questionFields.map((q, qIndex) => (
        <div
          key={q.id}
          className="bg-slate-50 p-4 rounded-xl border border-slate-200"
        >
          <div className="flex gap-2 mb-4">
            <span className="font-bold text-blue-600 mt-3">Q{qIndex + 1}.</span>
            <div className="flex-1">
              <Input
                placeholder="Nội dung câu hỏi..."
                className="h-10 rounded-lg bg-white"
                {...form.register(
                  `groups.${gIndex}.questions.${qIndex}.content`,
                )}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeQuestion(qIndex)}
              className="text-rose-500 mt-1"
            >
              <Trash2 size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 pl-6">
            {[0, 1, 2, 3].map((oIndex) => (
              <div key={oIndex} className="flex items-center gap-3">
                <input
                  type="radio"
                  className="w-4 h-4 text-blue-600"
                  name={`groups.${gIndex}.questions.${qIndex}.correct_answer`}
                  defaultChecked={oIndex === 0}
                  onChange={() => {
                    [0, 1, 2, 3].forEach((i) => {
                      form.setValue(
                        `groups.${gIndex}.questions.${qIndex}.options.${i}.is_correct`,
                        i === oIndex,
                      );
                    });
                  }}
                />
                <Input
                  placeholder={`Đáp án ${String.fromCharCode(65 + oIndex)}`}
                  className="h-9 rounded-lg bg-white"
                  {...form.register(
                    `groups.${gIndex}.questions.${qIndex}.options.${oIndex}.content`,
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          appendQuestion({
            content: "",
            options: [
              { content: "", is_correct: true },
              { content: "", is_correct: false },
              { content: "", is_correct: false },
              { content: "", is_correct: false },
            ],
          })
        }
        className="text-blue-600 font-bold hover:bg-blue-50 w-full"
      >
        <Plus size={16} className="mr-2" /> Thêm câu hỏi
      </Button>
    </div>
  );
}
