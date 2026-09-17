import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveTopicReview,
  moderatePlatformContent,
  rejectTopicReview,
  requestTopicReview,
} from "@/app/actions/topic-review";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Test plan:
// - Mục tiêu: kiểm tra Server Actions topic review chỉ validate input, gọi đúng trusted RPC và map lỗi an toàn.
// - Loại test: action/unit.
// - Đối tượng: request/approve/reject topic review và platform moderation actions.
// - Case thành công: request và moderation truyền đúng payload; kết quả thành công revalidate đúng course paths.
// - Case thất bại: input sai, chưa đăng nhập và lỗi self-review được trả về trước/qua RPC tương ứng.
// - Bảo mật/phân quyền: action không tự cấp review/moderation permission; quyền được ủy quyền cho trusted RPC.
// - Ổn định/resilience: lỗi RPC không lộ raw database message.
// - Invariant cần giữ: status, reviewer identity và audit metadata không phải input CRUD của client.
// - Kết quả verify gần nhất: passed trong focused action/schema/unit closure của P1.
// - Ghi chú: test này không thay thế real local Supabase integration tests.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const courseId = "11111111-1111-4111-8111-111111111111";
const topicId = "22222222-2222-4222-8222-222222222222";
const submissionId = "33333333-3333-4333-8333-333333333333";

function installClient(options: {
  user?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options.data ?? { course_id: courseId, topic_id: topicId },
    error: options.error ?? null,
  });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === false ? null : { id: "user-1" } },
      }),
    },
    rpc,
  };

  mockedCreateClient.mockResolvedValueOnce(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return rpc;
}

describe("topic review Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates request input before creating a client", async () => {
    const result = await requestTopicReview({ topicId: "not-a-uuid" });

    expect(result.error).toBeTruthy();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("delegates request review and revalidates affected course paths", async () => {
    const rpc = installClient({
      data: { status: "pending", course_id: courseId, topic_id: topicId },
    });

    const result = await requestTopicReview({ topicId });

    expect(result).toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledWith("request_topic_review", { p_topic_id: topicId });
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/teacher/courses/${courseId}`);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/teacher/courses/${courseId}/structure`);
  });

  it("maps trusted review errors without exposing raw database text", async () => {
    installClient({ error: { message: "TOPIC_REVIEW_SELF_REVIEW: internal detail" } });

    const result = await approveTopicReview({ submissionId });

    expect(result).toEqual({ error: "Bạn không thể tự duyệt yêu cầu của chính mình." });
    expect(JSON.stringify(result)).not.toContain("internal detail");
  });

  it("passes reject input to its dedicated RPC without a rejection budget in the result", async () => {
    const rejectRpc = installClient({ data: { status: "draft", course_id: courseId } });
    const rejected = await rejectTopicReview({
      submissionId,
      reason: "Thiếu giải thích cho đáp án.",
    });
    expect(rejected).toMatchObject({ success: true });
    expect(rejectRpc).toHaveBeenCalledWith("reject_topic_review", {
      p_submission_id: submissionId,
      p_reason: "Thiếu giải thích cho đáp án.",
    });
    // Reject chỉ trả về draft: không còn `rejection_count` hay `escalated`.
    expect(JSON.stringify(rejected)).not.toContain("rejection_count");
    expect(JSON.stringify(rejected)).not.toContain("escalated");
  });

  it("keeps moderation as a separate trusted RPC", async () => {
    const rpc = installClient({ data: { status: "draft", course_id: courseId } });

    const result = await moderatePlatformContent({
      targetType: "topic",
      targetId: topicId,
      action: "invalidate_review",
      reason: "Nội dung không đạt policy.",
    });

    expect(result).toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledWith("moderate_platform_content", {
      p_target_type: "topic",
      p_target_id: topicId,
      p_action: "invalidate_review",
      p_reason: "Nội dung không đạt policy.",
    });
  });

  it("rejects unauthenticated calls before RPC", async () => {
    const rpc = installClient({ user: false });

    const result = await rejectTopicReview({
      submissionId,
      reason: "Không tiếp tục nội dung này.",
    });

    expect(result).toEqual({ error: "Vui lòng đăng nhập lại." });
    expect(rpc).not.toHaveBeenCalled();
  });
});
