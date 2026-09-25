"use server";

import { unstable_noStore } from "next/cache";
import {
  publicCoursePreviewAnswerInputSchema,
  publicCoursePreviewAnswerRpcSchema,
  publicCoursePreviewParamsSchema,
  publicCoursePreviewRpcSchema,
  type PublicCoursePreview,
} from "@/lib/schemas/public-course-preview";
import { parseQuestionGroupManagedMediaReference } from "@/lib/schemas/exercise";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type PublicCoursePreviewResult =
  | { status: "success"; data: PublicCoursePreview }
  | { status: "unavailable" }
  | { status: "error"; error: string };

export type PublicCoursePreviewAnswerResult =
  | { status: "success"; data: { isCorrect: boolean; explanation: string | null } }
  | { status: "unavailable" }
  | { status: "error"; error: string };

const PREVIEW_ERROR = "Không thể tải nội dung xem thử lúc này. Vui lòng thử lại.";
const ANSWER_ERROR = "Không thể kiểm tra câu trả lời lúc này. Vui lòng thử lại.";

function isKnownManagedReference(value: string) {
  if (value.startsWith("storage://question_group_")) return true;
  try {
    const url = new URL(value);
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!configuredUrl || url.origin !== new URL(configuredUrl).origin) return false;
    return /\/storage\/v1\/object\/[^/]+\/question_group_(?:images|audios)\//.test(url.pathname);
  } catch {
    return false;
  }
}

function isSupabaseStorageObjectUrl(value: string) {
  try {
    const url = new URL(value);
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return Boolean(
      configuredUrl &&
        url.origin === new URL(configuredUrl).origin &&
        url.pathname.startsWith("/storage/v1/object/"),
    );
  } catch {
    return false;
  }
}

function mapQuestionGroupMedia(
  groupId: string,
  type: "image" | "audio",
  value: string | null,
) {
  if (!value) return null;
  const managed = parseQuestionGroupManagedMediaReference(
    type,
    value,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (managed) return `/api/public-course-preview/media/${groupId}/${type}`;
  if (isKnownManagedReference(value)) return null;
  return mapExternalPreviewMedia(value);
}

function mapExternalPreviewMedia(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return value;
    if (
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port === "45321"
    ) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

function mapCardMedia(value: string | null) {
  if (!value) return null;
  // Cards have no Preview-scoped storage route, so never expose a stored Supabase object URL.
  if (
    value.startsWith("storage://") ||
    isKnownManagedReference(value) ||
    isSupabaseStorageObjectUrl(value)
  ) {
    return null;
  }
  return mapExternalPreviewMedia(value);
}

export async function getPublicCoursePreview(
  rawParams: unknown,
): Promise<PublicCoursePreviewResult> {
  unstable_noStore();
  const params = publicCoursePreviewParamsSchema.safeParse(rawParams);
  if (!params.success) return { status: "unavailable" };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("get_public_course_preview", {
      p_course_slug: params.data.courseSlug,
      p_topic_slug: params.data.topicSlug,
    });

    if (error) {
      console.error("Public course preview RPC failed", error);
      return { status: "error", error: PREVIEW_ERROR };
    }
    if (data === null) return { status: "unavailable" };

    const parsed = publicCoursePreviewRpcSchema.safeParse(data);
    if (!parsed.success) {
      console.error("Public course preview contract drift", parsed.error.issues);
      return { status: "error", error: PREVIEW_ERROR };
    }

    return {
      status: "success",
      data: {
        ...parsed.data,
        flashcards: parsed.data.flashcards.map((card) => ({
          ...card,
          audio_url: mapCardMedia(card.audio_url),
          image_url: mapCardMedia(card.image_url),
        })),
        exercises: parsed.data.exercises.map((exercise) => ({
          ...exercise,
          groups: exercise.groups.map((group) => ({
            ...group,
            audio_url: mapQuestionGroupMedia(group.id, "audio", group.audio_url),
            image_url: mapQuestionGroupMedia(group.id, "image", group.image_url),
          })),
        })),
      },
    };
  } catch (error) {
    console.error("Public course preview service unavailable", error);
    return { status: "error", error: PREVIEW_ERROR };
  }
}

export async function answerPublicCoursePreviewQuestion(
  rawInput: unknown,
): Promise<PublicCoursePreviewAnswerResult> {
  unstable_noStore();
  const input = publicCoursePreviewAnswerInputSchema.safeParse(rawInput);
  if (!input.success) return { status: "unavailable" };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc(
      "get_public_course_preview_answer",
      {
        p_course_slug: input.data.courseSlug,
        p_topic_slug: input.data.topicSlug,
        p_question_id: input.data.questionId,
        p_option_id: input.data.selectedOptionId,
      },
    );

    if (error) {
      console.error("Public course preview answer RPC failed", error);
      return { status: "error", error: ANSWER_ERROR };
    }
    if (data === null) return { status: "unavailable" };

    const parsed = publicCoursePreviewAnswerRpcSchema.safeParse(data);
    if (!parsed.success) {
      console.error("Public course preview answer contract drift", parsed.error.issues);
      return { status: "error", error: ANSWER_ERROR };
    }

    return {
      status: "success",
      data: {
        isCorrect: parsed.data.is_correct,
        explanation: parsed.data.explanation,
      },
    };
  } catch (error) {
    console.error("Public course preview answer service unavailable", error);
    return { status: "error", error: ANSWER_ERROR };
  }
}
