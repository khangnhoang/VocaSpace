// lib/schemas/exercise.ts
import { z } from "zod";

export const QUESTION_GROUP_IMAGE_BUCKET = "question_group_images";
export const QUESTION_GROUP_AUDIO_BUCKET = "question_group_audios";

export const QUESTION_GROUP_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const QUESTION_GROUP_AUDIO_MAX_SIZE_BYTES = 25 * 1024 * 1024;

export const QUESTION_GROUP_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const QUESTION_GROUP_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
] as const;

export const QUESTION_GROUP_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const QUESTION_GROUP_AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "aac",
  "webm",
] as const;

export type QuestionGroupMediaType = "image" | "audio";

export type ToeicPartType =
  | "part1"
  | "part2"
  | "part3"
  | "part4"
  | "part5"
  | "part6"
  | "part7";

export type ToeicGroupContextField = "passage_text" | "audio_url" | "image_url";

export type ToeicPartRule = {
  mode: "grouped" | "standalone";
  requiredGroupContext: readonly ToeicGroupContextField[];
  visibleGroupContext: readonly ToeicGroupContextField[];
};

export const TOEIC_PART_RULES: Record<ToeicPartType, ToeicPartRule> = {
  part1: {
    mode: "grouped",
    requiredGroupContext: ["image_url", "audio_url"],
    visibleGroupContext: ["image_url", "audio_url"],
  },
  part2: {
    mode: "grouped",
    requiredGroupContext: ["audio_url"],
    visibleGroupContext: ["audio_url"],
  },
  part3: {
    mode: "grouped",
    requiredGroupContext: ["audio_url"],
    visibleGroupContext: ["audio_url", "image_url"],
  },
  part4: {
    mode: "grouped",
    requiredGroupContext: ["audio_url"],
    visibleGroupContext: ["audio_url", "image_url"],
  },
  part5: { mode: "standalone", requiredGroupContext: [], visibleGroupContext: [] },
  part6: {
    mode: "grouped",
    requiredGroupContext: ["passage_text"],
    visibleGroupContext: ["passage_text"],
  },
  part7: {
    mode: "grouped",
    requiredGroupContext: ["passage_text"],
    visibleGroupContext: ["passage_text", "image_url"],
  },
} as const;

export const TOEIC_GROUP_CONTEXT_MESSAGES: Record<ToeicGroupContextField, string> = {
  passage_text: "Vui lòng nhập đoạn văn cho Part này.",
  audio_url: "Vui lòng thêm audio cho Part này.",
  image_url: "Vui lòng thêm hình ảnh cho Part này.",
};

export function getToeicPartRule(partType: string): ToeicPartRule | null {
  return (TOEIC_PART_RULES as Record<string, ToeicPartRule>)[partType] || null;
}

export function getToeicVisibleGroupContextFields(partType: string) {
  return getToeicPartRule(partType)?.visibleGroupContext || [];
}

function hasTextValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

const MEDIA_CONFIG = {
  image: {
    bucket: QUESTION_GROUP_IMAGE_BUCKET,
    extensions: QUESTION_GROUP_IMAGE_EXTENSIONS,
    mimeTypes: QUESTION_GROUP_IMAGE_MIME_TYPES,
    maxSize: QUESTION_GROUP_IMAGE_MAX_SIZE_BYTES,
    label: "hình ảnh",
  },
  audio: {
    bucket: QUESTION_GROUP_AUDIO_BUCKET,
    extensions: QUESTION_GROUP_AUDIO_EXTENSIONS,
    mimeTypes: QUESTION_GROUP_AUDIO_MIME_TYPES,
    maxSize: QUESTION_GROUP_AUDIO_MAX_SIZE_BYTES,
    label: "âm thanh",
  },
} as const;

function normalizeOptionalMediaUrl(value: unknown) {
  if (value == null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function hasAllowedHttpProtocol(url: URL) {
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;

  return (
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    url.port === "54321"
  );
}

function isSupabaseStoragePublicUrl(url: URL, bucket: string) {
  return url.pathname.includes(`/storage/v1/object/public/${bucket}/`);
}

function getPathExtension(pathname: string) {
  const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

export function isValidQuestionGroupMediaUrl(
  type: QuestionGroupMediaType,
  value: string,
) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (!hasAllowedHttpProtocol(url)) return false;

  const { bucket, extensions } = MEDIA_CONFIG[type];
  if (isSupabaseStoragePublicUrl(url, bucket)) return true;

  const extension = getPathExtension(url.pathname);
  return (extensions as readonly string[]).includes(extension);
}

function createQuestionGroupMediaUrlSchema(type: QuestionGroupMediaType) {
  return z.preprocess(
    normalizeOptionalMediaUrl,
    z
      .string()
      .refine((value) => isValidQuestionGroupMediaUrl(type, value), {
        message:
          type === "image"
            ? "Link hình ảnh không hợp lệ hoặc không đúng định dạng"
            : "Link âm thanh không hợp lệ hoặc không đúng định dạng",
      })
      .optional(),
  );
}

export const questionGroupImageUrlSchema = createQuestionGroupMediaUrlSchema("image");
export const questionGroupAudioUrlSchema = createQuestionGroupMediaUrlSchema("audio");

function getFileExtension(file: File) {
  const name = file.name || "";
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return name.slice(dotIndex + 1).toLowerCase();
}

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function bytesToAscii(bytes: Uint8Array, start: number, end: number) {
  return Array.from(bytes.slice(start, end))
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

function hasImageMagicBytes(extension: string, bytes: Uint8Array) {
  if (extension === "jpg" || extension === "jpeg") {
    return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  }

  if (extension === "png") {
    return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  if (extension === "webp") {
    return (
      bytesToAscii(bytes, 0, 4) === "RIFF" &&
      bytesToAscii(bytes, 8, 12) === "WEBP"
    );
  }

  return false;
}

function hasAudioMagicBytes(extension: string, bytes: Uint8Array) {
  if (extension === "mp3") {
    return (
      bytesToAscii(bytes, 0, 3) === "ID3" ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    );
  }

  if (extension === "wav") {
    return (
      bytesToAscii(bytes, 0, 4) === "RIFF" &&
      bytesToAscii(bytes, 8, 12) === "WAVE"
    );
  }

  if (extension === "ogg") return bytesToAscii(bytes, 0, 4) === "OggS";
  if (extension === "webm") return startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (extension === "m4a") return bytesToAscii(bytes, 4, 8) === "ftyp";
  if (extension === "aac") {
    return bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9);
  }

  return false;
}

async function hasExpectedMagicBytes(
  type: QuestionGroupMediaType,
  extension: string,
  file: File,
) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return type === "image"
    ? hasImageMagicBytes(extension, bytes)
    : hasAudioMagicBytes(extension, bytes);
}

export async function validateQuestionGroupMediaFile(
  type: QuestionGroupMediaType,
  file: File | null | undefined,
): Promise<
  | { success: true; extension: string; contentType: string }
  | { success: false; error: string }
> {
  if (!file || typeof file.arrayBuffer !== "function") {
    return { success: false, error: "Vui lòng chọn file để tải lên" };
  }

  if (file.size <= 0) {
    return { success: false, error: "File tải lên không được để trống" };
  }

  const config = MEDIA_CONFIG[type];
  if (file.size > config.maxSize) {
    const maxMb = config.maxSize / 1024 / 1024;
    return {
      success: false,
      error: `File ${config.label} không được vượt quá ${maxMb} MB`,
    };
  }

  if (!(config.mimeTypes as readonly string[]).includes(file.type)) {
    return {
      success: false,
      error: `Định dạng MIME của file ${config.label} không được hỗ trợ`,
    };
  }

  const extension = getFileExtension(file);
  if (!(config.extensions as readonly string[]).includes(extension)) {
    return {
      success: false,
      error: `Đuôi file ${config.label} không được hỗ trợ`,
    };
  }

  if (!(await hasExpectedMagicBytes(type, extension, file))) {
    return {
      success: false,
      error: `Nội dung file ${config.label} không khớp định dạng đã chọn`,
    };
  }

  return { success: true, extension, contentType: file.type };
}

export const optionSchema = z.object({
  id: z.string().optional(),
  content: z.string(),
  is_correct: z.boolean(),
  label: z.string().optional().nullable(),
  order_index: z.number().optional().nullable(),
});

export const questionSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, "Vui lòng nhập nội dung câu hỏi"),
  explanation: z.string().optional(),
  options: z
    .array(optionSchema)
    .refine((opts) => opts.filter((opt) => opt.content.trim() !== "").length >= 2, {
      message: "Phải có ít nhất 2 đáp án",
    })
    .refine((opts) => opts.some((opt) => opt.content.trim() !== "" && opt.is_correct), {
      message: "Phải chọn nhất 1 đáp án đúng",
    }),
});

export const questionGroupSchema = z.object({
  id: z.string().optional(),
  passage_text: z.string().optional(),
  audio_url: questionGroupAudioUrlSchema,
  image_url: questionGroupImageUrlSchema,
  questions: z.array(questionSchema).min(1, "Phải có ít nhất 1 câu hỏi"),
});

export const exerciseSchema = z
  .object({
    title: z.string().min(4, "Tên bài tập phải dài hơn 3 ký tự"),
    part_type: z.string().min(1, "Vui lòng chọn Part (VD: part7)"),
    order_index: z.number().optional(),
    groups: z.array(questionGroupSchema).optional(),
    questions: z.array(questionSchema).optional(),
  })
  .refine(
    (data) =>
      (data.groups && data.groups.length > 0) ||
      (data.questions && data.questions.length > 0),
    {
      message:
        "Bài tập phải có ít nhất 1 nhóm câu hỏi hoặc 1 câu hỏi lẻ hợp lệ!",
      path: ["groups"],
    },
  )
  .superRefine((data, ctx) => {
    const rule = getToeicPartRule(data.part_type);
    if (!rule) return;

    const groups = data.groups || [];
    const questions = data.questions || [];

    if (rule.mode === "grouped") {
      if (groups.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Part này cần ít nhất 1 nhóm câu hỏi.",
          path: ["groups"],
        });
        return;
      }

      groups.forEach((group, groupIndex) => {
        rule.requiredGroupContext.forEach((field) => {
          if (!hasTextValue(group[field])) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: TOEIC_GROUP_CONTEXT_MESSAGES[field],
              path: ["groups", groupIndex, field],
            });
          }
        });
      });
      return;
    }

    if (questions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Part 5 cần ít nhất 1 câu hỏi độc lập.",
        path: ["questions"],
      });
    }
  });

export function validateQuestionGroupToeicContext(
  partType: string,
  group: Partial<Record<ToeicGroupContextField, string | null | undefined>>,
) {
  const rule = getToeicPartRule(partType);
  if (!rule || rule.mode !== "grouped") return { success: true as const };

  for (const field of rule.requiredGroupContext) {
    if (!hasTextValue(group[field])) {
      return {
        success: false as const,
        field,
        message: TOEIC_GROUP_CONTEXT_MESSAGES[field],
      };
    }
  }

  return { success: true as const };
}

export const bulkExerciseSchema = z.object({
  title: z.string().min(4, "Tên bài tập phải dài hơn 3 ký tự"),
  part_type: z.string().min(1, "Vui lòng chọn Part (VD: part7)"),
  bulkText: z.string().min(1, "Vui lòng nhập nội dung văn bản theo cấu trúc Aiken"),
});

export type ExerciseFormValues = z.infer<typeof exerciseSchema>;
export type BulkExerciseFormValues = z.infer<typeof bulkExerciseSchema>;

export type FullExerciseOption = z.infer<typeof optionSchema> & { id: string };

export type FullExerciseQuestion = Omit<
  z.infer<typeof questionSchema>,
  "options"
> & {
  id: string;
  options: FullExerciseOption[];
};

export type FullExerciseGroup = Omit<
  z.infer<typeof questionGroupSchema>,
  "questions"
> & {
  id: string;
  questions: FullExerciseQuestion[];
};

export type FullExercise = Omit<z.infer<typeof exerciseSchema>, "groups"> & {
  id: string;
  groups: FullExerciseGroup[];
};
