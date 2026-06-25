"use client";

import React, { useEffect, useRef, useTransition, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
  ArrowLeft,
  FileText,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  FieldErrors,
  Resolver,
  UseFormReturn,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  exerciseSchema,
  getToeicVisibleGroupContextFields,
  type ExerciseFormValues,
} from "@/lib/schemas/exercise";
import { createExercise, deleteQuestionGroupMedia } from "@/app/actions/exercise";
import {
  AikenParseError,
  formatAikenParseIssues,
  parseAikenToGroups,
} from "@/lib/utils/aiken-parser";
import QuestionGroupMediaField, {
  type UploadedQuestionGroupMedia,
} from "./QuestionGroupMediaField";

interface AddExerciseDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  topicId: string;
  onSuccess: () => void;
  onCreateSuccess?: () => boolean;
}

type OptionValue = {
  id?: string;
  content: string;
  is_correct: boolean;
  label?: string | null;
  order_index?: number | null;
};

type OptionArrayPath =
  | `questions.${number}.options`
  | `groups.${number}.questions.${number}.options`;

type GroupQuestionArrayPath = `groups.${number}.questions`;

function focusFieldByName(name: string) {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  );

  if (!element) return false;

  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.focus();
  return true;
}

function getFirstMediaErrorName(errors: FieldErrors<ExerciseFormValues>) {
  const groupErrors = errors.groups;
  if (!Array.isArray(groupErrors)) return null;

  for (let index = 0; index < groupErrors.length; index += 1) {
    const groupError = groupErrors[index];
    if (!groupError) continue;
    if (groupError.passage_text) return `groups.${index}.passage_text`;
    if (groupError.audio_url) return `groups.${index}.audio_url`;
    if (groupError.image_url) return `groups.${index}.image_url`;
  }

  return null;
}

const buildDefaultOptions = (): OptionValue[] => [
  { content: "", is_correct: true },
  { content: "", is_correct: false },
  { content: "", is_correct: false },
  { content: "", is_correct: false },
];

const buildDefaultQuestion = () => ({
  content: "",
  explanation: "",
  options: buildDefaultOptions(),
});

function optionLabel(index: number) {
  let label = "";
  let cursor = index;

  do {
    label = String.fromCharCode(65 + (cursor % 26)) + label;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);

  return label;
}

function compactQuestion(question: {
  content: string;
  explanation?: string;
  options: OptionValue[];
}) {
  return {
    ...question,
    content: question.content.trim(),
    explanation: question.explanation?.trim() || undefined,
    options: question.options
      .map((option) => ({
        id: option.id,
        content: option.content.trim(),
        is_correct: option.is_correct,
      }))
      .filter((option) => option.content !== ""),
  };
}

export default function AddExerciseDialog({
  isOpen,
  setIsOpen,
  topicId,
  onSuccess,
  onCreateSuccess,
}: AddExerciseDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkErrorDetails, setBulkErrorDetails] = useState("");
  const [uploadedMedia, setUploadedMedia] = useState<UploadedQuestionGroupMedia[]>([]);
  const bulkTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
  const visibleGroupContextFields = getToeicVisibleGroupContextFields(partType || "");
  const showGroupPassage = visibleGroupContextFields.includes("passage_text");
  const showGroupAudio = visibleGroupContextFields.includes("audio_url");
  const showGroupImage = visibleGroupContextFields.includes("image_url");

  const trackUploadedMedia = (media: UploadedQuestionGroupMedia) => {
    setUploadedMedia((current) => [
      ...current.filter(
        (item) => item.bucket !== media.bucket || item.path !== media.path,
      ),
      media,
    ]);
  };

  const forgetUploadedMedia = (media: UploadedQuestionGroupMedia) => {
    setUploadedMedia((current) =>
      current.filter(
        (item) => item.bucket !== media.bucket || item.path !== media.path,
      ),
    );
  };

  const cleanupUploadedMedia = async (mediaList: UploadedQuestionGroupMedia[]) => {
    if (mediaList.length === 0) return;

    const results = await Promise.allSettled(
      mediaList.map((media) => deleteQuestionGroupMedia(media.bucket, media.path)),
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn("[QUESTION GROUP MEDIA CLEANUP REJECTED]:", result.reason);
        return;
      }

      if ("error" in result.value) {
        console.warn(
          "[QUESTION GROUP MEDIA CLEANUP ERROR]:",
          mediaList[index],
          result.value.error,
        );
      }
    });

    setUploadedMedia((current) =>
      current.filter(
        (item) =>
          !mediaList.some(
            (media) => media.bucket === item.bucket && media.path === item.path,
          ),
      ),
    );
  };

  const clearCleanedMediaUrls = (mediaList: UploadedQuestionGroupMedia[]) => {
    const cleanedUrls = new Set(mediaList.map((media) => media.publicUrl));
    const groups = form.getValues("groups") || [];

    groups.forEach((group, index) => {
      if (group.audio_url && cleanedUrls.has(group.audio_url)) {
        form.setValue(`groups.${index}.audio_url`, "", { shouldDirty: true });
      }

      if (group.image_url && cleanedUrls.has(group.image_url)) {
        form.setValue(`groups.${index}.image_url`, "", { shouldDirty: true });
      }
    });
  };

  const handleRemoveGroup = async (gIndex: number) => {
    const group = form.getValues(`groups.${gIndex}`);
    const mediaToCleanup = uploadedMedia.filter(
      (media) =>
        media.publicUrl === group?.audio_url || media.publicUrl === group?.image_url,
    );

    await cleanupUploadedMedia(mediaToCleanup);
    removeGroup(gIndex);
  };

  const focusBulkTextarea = () => {
    requestAnimationFrame(() => {
      bulkTextareaRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      bulkTextareaRef.current?.focus();
    });
  };

  const showBulkError = (summary: string, details = "") => {
    setBulkError(summary);
    setBulkErrorDetails(details);
    toast.error("Vui lòng kiểm tra lại nội dung nhập hàng loạt.");
    focusBulkTextarea();
  };

  useEffect(() => {
    if (partType === "part5") {
      if (standaloneQuestionFields.length === 0) {
        appendStandaloneQuestion(buildDefaultQuestion());
      }
      return;
    }

    if (groupFields.length === 0) {
      appendGroup({
        passage_text: "",
        audio_url: "",
        image_url: "",
        questions: [buildDefaultQuestion()],
      });
    }
  }, [
    partType,
    appendGroup,
    appendStandaloneQuestion,
    groupFields.length,
    standaloneQuestionFields.length,
  ]);

  const buildManualPayload = (values: ExerciseFormValues): ExerciseFormValues => {
    if (values.part_type === "part5") {
      return {
        title: values.title,
        part_type: values.part_type,
        questions:
          values.questions
            ?.map(compactQuestion)
            .filter((question) => question.content !== "") || [],
      };
    }

    return {
      title: values.title,
      part_type: values.part_type,
      groups:
        values.groups
          ?.map((group) => ({
            passage_text: group.passage_text?.trim() || undefined,
            audio_url: group.audio_url?.trim() || undefined,
            image_url: group.image_url?.trim() || undefined,
            questions: group.questions
              .map(compactQuestion)
              .filter((question) => question.content !== ""),
          }))
          .filter(
            (group) =>
              group.passage_text ||
              group.audio_url ||
              group.image_url ||
              group.questions.length > 0,
          ) || [],
    };
  };

  const handleFormSubmit = (values: ExerciseFormValues) => {
    if (isBulkMode && !bulkText.trim()) {
      toast.error("Vui lòng nhập nội dung bài tập theo định dạng Aiken!");
      return;
    }

    startTransition(async () => {
      let finalPayload: ExerciseFormValues;

      if (isBulkMode) {
        try {
          finalPayload = {
            title: values.title,
            part_type: values.part_type,
            order_index: values.order_index || 1,
            groups: parseAikenToGroups(bulkText),
          };
        } catch {
          toast.error(
            "Bộ phân tích cú pháp Aiken gặp sự cố, không thể bóc tách dữ liệu.",
          );
          return;
        }
      } else {
        finalPayload = buildManualPayload(values);
      }

      const validation = exerciseSchema.safeParse(finalPayload);
      if (!validation.success) {
        toast.error(`Cấu trúc lỗi: ${validation.error.issues[0].message}`);
        return;
      }

      const res = await createExercise(topicId, validation.data);
      if (res.error) {
        const mediaToCleanup = [...uploadedMedia];
        await cleanupUploadedMedia(mediaToCleanup);
        clearCleanedMediaUrls(mediaToCleanup);
        toast.error(res.error);
        return;
      }

      // Callback này chỉ dùng cho đường vào từ dashboard.
      // Nếu parent đã hiện thông báo quay lại tổng quan thì không hiện toast success nữa.
      const handledByDashboardFeedback = onCreateSuccess?.();

      if (!handledByDashboardFeedback) {
        toast.success(res.message);
      }

      setUploadedMedia([]);
      form.reset({
        title: "",
        part_type: "part7",
        order_index: 1,
        groups: [],
        questions: [],
      });
      setBulkText("");
      setIsOpen(false);
      onSuccess();
    });
  };

  const handleValidatedFormSubmit = (values: ExerciseFormValues) => {
    if (isBulkMode && !bulkText.trim()) {
      showBulkError("Vui lòng nhập nội dung câu hỏi.");
      return;
    }

    startTransition(async () => {
      let finalPayload: ExerciseFormValues;

      if (isBulkMode) {
        try {
          const parsedGroups = parseAikenToGroups(bulkText);
          finalPayload = {
            title: values.title,
            part_type: values.part_type,
            order_index: values.order_index || 1,
            ...(values.part_type === "part5"
              ? { questions: parsedGroups.flatMap((group) => group.questions) }
              : { groups: parsedGroups }),
          };
        } catch (error) {
          showBulkError(
            "Định dạng nhập hàng loạt không hợp lệ. Vui lòng kiểm tra lại các dòng bị lỗi.",
            error instanceof AikenParseError
              ? formatAikenParseIssues(error)
              : "Không thể phân tích nội dung nhập hàng loạt.",
          );
          return;
        }
      } else {
        finalPayload = buildManualPayload(values);
      }

      const validation = exerciseSchema.safeParse(finalPayload);
      if (!validation.success) {
        if (isBulkMode) {
          showBulkError(
            "Định dạng nhập hàng loạt không hợp lệ. Vui lòng kiểm tra lại các dòng bị lỗi.",
            validation.error.issues[0].message,
          );
        } else {
          toast.error("Vui lòng kiểm tra lại các trường chưa hợp lệ.");
        }
        return;
      }

      const res = await createExercise(topicId, validation.data);
      if (res.error) {
        const mediaToCleanup = [...uploadedMedia];
        await cleanupUploadedMedia(mediaToCleanup);
        clearCleanedMediaUrls(mediaToCleanup);
        toast.error(res.error);
        return;
      }

      // Callback này chỉ dùng cho đường vào từ dashboard.
      // Nếu parent đã hiện thông báo quay lại tổng quan thì không hiện toast success nữa.
      const handledByDashboardFeedback = onCreateSuccess?.();

      if (!handledByDashboardFeedback) {
        toast.success(res.message);
      }

      setUploadedMedia([]);
      form.reset({
        title: "",
        part_type: "part7",
        order_index: 1,
        groups: [],
        questions: [],
      });
      setBulkText("");
      setBulkError("");
      setBulkErrorDetails("");
      setIsOpen(false);
      onSuccess();
    });
  };

  const handleInvalidSubmit = (errors: FieldErrors<ExerciseFormValues>) => {
    toast.error("Vui lòng kiểm tra lại các trường chưa hợp lệ.");

    const mediaErrorName = getFirstMediaErrorName(errors);
    if (mediaErrorName && focusFieldByName(mediaErrorName)) return;

    requestAnimationFrame(() => {
      const firstInvalid = document.querySelector<HTMLElement>(
        "[aria-invalid='true']",
      );
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid?.focus();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="bg-slate-50 border-slate-200 shadow-2xl w-[95vw]! sm:max-w-[95vw]! h-[95vh]! rounded-xl p-0 flex flex-col z-60"
      >
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            <ArrowLeft size={22} />
          </Button>
          <DialogTitle className="text-xl font-bold">
            Thêm bài tập mới
          </DialogTitle>
          <DialogDescription className="hidden">
            Form thiết lập bài tập đa loại hình
          </DialogDescription>

          <Button
            disabled={isPending}
            aria-label="Save exercise"
            onClick={async () => {
              if (isBulkMode) {
                const isHeaderValid = await form.trigger([
                  "title",
                  "part_type",
                ]);
                  if (isHeaderValid) handleValidatedFormSubmit(form.getValues());
                  else handleInvalidSubmit(form.formState.errors);
                } else {
                  form.handleSubmit(handleValidatedFormSubmit, handleInvalidSubmit)();
                }
            }}
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-bold px-6"
          >
            {isPending ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              "Lưu bài tập"
            )}
          </Button>
        </div>

        <Form {...form}>
          <form className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        aria-label="Exercise title"
                        placeholder="VD: Reading Practice Test 1"
                        className="h-12 rounded-lg"
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
                      Loại bài
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-lg">
                          <SelectValue placeholder="Chọn Part" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="z-70">
                        <SelectItem value="part1">
                          Part 1: Photographs (Listening)
                        </SelectItem>
                        <SelectItem value="part2">
                          Part 2: Question-Response (Listening)
                        </SelectItem>
                        <SelectItem value="part3">
                          Part 3: Conversations (Listening)
                        </SelectItem>
                        <SelectItem value="part4">
                          Part 4: Talks (Listening)
                        </SelectItem>
                        <SelectItem value="part5">
                          Part 5: Incomplete Sentences (Reading)
                        </SelectItem>
                        <SelectItem value="part6">
                          Part 6: Text Completion
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

            <div className="flex bg-slate-200/60 p-1 rounded-lg max-w-md shadow-inner">
              <button
                type="button"
                onClick={() => setIsBulkMode(false)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${!isBulkMode ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <FileText size={14} /> Nhập thủ công
              </button>
              <button
                type="button"
                onClick={() => setIsBulkMode(true)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${isBulkMode ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Sparkles size={14} /> Nhập hàng loạt
              </button>
            </div>

            {!isBulkMode ? (
              partType === "part5" ? (
                <div className="space-y-6">
                  {standaloneQuestionFields.map((question, qIndex) => (
                    <div
                      key={question.id}
                      className="bg-white p-6 rounded-xl border border-slate-300 shadow-sm relative animate-in fade-in duration-300"
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
                        <HelpCircle size={16} className="text-blue-500" />
                        Câu hỏi lẻ {qIndex + 1}
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                            Nội dung câu hỏi
                          </label>
                          <Input
                            placeholder="Nhập nội dung câu hỏi..."
                            className="h-11 rounded-lg bg-white"
                            aria-invalid={
                              !!form.getFieldState(
                                `questions.${qIndex}.content`,
                                form.formState,
                              ).error
                            }
                            {...form.register(`questions.${qIndex}.content`)}
                          />
                          {form.getFieldState(
                            `questions.${qIndex}.content`,
                            form.formState,
                          ).error?.message && (
                            <p className="mt-2 text-xs font-medium text-rose-500">
                              {
                                form.getFieldState(
                                  `questions.${qIndex}.content`,
                                  form.formState,
                                ).error?.message
                              }
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                            Giải thích đáp án
                          </label>
                          <Textarea
                            placeholder="Nhập lời giải thích chi tiết nếu có..."
                            className="min-h-20 rounded-lg resize-none"
                            {...form.register(
                              `questions.${qIndex}.explanation`,
                            )}
                          />
                        </div>

                        <OptionFields
                          form={form}
                          name={`questions.${qIndex}.options`}
                          radioName={`questions.${qIndex}.correct_answer`}
                          className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2"
                          addButtonClassName="h-11"
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      appendStandaloneQuestion(buildDefaultQuestion())
                    }
                    className="w-full h-14 border-dashed border-2 text-blue-600 hover:bg-blue-50 font-bold rounded-lg"
                  >
                    <Plus className="mr-2" /> Thêm câu hỏi độc lập
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupFields.map((group, gIndex) => (
                    <div
                      key={group.id}
                      className="bg-white p-6 rounded-xl border border-slate-300 shadow-sm relative animate-in fade-in duration-300"
                    >
                      <div className="absolute top-4 right-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveGroup(gIndex)}
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
                          {showGroupPassage && (
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                              Đoạn văn
                            </label>
                            <Textarea
                              placeholder="Nhập đoạn văn cho nhóm câu hỏi này..."
                              aria-label={`Passage text group ${gIndex + 1}`}
                              className="min-h-32 rounded-lg resize-none"
                              aria-invalid={
                                !!form.formState.errors.groups?.[gIndex]
                                  ?.passage_text
                              }
                              {...form.register(
                                `groups.${gIndex}.passage_text`,
                              )}
                            />
                            {form.formState.errors.groups?.[gIndex]?.passage_text
                              ?.message && (
                              <p className="mt-2 text-xs font-medium text-rose-500">
                                {
                                  form.formState.errors.groups[gIndex]
                                    ?.passage_text?.message
                                }
                              </p>
                            )}
                          </div>
                          )}
                          {showGroupAudio && (
                          <QuestionGroupMediaField
                            type="audio"
                            label="Audio"
                            inputName={`groups.${gIndex}.audio_url`}
                            value={form.watch(`groups.${gIndex}.audio_url`) || ""}
                            error={
                              form.formState.errors.groups?.[gIndex]?.audio_url
                                ?.message
                            }
                            onChange={(value) =>
                              form.setValue(`groups.${gIndex}.audio_url`, value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            onUploaded={trackUploadedMedia}
                            onDeleted={forgetUploadedMedia}
                            disabled={isPending}
                          />
                          )}
                          {showGroupImage && (
                          <QuestionGroupMediaField
                            type="image"
                            label="Hình ảnh"
                            inputName={`groups.${gIndex}.image_url`}
                            value={form.watch(`groups.${gIndex}.image_url`) || ""}
                            error={
                              form.formState.errors.groups?.[gIndex]?.image_url
                                ?.message
                            }
                            onChange={(value) =>
                              form.setValue(`groups.${gIndex}.image_url`, value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            onUploaded={trackUploadedMedia}
                            onDeleted={forgetUploadedMedia}
                            disabled={isPending}
                          />
                          )}
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
                        questions: [buildDefaultQuestion()],
                      })
                    }
                    className="w-full h-14 border-dashed border-2 text-blue-600 hover:bg-blue-50 font-bold rounded-lg"
                  >
                    <Plus className="mr-2" /> Thêm nhóm câu hỏi
                  </Button>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
                <div className="lg:col-span-7 flex flex-col space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Nội dung văn bản Aiken
                  </label>
                  <Textarea
                    ref={bulkTextareaRef}
                    value={bulkText}
                    onChange={(e) => {
                      setBulkText(e.target.value);
                      setBulkError("");
                      setBulkErrorDetails("");
                    }}
                    placeholder="Dán nội dung đề đã soạn theo cấu trúc Aiken vào đây..."
                    aria-invalid={!!bulkError}
                    className="flex-1 min-h-[50vh] font-mono text-sm bg-slate-900 text-slate-100 rounded-lg p-6 shadow-inner border border-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {bulkError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                      <p className="font-semibold">{bulkError}</p>
                      {bulkErrorDetails && (
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                          {bulkErrorDetails}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4 h-fit sticky top-24">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-500" />
                    Quy định cấu trúc Aiken mở rộng
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Hệ thống tự bóc tách đoạn văn, audio, câu hỏi và đáp án.
                    Hãy giữ đúng cấu trúc để tránh lỗi nhập liệu.
                  </p>

                  <div className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-lg space-y-1 select-all whitespace-pre leading-relaxed border border-slate-900 shadow-md">
{`Passage: Read the text and answer questions
[Audio]: https://vocaspace.com/audio/sample.mp3
[Image]: https://placehold.co/600x400.png
Q: What is indicated about the speaker?
A) He is a student.
B) He is a chef.
C) He is a manager.
D) He is a designer.
E) He is a trainer.
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

function OptionFields({
  form,
  name,
  radioName,
  className,
  addButtonClassName = "h-10",
}: {
  form: UseFormReturn<ExerciseFormValues>;
  name: OptionArrayPath;
  radioName: string;
  className: string;
  addButtonClassName?: string;
}) {
  const { fields, append, replace } = useFieldArray<
    ExerciseFormValues,
    OptionArrayPath
  >({
    control: form.control,
    name,
  });

  const watchedOptions =
    (useWatch({
      control: form.control,
      name,
    }) as OptionValue[] | undefined) || [];
  const optionError = form.getFieldState(name, form.formState).error?.message;

  const setCorrectOption = (selectedIndex: number) => {
    fields.forEach((_, index) => {
      form.setValue(`${name}.${index}.is_correct` as const, index === selectedIndex, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  };

  const removeOption = (indexToRemove: number) => {
    const currentOptions = (form.getValues(name) || []) as OptionValue[];
    if (currentOptions.length <= 2) {
      toast.error("Mỗi câu hỏi cần ít nhất 2 đáp án.");
      return;
    }

    const nextOptions = currentOptions.filter(
      (_, index) => index !== indexToRemove,
    );
    if (!nextOptions.some((option) => option.is_correct)) {
      nextOptions[0] = {
        ...nextOptions[0],
        is_correct: true,
      };
    }

    replace(nextOptions);
    form.trigger(name);
  };

  return (
    <div className={className}>
      {fields.map((field, optionIndex) => (
        <div
          key={field.id}
          className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200"
        >
          <input
            type="radio"
            className="w-4 h-4 text-blue-600"
            name={radioName}
            checked={!!watchedOptions[optionIndex]?.is_correct}
            onChange={() => setCorrectOption(optionIndex)}
          />
          <span className="w-6 text-sm font-bold text-slate-500 text-center">
            {optionLabel(optionIndex)}
          </span>
          <Input
            placeholder={`Đáp án ${optionLabel(optionIndex)}`}
            aria-label={`Answer ${optionLabel(optionIndex)}`}
            className="h-9 rounded-lg bg-white"
            {...form.register(`${name}.${optionIndex}.content` as const)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={fields.length <= 2}
            className="h-8 w-8 shrink-0 text-slate-400 hover:text-rose-600 disabled:opacity-40"
            onClick={() => removeOption(optionIndex)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => append({ content: "", is_correct: false })}
        className={`${addButtonClassName} border-dashed text-blue-600 hover:bg-blue-50 font-bold rounded-lg`}
      >
        <Plus size={16} className="mr-2" />
        Thêm đáp án {optionLabel(fields.length)}
      </Button>
      {optionError && (
        <p className="text-xs font-medium text-rose-500">{optionError}</p>
      )}
    </div>
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
  } = useFieldArray<ExerciseFormValues, GroupQuestionArrayPath>({
    control: form.control,
    name: `groups.${gIndex}.questions`,
  });

  return (
    <div className="space-y-6">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
        Các câu hỏi trong nhóm
      </label>
      {questionFields.map((question, qIndex) => (
        <div
          key={question.id}
          className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3"
        >
          <div className="flex gap-2">
            <span className="font-bold text-blue-600 mt-2">Q{qIndex + 1}.</span>
            <div className="flex-1">
              <Input
                placeholder="Nội dung câu hỏi..."
                aria-label={`Question content group ${gIndex + 1} question ${qIndex + 1}`}
                className="h-10 rounded-lg bg-white"
                aria-invalid={
                  !!form.getFieldState(
                    `groups.${gIndex}.questions.${qIndex}.content`,
                    form.formState,
                  ).error
                }
                {...form.register(
                  `groups.${gIndex}.questions.${qIndex}.content`,
                )}
              />
              {form.getFieldState(
                `groups.${gIndex}.questions.${qIndex}.content`,
                form.formState,
              ).error?.message && (
                <p className="mt-2 text-xs font-medium text-rose-500">
                  {
                    form.getFieldState(
                      `groups.${gIndex}.questions.${qIndex}.content`,
                      form.formState,
                    ).error?.message
                  }
                </p>
              )}
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
              placeholder="Giải thích đáp án tùy chọn..."
              className="h-8 rounded-lg bg-white text-xs"
              {...form.register(
                `groups.${gIndex}.questions.${qIndex}.explanation`,
              )}
            />
          </div>

          <OptionFields
            form={form}
            name={`groups.${gIndex}.questions.${qIndex}.options`}
            radioName={`groups.${gIndex}.questions.${qIndex}.correct_answer`}
            className="grid grid-cols-1 gap-2 pl-6"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={() => appendQuestion(buildDefaultQuestion())}
        className="text-blue-600 font-bold hover:bg-blue-50 w-full"
      >
        <Plus size={16} className="mr-2" /> Thêm câu hỏi vào nhóm
      </Button>
    </div>
  );
}
