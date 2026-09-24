import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerPublicCoursePreviewQuestion,
  getPublicCoursePreview,
} from "@/app/actions/public-course-preview";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(),
}));

// Test plan:
// - Mục tiêu: kiểm tra public Preview Actions validate input, fail closed và chỉ trả DTO đã lọc.
// - Loại test: Server Action unit test với service RPC boundary giả lập.
// - Đối tượng: nội dung xem thử, media URL, kiểm tra đáp án và lỗi hợp đồng.
// - Thành công: nội dung công khai giữ thứ tự; managed group media chuyển qua Route Handler; đáp án trả riêng.
// - Thất bại: slug/UUID sai, RPC unavailable/error và DTO có answer key ban đầu bị từ chối.
// - Bảo mật: không đọc session/quyền client, không nhận mode hoặc learning-state fields.
// - Ổn định: lỗi RPC không trở thành empty content hoặc đáp án mặc định.
// - Invariant: Action chỉ gọi RPC đọc/đáp án C4, không gọi Persistent Learning Actions.
// - Kết quả verify gần nhất: chưa chạy.

const mockedCreateServiceRoleClient = vi.mocked(createServiceRoleClient);
const groupId = "44444444-4444-4444-8444-444444444444";
const questionId = "55555555-5555-4555-8555-555555555555";
const optionId = "66666666-6666-4666-8666-666666666666";
const topicId = "11111111-1111-4111-8111-111111111111";

function validPayload() {
  return {
    course: { slug: "public-course", title: "Public Course" },
    topic: { id: topicId, slug: "public-topic", title: "Public Topic", description: null },
    flashcards: [],
    exercises: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        title: "Practice",
        part_type: "part3",
        order_index: 0,
        questions: [],
        groups: [
          {
            id: groupId,
            passage_text: null,
            audio_url: "storage://question_group_audios/course/topic/teacher/file.mp3",
            image_url: "https://example.com/picture.png",
            order_index: 0,
            questions: [],
          },
        ],
      },
    ],
  };
}

function mockRpc(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  mockedCreateServiceRoleClient.mockReturnValue({ rpc } as never);
  return rpc;
}

describe("public course Preview Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects invalid slugs before constructing the service client", async () => {
    await expect(
      getPublicCoursePreview({ courseSlug: "../course", topicSlug: "public-topic" }),
    ).resolves.toEqual({ status: "unavailable" });
    expect(mockedCreateServiceRoleClient).not.toHaveBeenCalled();
  });

  it("maps persisted group media through the guarded route and keeps external media", async () => {
    const rpc = mockRpc(validPayload());
    const result = await getPublicCoursePreview({
      courseSlug: "public-course",
      topicSlug: "public-topic",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected public Preview success");
    expect(result.data.exercises[0].groups[0]).toMatchObject({
      audio_url: `/api/public-course-preview/media/${groupId}/audio`,
      image_url: "https://example.com/picture.png",
    });
    expect(rpc).toHaveBeenCalledWith("get_public_course_preview", {
      p_course_slug: "public-course",
      p_topic_slug: "public-topic",
    });
    expect(JSON.stringify(result.data)).not.toContain("storage://");
  });

  it("keeps unavailable targets uniform and reports RPC failures instead of empty data", async () => {
    mockRpc(null);
    await expect(
      getPublicCoursePreview({ courseSlug: "public-course", topicSlug: "public-topic" }),
    ).resolves.toEqual({ status: "unavailable" });

    mockRpc(null, { message: "database" });
    await expect(
      getPublicCoursePreview({ courseSlug: "public-course", topicSlug: "public-topic" }),
    ).resolves.toMatchObject({ status: "error" });
  });

  it("omits malformed external media URLs and media with credentials", async () => {
    const payload = validPayload();
    payload.exercises[0].groups[0].image_url = "javascript:alert(1)";
    payload.exercises[0].groups[0].audio_url = "javascript:alert(2)";
    const card = {
      id: "77777777-7777-4777-8777-777777777777",
      front_content: { word: "word" },
      back_content: { translation: "meaning" },
      audio_url: null,
      image_url: "https://name:secret@example.com/image.png",
      order_index: 0,
    };
    Object.assign(payload, { flashcards: [card] });
    mockRpc(payload);

    const result = await getPublicCoursePreview({
      courseSlug: "public-course",
      topicSlug: "public-topic",
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected public Preview success");
    expect(result.data.exercises[0].groups[0].image_url).toBeNull();
    expect(result.data.flashcards[0].image_url).toBeNull();
  });

  it("withholds card media stored in Supabase without a Preview-scoped route", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const payload = validPayload();
    const card = {
      id: "77777777-7777-4777-8777-777777777777",
      front_content: { word: "word" },
      back_content: { translation: "meaning" },
      audio_url: null,
      image_url:
        "https://project.supabase.co/storage/v1/object/sign/card-media/private.png?token=secret",
      order_index: 0,
    };
    Object.assign(payload, { flashcards: [card] });
    mockRpc(payload);

    const result = await getPublicCoursePreview({
      courseSlug: "public-course",
      topicSlug: "public-topic",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected public Preview success");
    expect(result.data.flashcards[0].image_url).toBeNull();
    expect(JSON.stringify(result.data)).not.toContain("token=secret");
  });

  it("fails closed when an initial payload contains a correct-answer field", async () => {
    const payload = validPayload();
    payload.exercises[0].groups[0].questions = [
      {
        id: questionId,
        content: "Question?",
        order_index: 0,
        options: [
          { id: optionId, content: "A", label: "A", order_index: 0, is_correct: true },
        ],
      },
    ] as never;
    mockRpc(payload);

    await expect(
      getPublicCoursePreview({ courseSlug: "public-course", topicSlug: "public-topic" }),
    ).resolves.toMatchObject({ status: "error" });
  });

  it("returns only the stateless answer result for a validated selection", async () => {
    const rpc = mockRpc({ is_correct: true, explanation: "Because it matches." });
    await expect(
      answerPublicCoursePreviewQuestion({
        courseSlug: "public-course",
        topicSlug: "public-topic",
        questionId,
        selectedOptionId: optionId,
      }),
    ).resolves.toEqual({
      status: "success",
      data: { isCorrect: true, explanation: "Because it matches." },
    });
    expect(rpc).toHaveBeenCalledWith("get_public_course_preview_answer", {
      p_course_slug: "public-course",
      p_topic_slug: "public-topic",
      p_question_id: questionId,
      p_option_id: optionId,
    });
  });

  it("returns unavailable for invalid or ineligible answer targets", async () => {
    const rpc = mockRpc(null);
    await expect(
      answerPublicCoursePreviewQuestion({
        courseSlug: "public-course",
        topicSlug: "public-topic",
        questionId,
        selectedOptionId: optionId,
      }),
    ).resolves.toEqual({ status: "unavailable" });
    expect(rpc).toHaveBeenCalledOnce();
  });
});
