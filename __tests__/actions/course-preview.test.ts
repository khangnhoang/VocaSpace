import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCourseTopicPreviewMarkers } from "@/app/actions/course-preview";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Test plan:
// - Mục tiêu: kiểm tra action marker xác thực input, gọi RPC và trả allocation mới sau quota/stale conflict.
// - Loại test: Server Action unit với Supabase mock.
// - Thành công: mutation gửi đúng course và danh sách marker; snapshot shape được xác thực trước khi trả.
// - Thất bại: input sai bị chặn trước DB; conflict trả lỗi thân thiện cùng allocation vừa đọc lại.
// - Bảo mật/phân quyền: Action không tự cấp quyền; RPC database vẫn là authority.
// - Invariant: client chỉ nhận allocation parse được, không nhận raw database error.

const mockedCreateClient = vi.mocked(createClient);
const courseId = "11111111-1111-4111-8111-111111111111";
const topicId = "22222222-2222-4222-8222-222222222222";
const allocation = {
  courseId,
  activeTopicCount: 5,
  markedTopicCount: 1,
  cap: 1,
  remaining: 0,
  excess: 0,
  isSuspended: false,
  causeVerified: null,
  cause: null,
  markedTopics: [],
};

function mockClient(rpc: ReturnType<typeof vi.fn>) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: topicId } } }),
    },
    rpc,
  };
}

describe("course Preview Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects duplicate selections before creating the Supabase client", async () => {
    const result = await setCourseTopicPreviewMarkers({
      courseId,
      markTopicIds: [topicId, topicId],
    });
    expect(result.error).toContain("trùng lặp");
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("refreshes and returns the current allocation after a stale quota conflict", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0001", message: "PREVIEW_QUOTA_RESOLUTION_REQUIRED" },
      })
      .mockResolvedValueOnce({ data: allocation, error: null });
    mockedCreateClient.mockResolvedValueOnce(mockClient(rpc) as never);

    const result = await setCourseTopicPreviewMarkers({
      courseId,
      unmarkTopicIds: [topicId],
    });

    expect(result).toEqual({
      error: "Phân bổ bài học xem thử đã thay đổi. Hãy tải lại số liệu và chọn lại bài học cần bỏ xem thử.",
      allocation,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "set_course_topic_preview_markers", {
      p_course_id: courseId,
      p_mark_topic_ids: [],
      p_unmark_topic_ids: [topicId],
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "get_course_preview_allocation", {
      p_course_id: courseId,
    });
  });

  it("revalidates Overview and Structure after a confirmed marker change", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: allocation, error: null });
    mockedCreateClient.mockResolvedValueOnce(mockClient(rpc) as never);

    const result = await setCourseTopicPreviewMarkers({ courseId, markTopicIds: [topicId] });

    expect(result).toEqual({ success: true, allocation });
    expect(revalidatePath).toHaveBeenCalledWith(`/teacher/courses/${courseId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/teacher/courses/${courseId}/structure`);
  });
});
