import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  removeCourseCollaborator,
  setCourseCollaboratorReviewCapability,
  updateCourseCollaboratorRole,
} from "@/app/actions/course-collaborator";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: kiểm tra collaborator actions chỉ đi qua capability/role/removal RPC được ủy quyền.
// - Loại test: action/unit.
// - Đối tượng: setCourseCollaboratorReviewCapability, updateCourseCollaboratorRole, removeCourseCollaborator.
// - Case thành công: payload capability, role và removal được chuyển nguyên vẹn tới RPC tương ứng.
// - Case thất bại: input sai, chưa đăng nhập và last-reviewer error được map an toàn.
// - Bảo mật/phân quyền: action không tự sửa membership; owner/co-owner authorization nằm ở trusted RPC.
// - Ổn định/resilience: raw database error không được trả nguyên văn.
// - Invariant cần giữ: reviewer capability là flag course-scoped; removal/role safety không bị bypass bởi action.
// - Kết quả verify gần nhất: passed trong focused action/schema/unit closure của P1.
// - Ghi chú: real RLS/RPC matrix nằm trong integration tests.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

const collaboratorId = "11111111-1111-4111-8111-111111111111";

function installClient(options: {
  user?: boolean;
  data?: unknown;
  error?: { message?: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options.data ?? { status: "updated" },
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

describe("course collaborator Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates capability changes to the trusted RPC", async () => {
    const rpc = installClient({ data: { status: "updated", can_review_topics: true } });

    const result = await setCourseCollaboratorReviewCapability({
      collaboratorId,
      canReviewTopics: true,
    });

    expect(result).toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledWith("set_course_collaborator_review_capability", {
      p_collaborator_id: collaboratorId,
      p_can_review_topics: true,
    });
  });

  it("delegates role changes and removal without inventing client-side authority", async () => {
    const roleRpc = installClient({ data: { status: "updated", role: "previewer" } });
    const roleResult = await updateCourseCollaboratorRole({
      collaboratorId,
      role: "previewer",
    });
    expect(roleResult).toMatchObject({ success: true });
    expect(roleRpc).toHaveBeenCalledWith("update_course_collaborator_role", {
      p_collaborator_id: collaboratorId,
      p_role: "previewer",
    });

    const removeRpc = installClient({ data: { status: "removed" } });
    const removeResult = await removeCourseCollaborator({ collaboratorId });
    expect(removeResult).toMatchObject({ success: true });
    expect(removeRpc).toHaveBeenCalledWith("remove_course_collaborator", {
      p_collaborator_id: collaboratorId,
    });
  });

  it("maps last-reviewer failures and rejects unauthenticated calls", async () => {
    installClient({ error: { message: "COLLABORATOR_LAST_REVIEWER_REQUIRED: raw detail" } });
    const failed = await setCourseCollaboratorReviewCapability({
      collaboratorId,
      canReviewTopics: false,
    });
    expect(failed).toEqual({
      error: "Không thể thay đổi vì sẽ mất reviewer hợp lệ cuối cùng của yêu cầu đang chờ.",
    });
    expect(JSON.stringify(failed)).not.toContain("raw detail");

    const rpc = installClient({ user: false });
    const unauthenticated = await removeCourseCollaborator({ collaboratorId });
    expect(unauthenticated).toEqual({ error: "Vui lòng đăng nhập lại." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates collaborator ids before creating a client", async () => {
    const result = await removeCourseCollaborator({ collaboratorId: "bad-id" });

    expect(result.error).toBeTruthy();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
