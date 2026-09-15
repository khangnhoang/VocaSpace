import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  QUESTION_GROUP_AUDIO_BUCKET,
  QUESTION_GROUP_IMAGE_BUCKET,
  validateQuestionGroupMediaFile,
  type QuestionGroupMediaType,
} from "@/lib/schemas/exercise";

export const runtime = "nodejs";

// Route Handler nhận multipart media để tránh Server Action body size limit.
const QUESTION_GROUP_MEDIA_BUCKETS = {
  image: QUESTION_GROUP_IMAGE_BUCKET,
  audio: QUESTION_GROUP_AUDIO_BUCKET,
} as const;

type UploadResponse = {
  bucket: string;
  path: string;
  publicUrl: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getUploadType(value: FormDataEntryValue | null): QuestionGroupMediaType | null {
  if (value === "image" || value === "audio") return value;
  return null;
}

function getUploadFile(value: FormDataEntryValue | null) {
  // FormDataEntryValue có thể là string; phải narrow về File trước khi validate.
  if (
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "size" in value &&
    "type" in value
  ) {
    return value as File;
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // Auth và course-scoped authoring được kiểm tra server-side trước mọi upload.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error("[QUESTION GROUP MEDIA FORMDATA ERROR]:", err);
    return jsonError("Dữ liệu tải lên không hợp lệ.", 400);
  }

  const type = getUploadType(formData.get("type"));
  if (!type) {
    return jsonError("Loại media không hợp lệ.", 400);
  }

  const topicId = formData.get("topicId");
  if (typeof topicId !== "string" || !topicId) {
    return jsonError("Thiếu ngữ cảnh bài học cho media.", 400);
  }

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("course_id, status, removed_at")
    .eq("id", topicId)
    .single();

  if (topicError || !topic) {
    if (topicError) console.error("[QUESTION GROUP MEDIA TOPIC ERROR]:", topicError);
    return jsonError("Bài học không còn khả dụng hoặc bạn không có quyền tải lên.", 403);
  }

  if (topic.removed_at || topic.status === "pending") {
    return jsonError("Bài học đang khóa nội dung và không nhận thay đổi media.", 409);
  }

  const { data: hasAuthoringAccess, error: accessError } = await supabase.rpc(
    "has_course_authoring_access",
    { target_course_id: topic.course_id },
  );
  if (accessError) {
    console.error("[QUESTION GROUP MEDIA ACCESS ERROR]:", accessError);
    return jsonError("Không thể kiểm tra quyền tải lên. Vui lòng thử lại.", 500);
  }
  if (!hasAuthoringAccess) {
    return jsonError("Bạn không có quyền tải lên media cho nhóm câu hỏi.", 403);
  }

  const file = getUploadFile(formData.get("file"));
  const validated = await validateQuestionGroupMediaFile(type, file);

  if (!validated.success) {
    return jsonError(validated.error, 400);
  }

  const bucket = QUESTION_GROUP_MEDIA_BUCKETS[type];
  // Path do server sinh theo course/topic + auth.uid()/uuid.ext, không tin original filename.
  // Storage policy dùng topicId trong path để chặn upload trực tiếp khi topic pending.
  const path = `${topic.course_id}/${topicId}/${user.id}/${crypto.randomUUID()}.${validated.extension}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file!, {
        contentType: validated.contentType,
        // Không overwrite object cũ nếu uuid/path trùng ngoài dự kiến.
        upsert: false,
      });

    if (uploadError) {
      // Log lỗi thô server-side, UI chỉ nhận thông điệp tiếng Việt an toàn.
      console.error("[QUESTION GROUP MEDIA UPLOAD ERROR]:", uploadError);
      return jsonError("Không thể tải file lên hệ thống. Vui lòng thử lại.", 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    const payload: UploadResponse = { bucket, path, publicUrl };
    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    // Không expose exception/raw Storage details ra client.
    console.error("[QUESTION GROUP MEDIA UPLOAD EXCEPTION]:", err);
    return jsonError("Không thể tải file lên hệ thống. Vui lòng thử lại.", 500);
  }
}
