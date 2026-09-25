import { z } from "zod";
import { parseQuestionGroupManagedMediaReference } from "@/lib/schemas/exercise";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const paramsSchema = z.strictObject({
  groupId: z.uuid(),
  type: z.enum(["image", "audio"]),
});

const mediaReferenceSchema = z.strictObject({
  course_id: z.uuid(),
  topic_id: z.uuid(),
  media_reference: z.string().nullable(),
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

function rangeResponse(request: Request, blob: Blob, contentType: string) {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string; type: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return unavailable();

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc(
      "get_public_course_preview_group_media",
      {
        p_group_id: parsed.data.groupId,
        p_type: parsed.data.type,
      },
    );
    if (error || data === null) return unavailable();

    const reference = mediaReferenceSchema.safeParse(data);
    if (!reference.success || !reference.data.media_reference) return unavailable();
    const media = parseQuestionGroupManagedMediaReference(
      parsed.data.type,
      reference.data.media_reference,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
    if (!media) return unavailable();

    const pathSegments = media.path.split("/");
    if (
      pathSegments.length !== 4 ||
      pathSegments[0] !== reference.data.course_id ||
      pathSegments[1] !== reference.data.topic_id
    ) {
      return unavailable();
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(media.bucket)
      .download(media.path);
    if (downloadError || !blob) return unavailable();

    const extension = pathSegments[3].split(".").pop()?.toLowerCase() ?? "";
    const contentType = blob.type || mimeByExtension[extension] || "application/octet-stream";
    return rangeResponse(request, blob, contentType);
  } catch (error) {
    console.error("Public course preview media delivery failed", error);
    return unavailable();
  }
}
