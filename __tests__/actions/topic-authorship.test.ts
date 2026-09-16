import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addTopicContributor,
  removeTopicContributor,
  transferTopicResponsibility,
} from "@/app/actions/topic-authorship";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: kiểm tra topic-authorship actions chỉ parse input và chuyển mutation tới trusted RPC.
// - Loại test: action/unit; real RLS/RPC boundary nằm ở topic-authorship-boundary integration test.
// - Case thành công: add, remove và transfer giữ nguyên identifiers đã validate.
// - Case thất bại: input sai, chưa đăng nhập và lỗi boundary được map thành thông báo an toàn.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const topicId = "11111111-1111-4111-8111-111111111111";
const contributorId = "22222222-2222-4222-8222-222222222222";
const recipientId = "33333333-3333-4333-8333-333333333333";

function installClient(options: { user?: boolean; data?: unknown; error?: { message?: string } | null } = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options.data ?? { status: "updated", course_id: "44444444-4444-4444-8444-444444444444" },
    error: options.error ?? null,
  });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: options.user === false ? null : { id: recipientId } } }),
    },
    rpc,
  };
  mockedCreateClient.mockResolvedValueOnce(client as unknown as Awaited<ReturnType<typeof createClient>>);
  return rpc;
}

describe("topic authorship Server Actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates validated group mutations to trusted RPCs", async () => {
    const addRpc = installClient({ data: { status: "added", course_id: "44444444-4444-4444-8444-444444444444" } });
    await expect(addTopicContributor({ topicId, userId: recipientId })).resolves.toMatchObject({ success: true });
    expect(addRpc).toHaveBeenCalledWith("add_topic_contributor", { p_topic_id: topicId, p_user_id: recipientId });

    const removeRpc = installClient({ data: { status: "removed", course_id: "44444444-4444-4444-8444-444444444444" } });
    await expect(removeTopicContributor({ contributorId })).resolves.toMatchObject({ success: true });
    expect(removeRpc).toHaveBeenCalledWith("remove_topic_contributor", { p_contributor_id: contributorId });

    const transferRpc = installClient({ data: { status: "transferred", course_id: "44444444-4444-4444-8444-444444444444" } });
    await expect(transferTopicResponsibility({ topicId, recipientUserId: recipientId })).resolves.toMatchObject({ success: true });
    expect(transferRpc).toHaveBeenCalledWith("transfer_topic_responsibility", {
      p_topic_id: topicId,
      p_recipient_user_id: recipientId,
    });
  });

  it("maps boundary errors and rejects invalid or unauthenticated calls", async () => {
    installClient({ error: { message: "TOPIC_RESPONSIBILITY_RECIPIENT_INVALID: raw detail" } });
    await expect(transferTopicResponsibility({ topicId, recipientUserId: recipientId })).resolves.toEqual({
      error: "Người nhận trách nhiệm không hợp lệ cho topic này.",
    });

    const unauthenticatedRpc = installClient({ user: false });
    await expect(addTopicContributor({ topicId, userId: recipientId })).resolves.toEqual({ error: "Vui lòng đăng nhập lại." });
    expect(unauthenticatedRpc).not.toHaveBeenCalled();

    const invalid = await removeTopicContributor({ contributorId: "bad-id" });
    expect(invalid.error).toBeTruthy();
    expect(mockedCreateClient).toHaveBeenCalledTimes(2);
  });
});
