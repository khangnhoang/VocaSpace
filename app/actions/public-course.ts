"use server";

import {
  publicCourseCatalogRpcSchema,
  publicCourseDetailRpcSchema,
  publicCourseSlugSchema,
  type PublicCourseCatalogItem,
  type PublicCourseDetail,
  type PublicCourseDetailRpc,
} from "@/lib/schemas/public-course";
import { createClient } from "@/utils/supabase/server";

export type PublicCourseCatalogResult =
  | { status: "success"; data: PublicCourseCatalogItem[] }
  | { status: "error"; error: string };

export type PublicCourseDetailResult =
  | { status: "success"; data: PublicCourseDetail }
  | { status: "not_found" }
  | { status: "error"; error: string };

const PUBLIC_CATALOG_ERROR =
  "Không thể tải danh sách khóa học lúc này. Vui lòng thử lại.";
const PUBLIC_DETAIL_ERROR =
  "Không thể tải thông tin khóa học lúc này. Vui lòng thử lại.";

function addTemporaryPreviewFlag(
  detail: PublicCourseDetailRpc,
): PublicCourseDetail["syllabus"] {
  let previewAssigned = false;

  return detail.syllabus.map((chapter) => ({
    ...chapter,
    topics: chapter.topics.map((topic) => {
      const isTemporaryPreview = !previewAssigned;
      if (isTemporaryPreview) previewAssigned = true;

      return {
        ...topic,
        is_temporary_preview: isTemporaryPreview,
      };
    }),
  }));
}

export async function getPublicCourseCatalog(): Promise<PublicCourseCatalogResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_catalog");

  if (error) {
    console.error("Public course catalog RPC failed", error);
    return { status: "error", error: PUBLIC_CATALOG_ERROR };
  }

  const parsed = publicCourseCatalogRpcSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Public course catalog contract drift", parsed.error.issues);
    return { status: "error", error: PUBLIC_CATALOG_ERROR };
  }

  return { status: "success", data: parsed.data };
}

export async function getPublicCourseDetail(
  rawCourseSlug: string,
): Promise<PublicCourseDetailResult> {
  const slugResult = publicCourseSlugSchema.safeParse(rawCourseSlug);
  if (!slugResult.success) return { status: "not_found" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_course_detail", {
    p_course_slug: slugResult.data,
  });

  if (error) {
    console.error("Public course detail RPC failed", error);
    return { status: "error", error: PUBLIC_DETAIL_ERROR };
  }
  if (data === null) return { status: "not_found" };

  const parsed = publicCourseDetailRpcSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Public course detail contract drift", parsed.error.issues);
    return { status: "error", error: PUBLIC_DETAIL_ERROR };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isEnrolled = false;

  if (user) {
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", parsed.data.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (enrollmentError) {
      console.error("Public course enrollment overlay failed", enrollmentError);
      return { status: "error", error: PUBLIC_DETAIL_ERROR };
    }
    isEnrolled = enrollment !== null;
  }

  return {
    status: "success",
    data: {
      ...parsed.data,
      syllabus: addTemporaryPreviewFlag(parsed.data),
      is_enrolled: isEnrolled,
    },
  };
}
