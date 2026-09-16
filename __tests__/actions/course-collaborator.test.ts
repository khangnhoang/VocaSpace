import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCourseCollaboratorMembers,
  getCourseCollaboratorOverview,
  getCourseCollaboratorResponsibilityCandidates,
  getMyPendingCourseCollaboratorInvitations,
  removeCourseCollaborator,
  removeCourseCollaboratorWithResponsibility,
  leaveCourseCollaboration,
  setCourseCollaboratorReviewCapability,
  updateCourseCollaboratorRole,
  updateCourseCollaboratorRoleWithResponsibility,
} from "@/app/actions/course-collaborator";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: kiểm tra collaborator actions chỉ đi qua capability/role/removal RPC được ủy quyền.
// - Loại test: action/unit.
// - Đối tượng: collaborator overview/member reads, invitation reads, capability/role/removal/leave actions.
// - Case thành công: payload capability, responsibility recipient và removal/leave được chuyển nguyên vẹn tới RPC tương ứng; member read trả candidate và responsibility count.
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
const courseId = "22222222-2222-4222-8222-222222222222";
const memberUserId = "33333333-3333-4333-8333-333333333333";

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

  it("returns a validated membership overview only to an owner or co-owner", async () => {
    const actorQuery = {
      select: vi.fn(() => actorQuery),
      eq: vi.fn(() => actorQuery),
      single: vi.fn().mockResolvedValue({ data: { role: "owner" }, error: null }),
    };
    const listQuery = {
      select: vi.fn(() => listQuery),
      eq: vi.fn(() => listQuery),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: collaboratorId,
            user_id: memberUserId,
            role: "previewer",
            can_review_topics: true,
            profiles: { id: memberUserId, email: "reviewer@example.com", full_name: "Reviewer", avatar_url: null },
          },
        ],
        error: null,
      }),
    };
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn()
        .mockReturnValueOnce(actorQuery)
        .mockReturnValueOnce(listQuery),
    };
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    expect(await getCourseCollaboratorOverview({ courseId })).toEqual({
      data: [
        {
          id: collaboratorId,
          userId: memberUserId,
          role: "previewer",
          canReviewTopics: true,
          email: "reviewer@example.com",
          fullName: "Reviewer",
          avatarUrl: null,
        },
      ],
    });
    expect(listQuery.select).toHaveBeenCalledWith(
      "id, user_id, role, can_review_topics, profiles!inner(id, email, full_name, avatar_url)",
    );
  });

  it("reads transfer candidates and the current user's unapproved responsibility count", async () => {
    const currentUserId = "33333333-3333-4333-8333-333333333333";
    const actorQuery = {
      select: vi.fn(() => actorQuery),
      eq: vi.fn(() => actorQuery),
      single: vi.fn().mockResolvedValue({ data: { role: "editor" }, error: null }),
    };
    const listQuery = {
      select: vi.fn(() => listQuery),
      eq: vi.fn(() => listQuery),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: collaboratorId,
          user_id: currentUserId,
          role: "editor",
          can_review_topics: true,
          profiles: { id: currentUserId, email: "editor@example.com", full_name: "Editor", avatar_url: null },
        }],
        error: null,
      }),
    };
    const topicQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    topicQuery.select.mockReturnValue(topicQuery);
    topicQuery.eq.mockReturnValue(topicQuery);
    topicQuery.is
      .mockImplementationOnce(() => topicQuery)
      .mockImplementationOnce(() => Promise.resolve({ count: 2, error: null }));
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: currentUserId } } }),
      },
      from: vi.fn()
        .mockReturnValueOnce(actorQuery)
        .mockReturnValueOnce(listQuery)
        .mockReturnValueOnce(topicQuery),
    };
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    await expect(getCourseCollaboratorMembers({ courseId })).resolves.toEqual({
      data: {
        currentUserId,
        members: [{
          id: collaboratorId,
          userId: currentUserId,
          role: "editor",
          canReviewTopics: true,
          email: "editor@example.com",
          fullName: "Editor",
          avatarUrl: null,
        }],
        responsibleTopicCount: 2,
      },
    });
    expect(topicQuery.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  });

  it("returns only recipients valid for every unapproved topic", async () => {
    const actorId = "44444444-4444-4444-8444-444444444444";
    const targetId = "55555555-5555-4555-8555-555555555555";
    const contributorId = "66666666-6666-4666-8666-666666666666";
    const unrelatedId = "77777777-7777-4777-8777-777777777777";
    const topicOneId = "88888888-8888-4888-8888-888888888888";
    const topicTwoId = "99999999-9999-4999-8999-999999999999";

    const targetQuery = {
      select: vi.fn(() => targetQuery),
      eq: vi.fn(() => targetQuery),
      single: vi.fn().mockResolvedValue({ data: { course_id: courseId, user_id: targetId }, error: null }),
    };
    const actorQuery = {
      select: vi.fn(() => actorQuery),
      eq: vi.fn(() => actorQuery),
      single: vi.fn().mockResolvedValue({ data: { role: "owner" }, error: null }),
    };
    const topicQuery = {
      select: vi.fn(() => topicQuery),
      eq: vi.fn(() => topicQuery),
      is: vi.fn().mockResolvedValue({ data: [{ id: topicOneId }, { id: topicTwoId }], error: null }),
    };
    const collaboratorQuery = {
      select: vi.fn(() => collaboratorQuery),
      eq: vi.fn().mockResolvedValue({
        data: [
          { user_id: actorId, role: "owner" },
          { user_id: targetId, role: "editor" },
          { user_id: contributorId, role: "editor" },
          { user_id: unrelatedId, role: "co_owner" },
        ],
        error: null,
      }),
    };
    const contributorQuery = {
      select: vi.fn(() => contributorQuery),
      in: vi.fn(() => contributorQuery),
      is: vi.fn().mockResolvedValue({
        data: [
          { topic_id: topicOneId, user_id: contributorId },
          { topic_id: topicTwoId, user_id: unrelatedId },
        ],
        error: null,
      }),
    };
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: actorId } } }),
      },
      from: vi.fn()
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(actorQuery)
        .mockReturnValueOnce(topicQuery)
        .mockReturnValueOnce(collaboratorQuery)
        .mockReturnValueOnce(contributorQuery),
    };
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    await expect(getCourseCollaboratorResponsibilityCandidates({ collaboratorId })).resolves.toEqual({
      data: {
        collaboratorId,
        responsibleTopicCount: 2,
        recipientUserIds: [actorId],
      },
    });
    expect(contributorQuery.in).toHaveBeenCalledWith("topic_id", [topicOneId, topicTwoId]);
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

  it("delegates membership mutations with responsibility recipients to trusted RPCs", async () => {
    const roleRpc = installClient({ data: { status: "updated", role: "previewer" } });
    await expect(updateCourseCollaboratorRoleWithResponsibility({
      collaboratorId,
      role: "previewer",
      recipientUserId: memberUserId,
    })).resolves.toMatchObject({ success: true });
    expect(roleRpc).toHaveBeenCalledWith("update_course_collaborator_role_with_responsibility", {
      p_collaborator_id: collaboratorId,
      p_role: "previewer",
      p_recipient_user_id: memberUserId,
    });

    const removeRpc = installClient({ data: { status: "removed" } });
    await expect(removeCourseCollaboratorWithResponsibility({
      collaboratorId,
      recipientUserId: memberUserId,
    })).resolves.toMatchObject({ success: true });
    expect(removeRpc).toHaveBeenCalledWith("remove_course_collaborator_with_responsibility", {
      p_collaborator_id: collaboratorId,
      p_recipient_user_id: memberUserId,
    });

    const leaveRpc = installClient({ data: { status: "left" } });
    await expect(leaveCourseCollaboration({ courseId, recipientUserId: memberUserId })).resolves.toMatchObject({ success: true });
    expect(leaveRpc).toHaveBeenCalledWith("leave_course_collaboration", {
      p_course_id: courseId,
      p_recipient_user_id: memberUserId,
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

  it("maps role-capacity failures without exposing the database error", async () => {
    const rpc = installClient({ error: { message: "COLLABORATOR_ROLE_CAPACITY_REACHED: raw detail" } });

    const result = await updateCourseCollaboratorRole({
      collaboratorId,
      role: "editor",
    });

    expect(result).toEqual({ error: "Đã đạt giới hạn cộng tác viên cho vai trò này." });
    expect(rpc).toHaveBeenCalledWith("update_course_collaborator_role", {
      p_collaborator_id: collaboratorId,
      p_role: "editor",
    });
    expect(JSON.stringify(result)).not.toContain("raw detail");
  });

  it("maps pending invitations from the trusted course-identity RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          course_id: courseId,
          course_title: "TOEIC Basics",
          course_slug: "toeic-basics",
          invitee_user_id: memberUserId,
          role: "editor",
          can_review_topics: true,
          status: "pending",
          created_at: "2026-09-16T00:00:00.000Z",
          actioned_at: null,
        },
      ],
      error: null,
    });
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: memberUserId } } }),
      },
      rpc,
    };
    mockedCreateClient.mockResolvedValueOnce(
      client as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    await expect(getMyPendingCourseCollaboratorInvitations()).resolves.toEqual({
      data: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          courseId,
          courseTitle: "TOEIC Basics",
          courseSlug: "toeic-basics",
          inviteeUserId: memberUserId,
          role: "editor",
          canReviewTopics: true,
          status: "pending",
          createdAt: "2026-09-16T00:00:00.000Z",
          actionedAt: null,
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("get_my_pending_course_collaborator_invitations");
  });

  it("validates collaborator ids before creating a client", async () => {
    const result = await removeCourseCollaborator({ collaboratorId: "bad-id" });

    expect(result.error).toBeTruthy();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
