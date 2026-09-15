import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";
const OWNER = { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" } as const;
const ADMIN = { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" } as const;

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const courseIds = new Set<string>();
const temporaryUserIds = new Set<string>();

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  if (!SUPABASE_URL.startsWith("http://127.0.0.1:45321")) {
    throw new Error(`Refusing non-local Supabase URL: ${SUPABASE_URL}`);
  }
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return client;
}

async function createTemporaryUser() {
  const email = `d1-invite-${randomUUID()}@example.com`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`Temporary user failed: ${error?.message}`);
  temporaryUserIds.add(data.user.id);
  return { email, id: data.user.id, client: await signIn(email) };
}

async function createCourse() {
  const { data, error } = await service.from("courses").insert({
    title: `D1 invitation course ${randomUUID()}`,
    slug: `d1-invitation-${randomUUID()}`,
    description: "D1 collaborator invitation integration fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  if (error || !data) throw new Error(`Course fixture failed: ${error?.message}`);
  courseIds.add(data.id);
  if ((await service.from("course_collaborators").insert({
    course_id: data.id,
    user_id: OWNER.id,
    role: "owner",
    added_by: OWNER.id,
    can_review_topics: false,
  })).error) throw new Error("Owner fixture failed");
  return data.id as string;
}

async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length > 0) await service.from("courses").delete().in("id", ids);
  const users = [...temporaryUserIds];
  temporaryUserIds.clear();
  for (const userId of users) await service.auth.admin.deleteUser(userId);
}

function expectRpcError(result: { error: { message?: string } | null }, code: string) {
  expect(result.error).not.toBeNull();
  expect(result.error?.message).toContain(code);
}

describe.sequential("D1 collaborator invitations", () => {
  beforeAll(assertSafeEnvironment);
  afterEach(cleanup);

  it("persists invitations, materializes accepted membership, and keeps terminal re-invite history", async () => {
    const courseId = await createCourse();
    const owner = await signIn(OWNER.email);
    const invitee = await createTemporaryUser();

    const sent = await owner.rpc("send_course_collaborator_invitation", {
      p_course_id: courseId,
      p_email: invitee.email,
      p_role: "editor",
      p_can_review_topics: true,
    });
    expect(sent.error).toBeNull();
    const invitationId = (sent.data as { invitation_id: string }).invitation_id;

    const directInsert = await invitee.client.from("course_collaborator_invitations").insert({
      course_id: courseId,
      invited_by_user_id: OWNER.id,
      invitee_user_id: invitee.id,
      role: "previewer",
    });
    expect(directInsert.error).not.toBeNull();

    const accepted = await invitee.client.rpc("accept_course_collaborator_invitation", {
      p_invitation_id: invitationId,
    });
    expect(accepted.error).toBeNull();
    expect((await service.from("course_collaborators").select("role, can_review_topics").match({ course_id: courseId, user_id: invitee.id }).single()).data)
      .toMatchObject({ role: "editor", can_review_topics: true });

    const rejectedInvitee = await createTemporaryUser();
    const rejected = await owner.rpc("send_course_collaborator_invitation", {
      p_course_id: courseId, p_email: rejectedInvitee.email, p_role: "previewer", p_can_review_topics: false,
    });
    expect(rejected.error).toBeNull();
    const rejectedId = (rejected.data as { invitation_id: string }).invitation_id;
    expect((await rejectedInvitee.client.rpc("reject_course_collaborator_invitation", { p_invitation_id: rejectedId })).error).toBeNull();
    const reinvited = await owner.rpc("send_course_collaborator_invitation", {
      p_course_id: courseId, p_email: rejectedInvitee.email, p_role: "previewer", p_can_review_topics: false,
    });
    expect(reinvited.error).toBeNull();
    expect((reinvited.data as { invitation_id: string }).invitation_id).not.toBe(rejectedId);
  });

  it("uses pending invitations as role-scoped reservations under the cap", async () => {
    const courseId = await createCourse();
    const owner = await signIn(OWNER.email);
    const first = await createTemporaryUser();
    const second = await createTemporaryUser();
    const third = await createTemporaryUser();

    for (const invitee of [first, second]) {
      const result = await owner.rpc("send_course_collaborator_invitation", {
        p_course_id: courseId, p_email: invitee.email, p_role: "co_owner", p_can_review_topics: false,
      });
      expect(result.error).toBeNull();
    }
    expectRpcError(await owner.rpc("send_course_collaborator_invitation", {
      p_course_id: courseId, p_email: third.email, p_role: "co_owner", p_can_review_topics: false,
    }), "INVITATION_CAPACITY_REACHED");

    const pending = await service.from("course_collaborator_invitations").select("id, invitee_user_id").eq("course_id", courseId).eq("status", "pending");
    expect(pending.error).toBeNull();
    expect(pending.data).toHaveLength(2);
    for (const invitation of pending.data ?? []) {
      const invitee = invitation.invitee_user_id === first.id ? first : second;
      expect((await invitee.client.rpc("accept_course_collaborator_invitation", { p_invitation_id: invitation.id })).error).toBeNull();
    }
  });

  it("lets a global admin accept local membership without granting review by global role", async () => {
    const courseId = await createCourse();
    const owner = await signIn(OWNER.email);
    const globalAdmin = await signIn(ADMIN.email);
    const sent = await owner.rpc("send_course_collaborator_invitation", {
      p_course_id: courseId, p_email: ADMIN.email, p_role: "previewer", p_can_review_topics: true,
    });
    expect(sent.error).toBeNull();
    const invitationId = (sent.data as { invitation_id: string }).invitation_id;
    expect((await globalAdmin.rpc("accept_course_collaborator_invitation", { p_invitation_id: invitationId })).error).toBeNull();
    expect((await service.from("course_collaborators").select("role, can_review_topics").match({ course_id: courseId, user_id: ADMIN.id }).single()).data)
      .toMatchObject({ role: "previewer", can_review_topics: true });
  });
});
