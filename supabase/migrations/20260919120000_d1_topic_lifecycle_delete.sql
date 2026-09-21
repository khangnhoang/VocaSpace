-- D1 v4 P13: unified topic lifecycle delete/restore.
--
-- `d1_delete_topic` used to borrow the content-editing boundary
-- (`d1_prepare_topic_content_mutation`), which made delete authority a
-- side effect of the authoring group and left `pending` topics undeletable for
-- every actor. D33 gives delete its own primitive and its own authority, and
-- makes the `pending` branch cancel-then-delete atomically.

-- 1. Lifecycle lock primitive for delete/restore (D33/D36). Lock order is
--    course -> topic, matching approve_topic_review, reject_topic_review and
--    d1_prepare_topic_content_mutation. Wrong order deadlocks; the
--    d1_guard_topic_lifecycle_mutation trigger takes the same pair, which is
--    safe because pg_advisory_xact_lock is re-entrant inside one transaction.
--    Note: the plan's §5.6 wrote `returns public.topics%rowtype`, which is not
--    valid SQL in a RETURNS clause (`%rowtype` is only a PL/pgSQL declaration
--    form). `returns public.topics` is the equivalent composite type and is
--    what the callers need; the DECLARE below legitimately keeps `%rowtype`.
create or replace function public.d1_lock_topic_lifecycle(p_topic_id uuid)
returns public.topics
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
  v_course_id uuid;
begin
  select t.course_id into v_course_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));
  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  return v_topic;
end;
$$;

-- D39: every caller is a security definer boundary. This one is never granted
-- to `authenticated` — it returns a whole topics row, including columns RLS
-- hides.
revoke all on function public.d1_lock_topic_lifecycle(uuid) from public, anon, authenticated;
grant execute on function public.d1_lock_topic_lifecycle(uuid) to service_role;

-- 2. One destructive capability for draft, pending and published (D33). The
--    signature is unchanged, so app/actions/topic.ts needs no edit here.
create or replace function public.d1_delete_topic(
  p_topic_id uuid,
  p_confirm_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_topic := public.d1_lock_topic_lifecycle(p_topic_id);

  -- D35: the invariant d1_prepare_topic_content_mutation used to carry.
  if v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;

  -- D27/D33: delete authority is its own predicate, not the authoring group.
  if not public.d1_can_delete_topic(p_topic_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;

  -- D33/D38: cancel before deleting, in the same transaction. Leaving a
  -- pending submission behind would block every later submission for this
  -- topic through topic_review_submissions_one_pending_idx once restored.
  -- This call is also what sets voca.d1_trusted_topic_lifecycle, which the
  -- final update needs to pass d1_guard_topic_lifecycle_mutation on a pending
  -- topic. Do not reorder, drop or hand-roll this step.
  if v_topic.status = 'pending' then
    perform public.d1_cancel_pending_reviews_for_topics(
      array[p_topic_id],
      auth.uid(),
      'Hủy yêu cầu duyệt để xóa bài học.'
    );
  end if;

  if v_topic.status = 'published' and not coalesce(p_confirm_published, false) then
    raise exception 'TOPIC_PUBLISHED_CONFIRM_REQUIRED';
  end if;

  update public.topics
  set status = 'draft', removed_at = timezone('utc', now())
  where id = p_topic_id;
  return jsonb_build_object('status', 'removed', 'course_id', v_topic.course_id, 'topic_id', p_topic_id);
end;
$$;

revoke all on function public.d1_delete_topic(uuid, boolean) from public, anon;
grant execute on function public.d1_delete_topic(uuid, boolean) to authenticated, service_role;

-- 3. Withdrawing a pending review is its own action, limited to the creator
--    and the current responsible author (D34). The membership half reuses
--    d1_topic_group_member instead of adding a second predicate for the same
--    question (P3): a creator removed from the course fails here.
create or replace function public.withdraw_review_to_draft(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_topic := public.d1_lock_topic_lifecycle(p_topic_id);

  if v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;
  if not (
    public.d1_topic_group_member(p_topic_id)
    and auth.uid() in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id)
  ) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_topic.status <> 'pending' then raise exception 'TOPIC_NOT_PENDING'; end if;

  perform public.d1_cancel_pending_reviews_for_topics(
    array[p_topic_id],
    auth.uid(),
    'Tác giả hủy yêu cầu duyệt để tiếp tục chỉnh sửa.'
  );
  return jsonb_build_object('status', 'withdrawn', 'course_id', v_topic.course_id, 'topic_id', p_topic_id);
end;
$$;

revoke all on function public.withdraw_review_to_draft(uuid) from public, anon;
grant execute on function public.withdraw_review_to_draft(uuid) to authenticated, service_role;

-- 4. Course Structure rows carry three independent capabilities instead of one
--    overloaded boolean (D31, A21). New name because create or replace cannot
--    change a return type; the old function is dropped once its consumer has
--    moved (P14/P15), so no two authority surfaces exist side by side.
create or replace function public.d1_topic_structure_capabilities(p_topic_ids uuid[])
returns table(topic_id uuid, can_edit_content boolean, can_manage_structure boolean, can_delete_topic boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    public.d1_topic_group_member(t.id),
    public.d1_is_active_course_author(t.course_id, auth.uid()),
    public.d1_can_delete_topic(t.id)
  from public.topics t
  join public.chapters ch on ch.id = t.chapter_id
  where t.id = any(p_topic_ids)
    and t.removed_at is null
    and ch.removed_at is null
    and public.has_course_topic_read_access(t.course_id)
$$;

-- The one helper in v4 that must be granted to `authenticated` (D39): the
-- client calls it directly via supabase.rpc("d1_topic_structure_capabilities").
revoke all on function public.d1_topic_structure_capabilities(uuid[]) from public, anon;
grant execute on function public.d1_topic_structure_capabilities(uuid[]) to authenticated, service_role;

-- 5. Read model gains the two pending-action capabilities (D30) and widens
--    canRequestReview to the creator (D22). `canEdit` keeps its name and now
--    means canEditContent only. Only the marked parts differ from the live
--    body in 20260917110000.
create or replace function public.get_topic_workflow_state(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_topic public.topics%rowtype;
  v_role public.course_member_role;
  v_can_edit boolean := false;
  v_can_review boolean := false;
  v_can_delete boolean := false;
  v_can_withdraw boolean := false;
  v_card_count integer := 0;
  v_exercise_count integer := 0;
  v_pending public.topic_review_submissions%rowtype;
  v_rejection_history jsonb := '[]'::jsonb;
  v_has_distinct_reviewer boolean := false;
  v_original_creator jsonb;
  v_responsible_author jsonb;
  v_contributors jsonb := '[]'::jsonb;
  v_latest_authorship_feedback jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select t.* into v_topic
  from public.topics t
  join public.chapters ch on ch.id = t.chapter_id
  join public.courses c on c.id = t.course_id
  where t.id = p_topic_id
    and t.removed_at is null
    and ch.removed_at is null
    and ch.course_id = t.course_id
    and c.removed_at is null;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;

  select cc.role into v_role
  from public.course_collaborators cc
  join public.profiles p on p.id = cc.user_id
  where cc.course_id = v_topic.course_id
    and cc.user_id = v_user_id
    and p.removed_at is null;
  if not found then raise exception 'TOPIC_WORKFLOW_FORBIDDEN'; end if;

  v_can_edit := public.d1_topic_group_member(v_topic.id);
  v_can_review := public.has_topic_review_access(v_topic.id);
  v_can_delete := public.d1_can_delete_topic(v_topic.id);
  v_has_distinct_reviewer := public.d1_has_eligible_topic_reviewer(v_topic.id, v_user_id);

  select count(*) into v_card_count
  from public.cards c where c.topic_id = v_topic.id and c.removed_at is null;
  select count(*) into v_exercise_count
  from public.exercises e where e.topic_id = v_topic.id and e.removed_at is null;

  select * into v_pending
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id and s.status = 'pending'
  order by s.submitted_at desc, s.id desc
  limit 1;

  -- D30/D34: withdrawing is a distinct capability from requesting, and it is
  -- limited to the creator and the current responsible author.
  v_can_withdraw := v_can_edit
    and v_topic.status = 'pending'
    and v_pending.id is not null
    and v_user_id in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id);

  -- Lịch sử từ chối tính theo TOPIC, không theo người gửi: mọi caller đọc cùng
  -- một canonical state. `index` do server cấp (1-based, cũ -> mới).
  select coalesce(jsonb_agg(jsonb_build_object(
           'index', r.rn,
           'reason', r.rejection_reason,
           'reviewer', r.reviewer,
           'reviewedAt', r.reviewed_at
         ) order by r.rn), '[]'::jsonb)
  into v_rejection_history
  from (
    select s.rejection_reason, s.reviewed_at,
           row_number() over (order by s.reviewed_at asc, s.id asc) as rn,
           case when s.reviewed_by_user_id is null then null else (
             select jsonb_build_object(
               'userId', p.id,
               'fullName', p.full_name,
               'email', p.email,
               'avatarUrl', p.avatar_url
             )
             from public.profiles p
             where p.id = s.reviewed_by_user_id
           ) end as reviewer
    from public.topic_review_submissions s
    where s.topic_id = v_topic.id
      and s.status = 'rejected'
  ) r;

  select jsonb_build_object(
    'userId', p.id, 'fullName', p.full_name, 'email', p.email, 'avatarUrl', p.avatar_url
  ) into v_original_creator
  from public.profiles p where p.id = v_topic.original_creator_user_id;

  select jsonb_build_object(
    'userId', p.id, 'fullName', p.full_name, 'email', p.email, 'avatarUrl', p.avatar_url
  ) into v_responsible_author
  from public.profiles p where p.id = v_topic.responsible_author_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', tc.id, 'userId', p.id, 'fullName', p.full_name, 'email', p.email, 'avatarUrl', p.avatar_url
  ) order by tc.created_at, tc.id), '[]'::jsonb) into v_contributors
  from public.topic_contributors tc
  left join public.profiles p on p.id = tc.user_id
  where tc.topic_id = v_topic.id and tc.removed_at is null;

  select jsonb_build_object(
    'id', f.id,
    'actorUserId', f.actor_user_id,
    'previousResponsibleUserId', f.previous_responsible_user_id,
    'newResponsibleUserId', f.new_responsible_user_id,
    'feedbackType', f.feedback_type,
    'createdAt', f.created_at
  ) into v_latest_authorship_feedback
  from public.topic_authorship_feedback f
  where f.topic_id = v_topic.id and f.recipient_user_id = v_user_id
  order by f.created_at desc, f.id desc
  limit 1;

  return jsonb_build_object(
    'topicId', v_topic.id,
    'courseId', v_topic.course_id,
    'chapterId', v_topic.chapter_id,
    'title', v_topic.title,
    'status', v_topic.status,
    'role', v_role,
    'canEdit', v_can_edit,
    'canReview', v_can_review,
    'canRequestReview', v_can_edit
      and v_topic.status = 'draft'
      and v_user_id in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id)
      and v_card_count > 0
      and v_exercise_count > 0
      and v_has_distinct_reviewer,
    'canWithdrawReview', v_can_withdraw,
    'canDeleteTopic', v_can_delete,
    'activeFlashcardCount', v_card_count,
    'activeExerciseCount', v_exercise_count,
    'isReady', v_card_count > 0 and v_exercise_count > 0,
    'pendingSubmissionId', v_pending.id,
    'pendingSubmitterId', v_pending.submitted_by_user_id,
    'isCurrentUserSubmitter', coalesce(v_pending.submitted_by_user_id = v_user_id, false),
    -- Ẩn lịch sử khi topic đã published: giữ nguyên hành vi cũ.
    'rejectionCount', case when v_topic.status = 'published' then 0 else jsonb_array_length(v_rejection_history) end,
    'rejectionHistory', case when v_topic.status = 'published' then '[]'::jsonb else v_rejection_history end,
    'hasDistinctEligibleReviewer', v_has_distinct_reviewer,
    'originalCreator', v_original_creator,
    'responsibleAuthor', v_responsible_author,
    'contributors', v_contributors,
    'canManageAuthorship', v_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role),
    'isCurrentUserResponsible', v_topic.responsible_author_user_id = v_user_id,
    'isCurrentUserContributor', exists (
      select 1 from public.topic_contributors tc
      where tc.topic_id = v_topic.id and tc.user_id = v_user_id and tc.removed_at is null
    ),
    'latestAuthorshipFeedback', v_latest_authorship_feedback
  );
end;
$$;

revoke all on function public.get_topic_workflow_state(uuid) from public, anon;
grant execute on function public.get_topic_workflow_state(uuid) to authenticated, service_role;

-- 6. P18 cleanup: remove the two superseded surfaces now that every consumer
--    has moved (B4/A41 — one authority surface per question, not two).

-- Superseded by d1_topic_structure_capabilities above. Its only consumer was
-- app/actions/topic.ts, which now calls the three-column function.
drop function if exists public.d1_topic_structure_permissions(uuid[]);

-- Dead fourth copy of the reviewer predicate: its only callers were inside
-- request_topic_review and get_topic_workflow_state, both replaced above and
-- in 20260919100000. Under D41 its role-derived shape was never wrong — it is
-- dropped so reviewer logic cannot drift away from the three canonical
-- functions in 20260916130000.
drop function if exists public.d1_has_distinct_topic_reviewer(uuid, uuid, uuid);
