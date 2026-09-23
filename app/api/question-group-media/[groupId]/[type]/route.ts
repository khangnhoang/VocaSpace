import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import {
  parseQuestionGroupManagedMediaReference,
} from "@/lib/schemas/exercise";

export const runtime = "nodejs";

const paramsSchema = z.object({
  groupId: z.uuid(),
  type: z.enum(["image", "audio"]),
});

const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  webm: "audio/webm",
};

function unavailable() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string; type: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return unavailable();

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unavailable();

  const { data: group, error: groupError } = await supabase
    .from("question_groups")
    .select("exercise_id, audio_url, image_url")
    .eq("id", parsed.data.groupId)
    .is("removed_at", null)
    .single();
  if (groupError || !group) return unavailable();

  const { data: exercise, error: exerciseError } = await supabase
    .from("exercises")
    .select("course_id, topic_id")
    .eq("id", group.exercise_id)
    .is("removed_at", null)
    .single();
  if (exerciseError || !exercise) return unavailable();

  const value = parsed.data.type === "image" ? group.image_url : group.audio_url;
  const media = value && parseQuestionGroupManagedMediaReference(
    parsed.data.type,
    value,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (!media) return unavailable();

  const segments = media.path.split("/");
  if (segments[0] !== exercise.course_id || segments[1] !== exercise.topic_id) {
    return unavailable();
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(media.bucket)
    .download(media.path);
  if (downloadError || !blob) return unavailable();

  const extension = media.path.split(".").pop()?.toLowerCase() ?? "";
  const contentType = blob.type || mimeByExtension[extension] || "application/octet-stream";
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });

  const range = request.headers.get("range");
  if (!range) {
    headers.set("Content-Length", String(blob.size));
    return new Response(blob.stream(), { status: 200, headers });
  }

  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) {
    headers.set("Content-Range", `bytes */${blob.size}`);
    return new Response(null, { status: 416, headers });
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : blob.size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= blob.size) {
    headers.set("Content-Range", `bytes */${blob.size}`);
    return new Response(null, { status: 416, headers });
  }

  headers.set("Content-Range", `bytes ${start}-${end}/${blob.size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(blob.slice(start, end + 1).stream(), { status: 206, headers });
}
