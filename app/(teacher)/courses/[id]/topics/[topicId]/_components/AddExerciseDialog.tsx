// app/(teacher)/courses/[id]/topics/[topicId]/_components/AddExerciseDialog.tsx
"use client";
import React, { useState, useTransition, useEffect } from "react";
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
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useForm,
  useFieldArray,
  UseFormReturn,
  Resolver,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  exerciseSchema,
  type ExerciseFormValues,
} from "@/lib/schemas/exercise";
import { createExercise } from "@/app/actions/exercise";
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
      groups: [],
      questions: [],
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

  const {
    fields: standaloneQuestionFields,
    append: appendStandaloneQuestion,
    remove: removeStandaloneQuestion,
  } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const partType = useWatch({
    control: form.control,
    name: "part_type",
  });

  // Tự động khởi tạo cấu trúc dữ liệu tối thiểu khi đổi Part để tối ưu trải nghiệm UI
  useEffect(() => {
    if (partType === "part5") {
      if (standaloneQuestionFields.length === 0) {
        appendStandaloneQuestion({
          content: "",
          explanation: "",
          options: [
            { content: "", is_correct: true },
            { content: "", is_correct: false },
            { content: "", is_correct: false },
            { content: "", is_correct: false },
          ],
        });
      }
    } else {
      if (groupFields.length === 0) {
        appendGroup({
          passage_text: "",
          audio_url: "",
          image_url: "",
          questions: [
            {
              content: "",
              explanation: "",
              options: [
                { content: "", is_correct: true },
                { content: "", is_correct: false },
                { content: "", is_correct: false },
                { content: "", is_correct: false },
              ],
            },
          ],
        });
      }
    }
  }, [
    partType,
    appendGroup,
    appendStandaloneQuestion,
    groupFields.length,
    standaloneQuestionFields.length,
  ]);

  const handleFormSubmit = (values: ExerciseFormValues) => {
    if (isBulkMode && !bulkText.trim()) {
      toast.error("Vui lòng nhập nội dung bài tập theo định dạng Aiken!");
      return;
    }

    startTransition(async () => {
      let finalPayload: ExerciseFormValues = values;

      if (isBulkMode) {
        try {
          const parsedGroups = parseAikenToGroups(bulkText);
          const rawPayload = {
            title: values.title,
            part_type: values.part_type,
            order_index: values.order_index || 1,
            groups: parsedGroups,
          };

          const validation = exerciseSchema.safeParse(rawPayload);
          if (!validation.success) {
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
      } else {
        // Lọc sạch dữ liệu rỗng trước khi đẩy đi thẩm định
        if (values.part_type === "part5") {
          finalPayload = {
            title: values.title,
            part_type: values.part_type,
            questions:
              values.questions?.filter((q) => q.content.trim() !== "") || [],
          };
        } else {
          finalPayload = {
            title: values.title,
            part_type: values.part_type,
            groups:
              values.groups
                ?.map((g) => ({
                  ...g,
                  questions: g.questions.filter((q) => q.content.trim() !== ""),
                }))
                .filter(
                  (g) =>
                    g.passage_text?.trim() ||
                    g.audio_url?.trim() ||
                    g.image_url?.trim() ||
                    g.questions.length > 0,
                ) || [],
          };
        }

        const validation = exerciseSchema.safeParse(finalPayload);
        if (!validation.success) {
          toast.error(`Cấu trúc lỗi: ${validation.error.issues[0].message}`);
          return;
        }
      }

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
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            <ArrowLeft size={22} />
          </Button>
          <DialogTitle className="text-xl font-bold">
            Thêm Bài tập mới
          </DialogTitle>
          <DialogDescription className="hidden">
            Form thiết lập bài tập đa loại hình
          </DialogDescription>

          <Button
            disabled={isPending}
            onClick={async () => {
              if (isBulkMode) {
                const isHeaderValid = await form.trigger([
                  "title",
                  "part_type",
                ]);
                if (isHeaderValid) handleFormSubmit(form.getValues());
              } else {
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
                        <SelectItem value="part5">
                          Part 5: Incomplete Sentences (Reading)
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

            {!isBulkMode ? (
              partType === "part5" ? (
                // GIAO DIỆN NHẬP THỦ CÔNG: CÂU HỎI ĐƠN LẺ (PART 5)
                <div className="space-y-6">
                  {standaloneQuestionFields.map((q, qIndex) => (
                    <div
                      key={q.id}
                      className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm relative animate-in fade-in duration-300"
                    >
                      <div className="absolute top-4 right-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStandaloneQuestion(qIndex)}
                          className="text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                      <h3 className="font-bold text-base text-slate-800 mb-4 flex items-center gap-2">
                        <HelpCircle size={16} className="text-blue-500" /> Câu
                        hỏi lẻ {qIndex + 1}
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                            Nội dung câu hỏi
                          </label>
                          <Input
                            placeholder="Nhập nội dung câu hỏi..."
                            className="h-11 rounded-xl bg-white"
                            {...form.register(`questions.${qIndex}.content`)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                            Giải thích đáp án
                          </label>
                          <Textarea
                            placeholder="Nhập lời giải thích chi tiết (nếu có)..."
                            className="min-h-20 rounded-xl resize-none"
                            {...form.register(
                              `questions.${qIndex}.explanation`,
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          {[0, 1, 2, 3].map((oIndex) => (
                            <div
                              key={oIndex}
                              className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200"
                            >
                              <input
                                type="radio"
                                className="w-4 h-4 text-blue-600"
                                name={`questions.${qIndex}.correct_answer`}
                                defaultChecked={oIndex === 0}
                                onChange={() => {
                                  [0, 1, 2, 3].forEach((i) => {
                                    form.setValue(
                                      `questions.${qIndex}.options.${i}.is_correct`,
                                      i === oIndex,
                                    );
                                  });
                                }}
                              />
                              <Input
                                placeholder={`Đáp án ${String.fromCharCode(65 + oIndex)}`}
                                className="h-9 rounded-lg bg-white"
                                {...form.register(
                                  `questions.${qIndex}.options.${oIndex}.content`,
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      appendStandaloneQuestion({
                        content: "",
                        explanation: "",
                        options: [
                          { content: "", is_correct: true },
                          { content: "", is_correct: false },
                          { content: "", is_correct: false },
                          { content: "", is_correct: false },
                        ],
                      })
                    }
                    className="w-full h-14 border-dashed border-2 text-blue-600 hover:bg-blue-50 font-bold rounded-2xl"
                  >
                    <Plus className="mr-2" /> Thêm câu hỏi độc lập
                  </Button>
                </div>
              ) : (
                // GIAO DIỆN NHẬP THỦ CÔNG: THEO CỤM/NHÓM (PART 1, 3, 7)
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
                              className="min-h-32 rounded-xl resize-none"
                              {...form.register(
                                `groups.${gIndex}.passage_text`,
                              )}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                              Link Audio (Listening)
                            </label>
                            <Input
                              placeholder="Nhập link file âm thanh..."
                              className="h-11 rounded-xl"
                              {...form.register(`groups.${gIndex}.audio_url`)}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                              Link Hình ảnh (Image URL)
                            </label>
                            <Input
                              placeholder="Nhập đường dẫn ảnh minh họa..."
                              className="h-11 rounded-xl"
                              {...form.register(`groups.${gIndex}.image_url`)}
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
                        image_url: "",
                        questions: [
                          {
                            content: "",
                            explanation: "",
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
              )
            ) : (
              // CHẾ ĐỘ NHẬP HÀNG LOẠT (AIKEN)
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

                <div className="lg:col-span-5 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4 h-fit sticky top-24">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-500" /> Quy định
                    cấu trúc Aiken mở rộng
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Hệ thống tự động phân loại thực thể đầu vào dựa trên từ
                    khóa. Hãy đảm bảo quy tắc định dạng không bị phá vỡ:
                  </p>

                  <div className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-xl space-y-1 select-all whitespace-pre leading-relaxed border border-slate-900 shadow-md">
                    {`Passage: Read the text and answer questions
[Audio]: https://vocaspace.com/audio/sample.mp3
Q: What is indicated about Mr. Nguyễn Hoàng Khang?
A) He is an Information Technology student.
B) He is a professional chef.
C) He doesn't go to the gym.
D) He hates coffee.
ANSWER: A`}
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

function QuestionList({
  form,
  gIndex,
}: {
  form: UseFormReturn<ExerciseFormValues>;
  gIndex: number;
}) {
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
        Các câu hỏi trong nhóm
      </label>
      {questionFields.map((q, qIndex) => (
        <div
          key={q.id}
          className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
        >
          <div className="flex gap-2">
            <span className="font-bold text-blue-600 mt-2">Q{qIndex + 1}.</span>
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
              className="text-rose-500"
            >
              <Trash2 size={16} />
            </Button>
          </div>

          <div className="pl-6">
            <Input
              placeholder="Giải thích đáp án (Tùy chọn)..."
              className="h-8 rounded-lg bg-white text-xs"
              {...form.register(
                `groups.${gIndex}.questions.${qIndex}.explanation`,
              )}
            />
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
            explanation: "",
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
        <Plus size={16} className="mr-2" /> Thêm câu hỏi vào nhóm
      </Button>
    </div>
  );
}
