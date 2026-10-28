"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
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
  TOEIC_PART_TYPES,
  exerciseSchema,
  getToeicVisibleGroupContextFields,
  type ExerciseFormValues,
} from "@/lib/schemas/exercise";
import { createExercise, deleteQuestionGroupMedia } from "@/app/actions/exercise";
import QuestionGroupMediaField, {
  type UploadedQuestionGroupMedia,
} from "./QuestionGroupMediaField";
import EditorFrame, { FieldError } from "./EditorFrame";
import { WorkbenchPreview } from "./AuthoringWorkbench";
import { GroupContextPreview, QuestionPreview } from "./LearnerPreview";
import { useRegisterAuthoringEditor, useSingleFlightSave } from "./authoring-guard";
import { TOEIC_PART_LABELS } from "./exercise-outline";

interface ExerciseComposerProps {
  topicId: string;
  readOnly?: boolean;
  onCreated: () => void;
  onCreateSuccess?: () => boolean;
  onCancel: () => void;
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

const buildDefaultGroup = () => ({
  passage_text: "",
  audio_url: "",
  image_url: "",
  questions: [buildDefaultQuestion()],
});

const COMPOSER_DEFAULTS: ExerciseFormValues = {
  title: "",
  part_type: "",
  order_index: 1,
  groups: [buildDefaultGroup()],
  questions: undefined,
};

// Bài tập mới được lưu nguyên khối qua `createExercise` (RPC `create_exercise_with_content`),
// vì chưa có action thêm nhóm/câu vào bài tập đã lưu (TFEAT-005).
export default function ExerciseComposer({
  topicId,
  readOnly = false,
  onCreated,
  onCreateSuccess,
  onCancel,
}: ExerciseComposerProps) {
  const id = useId();
  const [isPending, setIsPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedQuestionGroupMedia[]>([]);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const saveFlight = useSingleFlightSave();

  const exerciseFormResolver: Resolver<ExerciseFormValues> = async (values, context, options) => {
    const isStandalone = values.part_type === "part5";
    const sanitizedValues: ExerciseFormValues = {
      ...values,
      groups: isStandalone ? undefined : values.groups,
      questions: isStandalone ? values.questions : undefined,
    };
    return (zodResolver(exerciseSchema) as Resolver<ExerciseFormValues>)(sanitizedValues, context, options);
  };

  const form = useForm<ExerciseFormValues>({
    resolver: exerciseFormResolver,
    defaultValues: COMPOSER_DEFAULTS,
  });

  const { fields: groupFields, append: appendGroup, remove: removeGroup } = useFieldArray({
    control: form.control,
    name: "groups",
  });
  const {
    fields: standaloneQuestionFields,
    append: appendStandaloneQuestion,
    remove: removeStandaloneQuestion,
  } = useFieldArray({ control: form.control, name: "questions" });

  const partType = useWatch({ control: form.control, name: "part_type" });
  const watchedGroups = useWatch({ control: form.control, name: "groups" });
  const watchedQuestions = useWatch({ control: form.control, name: "questions" });
  const visibleGroupContextFields = getToeicVisibleGroupContextFields(partType || "");
  const showGroupPassage = visibleGroupContextFields.includes("passage_text");
  const showGroupAudio = visibleGroupContextFields.includes("audio_url");
  const showGroupImage = visibleGroupContextFields.includes("image_url");
  const titleError = form.formState.errors.title?.message;
  const groupsRootError =
    (form.formState.errors.groups as { message?: string } | undefined)?.message ??
    (form.formState.errors.questions as { message?: string } | undefined)?.message;

  const trackUploadedMedia = (media: UploadedQuestionGroupMedia) => {
    setUploadedMedia((current) => [
      ...current.filter((item) => item.bucket !== media.bucket || item.path !== media.path),
      media,
    ]);
  };

  const forgetUploadedMedia = (media: UploadedQuestionGroupMedia) => {
    setUploadedMedia((current) =>
      current.filter((item) => item.bucket !== media.bucket || item.path !== media.path),
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
        console.warn("[QUESTION GROUP MEDIA CLEANUP ERROR]:", mediaList[index], result.value.error);
      }
    });
    setUploadedMedia((current) =>
      current.filter(
        (item) => !mediaList.some((media) => media.bucket === item.bucket && media.path === item.path),
      ),
    );
  };

  const clearCleanedMediaUrls = (mediaList: UploadedQuestionGroupMedia[]) => {
    const cleanedUrls = new Set(mediaList.map((media) => media.reference));
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
      (media) => media.reference === group?.audio_url || media.reference === group?.image_url,
    );
    await cleanupUploadedMedia(mediaToCleanup);
    removeGroup(gIndex);
  };

  useEffect(() => {
    if (!partType) return;
    if (partType === "part5") {
      form.setValue("groups", undefined);
      if (!form.getValues("questions") || form.getValues("questions")?.length === 0) {
        form.setValue("questions", [buildDefaultQuestion()]);
      }
      return;
    }
    form.setValue("questions", undefined);
    if (!form.getValues("groups") || form.getValues("groups")?.length === 0) {
      form.setValue("groups", [buildDefaultGroup()]);
    }
  }, [partType, form]);

  const buildManualPayload = (values: ExerciseFormValues): ExerciseFormValues => {
    if (values.part_type === "part5") {
      return {
        title: values.title,
        part_type: values.part_type,
        questions:
          values.questions?.map(compactQuestion).filter((question) => question.content !== "") || [],
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
            questions: group.questions.map(compactQuestion).filter((question) => question.content !== ""),
          }))
          .filter(
            (group) => group.passage_text || group.audio_url || group.image_url || group.questions.length > 0,
          ) || [],
    };
  };

  const createFromValues = async (values: ExerciseFormValues) => {
    if (readOnly) return false;
    const validation = exerciseSchema.safeParse(buildManualPayload(values));
    if (!validation.success) {
      setSaveError(validation.error.issues[0]?.message ?? "Vui lòng kiểm tra lại các trường chưa hợp lệ.");
      return false;
    }
    setIsPending(true);
    setSaveError(null);
    const res = await createExercise(topicId, validation.data);
    if (res.error) {
      const mediaToCleanup = [...uploadedMedia];
      await cleanupUploadedMedia(mediaToCleanup);
      clearCleanedMediaUrls(mediaToCleanup);
      setIsPending(false);
      setSaveError(res.error);
      return false;
    }
    setIsPending(false);
    // Callback này chỉ dùng cho đường vào từ dashboard; parent đã báo inline thì không toast nữa.
    const handledByDashboardFeedback = onCreateSuccess?.();
    if (!handledByDashboardFeedback) toast.success(res.message);
    setUploadedMedia([]);
    form.reset(COMPOSER_DEFAULTS);
    onCreated();
    return true;
  };

  const handleInvalidSubmit = (errors: FieldErrors<ExerciseFormValues>) => {
    setSaveError("Vui lòng kiểm tra lại các trường được đánh dấu.");
    const mediaErrorName = getFirstMediaErrorName(errors);
    if (mediaErrorName && focusFieldByName(mediaErrorName)) return;
    requestAnimationFrame(() => {
      const firstInvalid = document.querySelector<HTMLElement>("[data-composer] [aria-invalid='true']");
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid?.focus();
    });
  };

  const submit = () =>
    new Promise<boolean>((resolve) => {
      void form.handleSubmit(
        async (values) => resolve(await createFromValues(values)),
        (errors) => {
          handleInvalidSubmit(errors);
          resolve(false);
        },
      )();
    });

  const discard = () => {
    void cleanupUploadedMedia(uploadedMedia);
    form.reset(COMPOSER_DEFAULTS);
    setSaveError(null);
  };

  // RHF báo dirty ngay khi useFieldArray khởi tạo nhánh câu hỏi, nên composer chỉ được coi là có
  // thay đổi khi đã chọn Part: mọi field nội dung chỉ hiện sau bước đó.
  useRegisterAuthoringEditor(
    readOnly
      ? null
      : {
          isDirty: () => Boolean(form.getValues("part_type")),
          save: () => saveFlight.run(submit),
          pendingSave: saveFlight.pending,
          discard,
          label: "Bài tập mới",
        },
  );

  const choosePart = (value: string) => {
    form.setValue("part_type", value, { shouldDirty: true, shouldValidate: false });
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const titleField = form.register("title");
  const previewGroup = watchedGroups?.[0];
  const previewQuestions =
    partType === "part5" ? (watchedQuestions ?? []).slice(0, 3) : (previewGroup?.questions ?? []).slice(0, 3);

  return (
    <EditorFrame
      eyebrow="Thêm bài tập TOEIC"
      title={partType ? TOEIC_PART_LABELS[partType]?.title ?? "Bài tập mới" : "Chọn loại bài"}
      isDirty={Boolean(partType)}
      isSaving={isPending}
      readOnly={readOnly}
      error={saveError}
      onSave={partType ? () => void saveFlight.run(submit) : undefined}
      saveLabel="Lưu bài tập"
      onCancel={onCancel}
    >
      <div data-composer className="space-y-6">
        {!partType ? (
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-slate-800">Loại bài (TOEIC Part)</legend>
            <p className="mb-3 text-sm text-slate-600">
              Không đổi được loại bài sau khi lưu. Mỗi loại cần ngữ liệu khác nhau.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TOEIC_PART_TYPES.map((part) => (
                <label
                  key={part}
                  className="flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors duration-[120ms] hover:border-route-line hover:bg-route-quiet has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-route motion-reduce:transition-none"
                >
                  <input
                    type="radio"
                    name={`${id}-part`}
                    value={part}
                    className="sr-only"
                    onChange={() => choosePart(part)}
                  />
                  <span className="text-sm font-bold text-slate-900">{TOEIC_PART_LABELS[part].title}</span>
                  <span className="text-sm text-slate-600">{TOEIC_PART_LABELS[part].needs}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-route-line bg-route-quiet px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-route">{TOEIC_PART_LABELS[partType]?.title}</p>
                <p className="text-sm text-slate-700">{TOEIC_PART_LABELS[partType]?.needs}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-route"
                onClick={() => form.setValue("part_type", "", { shouldDirty: true })}
              >
                Đổi loại bài
              </Button>
            </div>

            <div>
              <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-semibold text-slate-800">
                Tên bài tập <span className="text-correction" aria-hidden="true">*</span>
              </label>
              <Input
                id={`${id}-title`}
                placeholder="VD: Reading Practice Test 1"
                className="h-11"
                aria-required
                aria-invalid={titleError ? true : undefined}
                aria-describedby={titleError ? `${id}-title-error` : undefined}
                {...titleField}
                ref={(element) => {
                  titleField.ref(element);
                  titleRef.current = element;
                }}
              />
              <FieldError id={`${id}-title-error`} message={titleError} />
            </div>

            {partType === "part5" ? (
              <div className="space-y-4">
                {standaloneQuestionFields.map((question, qIndex) => {
                  const contentState = form.getFieldState(`questions.${qIndex}.content`, form.formState);
                  return (
                    <section
                      key={question.id}
                      aria-label={`Câu hỏi ${qIndex + 1}`}
                      className="space-y-3 border-l-2 border-slate-200 pl-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <HelpCircle className="size-4 text-recall" aria-hidden="true" /> Câu {qIndex + 1}
                        </h4>
                        <Button
                          type="button"
                          variant="destructive-quiet"
                          size="icon"
                          aria-label={`Bỏ câu ${qIndex + 1}`}
                          disabled={standaloneQuestionFields.length <= 1}
                          onClick={() => removeStandaloneQuestion(qIndex)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                      <div>
                        <label htmlFor={`${id}-q${qIndex}`} className="mb-1.5 block text-sm font-semibold text-slate-800">
                          Nội dung câu hỏi
                        </label>
                        <Input
                          id={`${id}-q${qIndex}`}
                          className="h-11"
                          aria-invalid={contentState.error ? true : undefined}
                          aria-describedby={contentState.error ? `${id}-q${qIndex}-error` : undefined}
                          {...form.register(`questions.${qIndex}.content`)}
                        />
                        <FieldError id={`${id}-q${qIndex}-error`} message={contentState.error?.message} />
                      </div>
                      <OptionFields
                        form={form}
                        name={`questions.${qIndex}.options`}
                        radioName={`${id}-questions.${qIndex}.correct_answer`}
                        label={`câu ${qIndex + 1}`}
                      />
                      <div>
                        <label
                          htmlFor={`${id}-q${qIndex}-explanation`}
                          className="mb-1.5 block text-sm font-semibold text-slate-800"
                        >
                          Giải thích đáp án <span className="font-normal text-slate-600">(tùy chọn)</span>
                        </label>
                        <Textarea
                          id={`${id}-q${qIndex}-explanation`}
                          className="min-h-16 resize-y"
                          {...form.register(`questions.${qIndex}.explanation`)}
                        />
                      </div>
                    </section>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendStandaloneQuestion(buildDefaultQuestion())}
                  className="w-full border-dashed"
                >
                  <Plus aria-hidden="true" /> Thêm câu hỏi
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {groupFields.map((group, gIndex) => {
                  const groupErrors = form.formState.errors.groups?.[gIndex];
                  return (
                    <section
                      key={group.id}
                      aria-label={`Nhóm câu hỏi ${gIndex + 1}`}
                      className="space-y-4 rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900">Nhóm {gIndex + 1}</h4>
                        <Button
                          type="button"
                          variant="destructive-quiet"
                          size="sm"
                          disabled={groupFields.length <= 1}
                          onClick={() => void handleRemoveGroup(gIndex)}
                        >
                          <Trash2 aria-hidden="true" /> Bỏ nhóm {gIndex + 1}
                        </Button>
                      </div>
                      {showGroupPassage ? (
                        <div>
                          <label
                            htmlFor={`${id}-g${gIndex}-passage`}
                            className="mb-1.5 block text-sm font-semibold text-slate-800"
                          >
                            Đoạn văn
                          </label>
                          <Textarea
                            id={`${id}-g${gIndex}-passage`}
                            placeholder="Nhập đoạn văn cho nhóm câu hỏi này…"
                            className="min-h-32 resize-y"
                            aria-invalid={groupErrors?.passage_text ? true : undefined}
                            aria-describedby={groupErrors?.passage_text ? `${id}-g${gIndex}-passage-error` : undefined}
                            {...form.register(`groups.${gIndex}.passage_text`)}
                          />
                          <FieldError id={`${id}-g${gIndex}-passage-error`} message={groupErrors?.passage_text?.message} />
                        </div>
                      ) : null}
                      {showGroupAudio ? (
                        <QuestionGroupMediaField
                          topicId={topicId}
                          type="audio"
                          label="Audio"
                          inputName={`groups.${gIndex}.audio_url`}
                          value={watchedGroups?.[gIndex]?.audio_url || ""}
                          error={groupErrors?.audio_url?.message}
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
                      ) : null}
                      {showGroupImage ? (
                        <QuestionGroupMediaField
                          topicId={topicId}
                          type="image"
                          label="Hình ảnh"
                          inputName={`groups.${gIndex}.image_url`}
                          value={watchedGroups?.[gIndex]?.image_url || ""}
                          error={groupErrors?.image_url?.message}
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
                      ) : null}
                      <QuestionList form={form} gIndex={gIndex} idPrefix={id} />
                    </section>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendGroup(buildDefaultGroup())}
                  className="w-full border-dashed"
                >
                  <Plus aria-hidden="true" /> Thêm nhóm câu hỏi
                </Button>
              </div>
            )}
            {groupsRootError ? <p className="text-sm font-medium text-correction">{groupsRootError}</p> : null}
          </>
        )}
      </div>
      {partType ? (
        <WorkbenchPreview>
          {partType !== "part5" && previewGroup ? (
            <GroupContextPreview
              passage={previewGroup.passage_text}
              audioUrl={previewGroup.audio_url}
              imageUrl={previewGroup.image_url}
            />
          ) : null}
          {previewQuestions.map((question, index) => (
            <QuestionPreview
              key={index}
              content={question.content}
              options={question.options}
              explanation={question.explanation}
              numberLabel={`Câu ${index + 1}.`}
            />
          ))}
        </WorkbenchPreview>
      ) : null}
    </EditorFrame>
  );
}

function OptionFields({
  form,
  name,
  radioName,
  label,
}: {
  form: UseFormReturn<ExerciseFormValues>;
  name: OptionArrayPath;
  radioName: string;
  label: string;
}) {
  const { fields, append, replace } = useFieldArray<ExerciseFormValues, OptionArrayPath>({
    control: form.control,
    name,
  });
  const watchedOptions = (useWatch({ control: form.control, name }) as OptionValue[] | undefined) || [];
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
    if (currentOptions.length <= 2) return;
    const nextOptions = currentOptions.filter((_, index) => index !== indexToRemove);
    if (!nextOptions.some((option) => option.is_correct)) {
      nextOptions[0] = { ...nextOptions[0], is_correct: true };
    }
    replace(nextOptions);
    form.trigger(name);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-slate-800">
        Đáp án {label} <span className="font-normal text-slate-600">(chọn 1 đáp án đúng)</span>
      </legend>
      {fields.map((field, optionIndex) => {
        const letter = optionLabel(optionIndex);
        const isCorrect = !!watchedOptions[optionIndex]?.is_correct;
        return (
          <div
            key={field.id}
            className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
              isCorrect ? "border-growth-line bg-growth-quiet" : "border-slate-200 bg-white"
            }`}
          >
            <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
              <input
                type="radio"
                className="size-5 accent-[var(--growth)]"
                name={radioName}
                checked={isCorrect}
                onChange={() => setCorrectOption(optionIndex)}
                aria-label={`Đáp án ${letter} của ${label} là đáp án đúng`}
              />
            </label>
            <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-600" aria-hidden="true">
              {letter}
            </span>
            <Input
              placeholder={`Đáp án ${letter}`}
              aria-label={`Đáp án ${letter} của ${label}`}
              className="h-10 min-w-0 flex-1 bg-white"
              {...form.register(`${name}.${optionIndex}.content` as const)}
            />
            <Button
              type="button"
              variant="destructive-quiet"
              size="icon"
              disabled={fields.length <= 2}
              aria-label={`Bỏ đáp án ${letter} của ${label}`}
              onClick={() => removeOption(optionIndex)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-route"
        onClick={() => append({ content: "", is_correct: false })}
      >
        <Plus aria-hidden="true" /> Thêm đáp án {optionLabel(fields.length)}
      </Button>
      {optionError ? <p className="text-sm font-medium text-correction">{optionError}</p> : null}
    </fieldset>
  );
}

function QuestionList({
  form,
  gIndex,
  idPrefix,
}: {
  form: UseFormReturn<ExerciseFormValues>;
  gIndex: number;
  idPrefix: string;
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
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-800">Câu hỏi trong nhóm {gIndex + 1}</p>
      {questionFields.map((question, qIndex) => {
        const contentId = `${idPrefix}-g${gIndex}-q${qIndex}`;
        const contentState = form.getFieldState(`groups.${gIndex}.questions.${qIndex}.content`, form.formState);
        const label = `câu ${qIndex + 1} nhóm ${gIndex + 1}`;
        return (
          <section key={question.id} aria-label={`Câu ${qIndex + 1} của nhóm ${gIndex + 1}`} className="space-y-3 border-l-2 border-slate-200 pl-4">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor={contentId} className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Câu {qIndex + 1}
                </label>
                <Input
                  id={contentId}
                  placeholder="Nội dung câu hỏi…"
                  className="h-11"
                  aria-invalid={contentState.error ? true : undefined}
                  aria-describedby={contentState.error ? `${contentId}-error` : undefined}
                  {...form.register(`groups.${gIndex}.questions.${qIndex}.content`)}
                />
              </div>
              <Button
                type="button"
                variant="destructive-quiet"
                size="icon-lg"
                aria-label={`Bỏ ${label}`}
                disabled={questionFields.length <= 1}
                onClick={() => removeQuestion(qIndex)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <FieldError id={`${contentId}-error`} message={contentState.error?.message} />
            <OptionFields
              form={form}
              name={`groups.${gIndex}.questions.${qIndex}.options`}
              radioName={`${idPrefix}-groups.${gIndex}.questions.${qIndex}.correct_answer`}
              label={label}
            />
            <div>
              <label htmlFor={`${contentId}-explanation`} className="mb-1.5 block text-sm font-semibold text-slate-800">
                Giải thích đáp án <span className="font-normal text-slate-600">(tùy chọn)</span>
              </label>
              <Input
                id={`${contentId}-explanation`}
                className="h-10"
                {...form.register(`groups.${gIndex}.questions.${qIndex}.explanation`)}
              />
            </div>
          </section>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-route"
        onClick={() => appendQuestion(buildDefaultQuestion())}
      >
        <Plus aria-hidden="true" /> Thêm câu hỏi vào nhóm {gIndex + 1}
      </Button>
    </div>
  );
}
