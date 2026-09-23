import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/question-group-media/upload/route";
import { deleteQuestionGroupMedia } from "@/app/actions/exercise";

// Test plan:
// - Mục tiêu: kiểm tra upload và cleanup media giữ đúng bucket/path, topic lifecycle,
//   uploader ownership, topic-group membership và admin moderation exception.
// - Loại test: Server Action/Route Handler unit với Supabase boundary mock.
// - Case thành công: author cleanup trên topic draft và admin cleanup trên topic published.
// - Case thất bại: bucket/path không hợp lệ, topic pending/published/removed, ngoài group
//   hoặc không phải uploader đều không được gọi Storage remove.
// - Bảo mật/phân quyền: upload cần topic-group access; không phát public URL.
// - Ổn định/resilience: lỗi Storage không trả raw provider details.
// - Invariant cần giữ: cleanup thường không thể bypass topic-group hoặc lifecycle boundary.
// - Kết quả verify gần nhất: passed bằng `npm.cmd test -- --run __tests__/schemas/exercise-media.test.ts __tests__/actions/question-group-media.test.ts __tests__/components/question-group-media-field.test.tsx`.
// - Ghi chú: route GET và Storage/RLS thật cần integration evidence riêng.

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);

const mocks = vi.hoisted(() => {
  let hasAuthoringAccess = true;
  let isAdmin = false;
  let topicStatus = "draft";
  let topicRemovedAt: string | null = null;
  let isTopicGroupMember = true;

  const storageBucket = {
    upload: vi.fn(
      async (): Promise<{ error: { message: string } | null }> => ({ error: null }),
    ),
    getPublicUrl: vi.fn((path: string) => ({
      data: {
        publicUrl: `https://project.supabase.co/storage/v1/object/public/question_group_images/${path}`,
      },
    })),
    remove: vi.fn(
      async (): Promise<{ error: { message: string } | null }> => ({ error: null }),
    ),
  };

  const supabase = {
    auth: {
      getUser: vi.fn(),
    },
    rpc: vi.fn(async (functionName: string) => {
      if (functionName === "is_admin") return { data: isAdmin, error: null };
      if (functionName === "d1_topic_group_member") {
        return { data: isTopicGroupMember && hasAuthoringAccess, error: null };
      }
      return { data: hasAuthoringAccess, error: null };
    }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({
        data: {
          id: "topic-1",
          course_id: "course-1",
          status: topicStatus,
          removed_at: topicRemovedAt,
        },
        error: null,
      })),
    })),
    storage: {
      from: vi.fn(() => storageBucket),
    },
  };

  return {
    supabase,
    storageBucket,
    setProfileRole: (role: string) => {
      hasAuthoringAccess = role === "teacher";
    },
    setAdmin: (value: boolean) => {
      isAdmin = value;
    },
    setTopicStatus: (value: string) => {
      topicStatus = value;
    },
    setTopicRemovedAt: (value: string | null) => {
      topicRemovedAt = value;
    },
    setTopicGroupMember: (value: boolean) => {
      isTopicGroupMember = value;
    },
  };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mocks.supabase)),
}));

function uploadRequest(type: "image" | "audio", file: File, topicId = "topic-1") {
  const formData = new FormData();
  formData.append("topicId", topicId);
  formData.append("type", type);
  formData.append("file", file);

  return new Request("http://localhost/api/question-group-media/upload", {
    method: "POST",
    body: formData,
  });
}

describe("question group media upload route and cleanup action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setProfileRole("teacher");
    mocks.setAdmin(false);
    mocks.setTopicStatus("draft");
    mocks.setTopicRemovedAt(null);
    mocks.setTopicGroupMember(true);
    mocks.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "teacher-1" } },
      error: null,
    });
    mocks.storageBucket.upload.mockResolvedValue({ error: null });
    mocks.storageBucket.remove.mockResolvedValue({ error: null });
  });

  it("rejects unauthenticated uploads before Storage is called", async () => {
    mocks.supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("No user"),
    });

    const response = await POST(
      uploadRequest("image", new File([pngBytes], "question.png", { type: "image/png" })),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Phiên đăng nhập đã hết hạn");
    expect(mocks.storageBucket.upload).not.toHaveBeenCalled();
  });

  it("rejects users without course authoring access before Storage is called", async () => {
    mocks.setProfileRole("student");

    const response = await POST(
      uploadRequest("image", new File([pngBytes], "question.png", { type: "image/png" })),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("không có quyền tải lên media");
    expect(mocks.storageBucket.upload).not.toHaveBeenCalled();
  });

  it("allows a course author upload and uses the correct bucket with upsert disabled", async () => {
      const type = "image" as const;
      const originalName = "question.png";
      const mimeType = "image/png";
      const bytes = pngBytes;
      const expectedBucket = "question_group_images";
      mocks.setProfileRole("teacher");

      const response = await POST(
        uploadRequest(type, new File([bytes], originalName, { type: mimeType })),
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.bucket).toBe(expectedBucket);
      expect(body.path).toMatch(/^course-1\/topic-1\/teacher-1\/.+\.png$/);
      expect(body.path).not.toContain(originalName);
      expect(body.reference).toBe(`storage://${expectedBucket}/${body.path}`);
      expect(mocks.storageBucket.getPublicUrl).not.toHaveBeenCalled();
      expect(mocks.supabase.storage.from).toHaveBeenCalledWith(expectedBucket);
      expect(mocks.storageBucket.upload).toHaveBeenCalledWith(
        body.path,
        expect.any(File),
        { contentType: mimeType, upsert: false },
      );
  });

  it("rejects global admin without course membership before Storage is called", async () => {
    mocks.setProfileRole("admin");
    const response = await POST(
      uploadRequest("audio", new File([mp3Bytes], "listening.mp3", { type: "audio/mpeg" })),
    );
    expect(response.status).toBe(403);
    expect(mocks.storageBucket.upload).not.toHaveBeenCalled();
  });

  it("does not expose raw Storage errors from the upload route", async () => {
    mocks.storageBucket.upload.mockResolvedValueOnce({
      error: { message: 'new row violates row-level security policy for table "objects"' },
    });

    const response = await POST(
      uploadRequest("image", new File([pngBytes], "question.png", { type: "image/png" })),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Không thể tải file lên hệ thống. Vui lòng thử lại.");
    expect(body.error).not.toContain("row-level security");
  });

  it("rejects arbitrary cleanup bucket names", async () => {
    const result = await deleteQuestionGroupMedia("avatars", "teacher-1/file.png");

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("Bucket media không hợp lệ");
    expect(mocks.storageBucket.remove).not.toHaveBeenCalled();
  });

  it("rejects cleanup paths that cannot resolve to a server-generated media object", async () => {
    const result = await deleteQuestionGroupMedia(
      "question_group_images",
      "teacher-1/file.png",
    );

    expect("error" in result).toBe(true);
    expect(mocks.storageBucket.remove).not.toHaveBeenCalled();
  });

  it.each(["question_group_images", "question_group_audios"] as const)(
    "allows the uploader to cleanup %s for an active draft topic",
    async (bucket) => {
      const result = await deleteQuestionGroupMedia(
        bucket,
        "course-1/topic-1/teacher-1/file.png",
      );

      expect("success" in result).toBe(true);
      expect(mocks.supabase.storage.from).toHaveBeenCalledWith(bucket);
      expect(mocks.storageBucket.remove).toHaveBeenCalledWith([
        "course-1/topic-1/teacher-1/file.png",
      ]);
    },
  );

  it.each(["pending", "published"])(
    "rejects ordinary cleanup for a %s topic",
    async (status) => {
      mocks.setTopicStatus(status);

      const result = await deleteQuestionGroupMedia(
        "question_group_images",
        "course-1/topic-1/teacher-1/file.png",
      );

      expect("error" in result).toBe(true);
      expect(mocks.storageBucket.remove).not.toHaveBeenCalled();
    },
  );

  it("rejects ordinary cleanup after the topic is removed", async () => {
    mocks.setTopicRemovedAt("2026-09-16T00:00:00.000Z");

    const result = await deleteQuestionGroupMedia(
      "question_group_images",
      "course-1/topic-1/teacher-1/file.png",
    );

    expect("error" in result).toBe(true);
    expect(mocks.storageBucket.remove).not.toHaveBeenCalled();
  });

  it("rejects cleanup for an uploader outside the topic group", async () => {
    mocks.setTopicGroupMember(false);

    const result = await deleteQuestionGroupMedia(
      "question_group_images",
      "course-1/topic-1/teacher-1/file.png",
    );

    expect("error" in result).toBe(true);
    expect(mocks.storageBucket.remove).not.toHaveBeenCalled();
  });

  it("rejects cleanup for an object owned by another user", async () => {
    const result = await deleteQuestionGroupMedia(
      "question_group_images",
      "course-1/topic-1/another-user/file.png",
    );

    expect("error" in result).toBe(true);
    expect(mocks.storageBucket.remove).not.toHaveBeenCalled();
  });

  it("preserves admin moderation cleanup for a published topic", async () => {
    mocks.setAdmin(true);
    mocks.setTopicStatus("published");

    const result = await deleteQuestionGroupMedia(
      "question_group_images",
      "course-1/topic-1/teacher-1/file.png",
    );

    expect("success" in result).toBe(true);
    expect(mocks.storageBucket.remove).toHaveBeenCalledWith([
      "course-1/topic-1/teacher-1/file.png",
    ]);
  });
});
