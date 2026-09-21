-- D1 v4 P11: split topic authority into three independent capabilities.
--
-- One boolean (`d1_topic_group_member`) used to answer three different
-- questions: who may edit topic content, who may reorder course structure,
-- and who may delete/restore the topic. D31 separates them:
--   canEditContent     = d1_topic_group_member
--   canManageStructure = d1_is_active_course_author
--   canDeleteTopic     = d1_can_delete_topic (created below)
-- After this file no boolean carries two meanings.

-- 1. d1_topic_group_member keeps the active-course-collaboration join and
--    drops the course-role branch (D26), and adds the creator (D22). Losing
--    course membership still removes every topic-scoped capability.
create or replace function public.d1_topic_group_member(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.topics t
    join public.chapters ch on ch.id = t.chapter_id
    join public.courses c on c.id = t.course_id
    join public.course_collaborators cc on cc.course_id = t.course_id and cc.user_id = auth.uid()
    join public.profiles p on p.id = auth.uid()
    where t.id = p_topic_id
      and t.removed_at is null
      and ch.removed_at is null
      and ch.course_id = t.course_id
      and c.removed_at is null
      and p.removed_at is null
      and (
        t.original_creator_user_id = auth.uid()
        or t.responsible_author_user_id = auth.uid()
        or exists (
          select 1
          from public.topic_contributors tc
          where tc.topic_id = t.id
            and tc.user_id = auth.uid()
            and tc.removed_at is null
        )
      )
  )
$$;

-- A client calls this directly (app/actions/exercise.ts), so `authenticated`
-- keeps EXECUTE (D39).
revoke all on function public.d1_topic_group_member(uuid) from public, anon;
grant execute on function public.d1_topic_group_member(uuid) to authenticated, service_role;

-- 2. d1_can_delete_topic is the single semantic owner of delete AND restore
--    authority (D27, D36). It deliberately does not filter `t.removed_at`, so
--    the same predicate also authorizes restoring a removed topic.
create or replace function public.d1_can_delete_topic(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.topics t
    join public.courses c on c.id = t.course_id
    join public.course_collaborators cc on cc.course_id = t.course_id and cc.user_id = auth.uid()
    join public.profiles p on p.id = auth.uid()
    where t.id = p_topic_id
      and c.removed_at is null and p.removed_at is null
      and (
        cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
        or t.original_creator_user_id = auth.uid()
        or t.responsible_author_user_id = auth.uid()
      )
  )
$$;

-- D39: all three callers (d1_delete_topic, d1_restore_topic,
-- d1_topic_structure_capabilities) are security definer boundaries, so
-- `authenticated` EXECUTE is not needed.
revoke all on function public.d1_can_delete_topic(uuid) from public, anon, authenticated;
grant execute on function public.d1_can_delete_topic(uuid) to service_role;

-- 3. Topic ordering is a course-structure mutation, not a topic-scoped one
--    (D37). The neighbor's order shift is a mechanical consequence of moving
--    the requested topic, so authorization is course-level here — otherwise
--    D26 would let `previewer + contributor` reorder structure.
create or replace function public.move_topic_order(
  p_topic_id uuid,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_chapter_id uuid;
  v_chapter public.chapters%rowtype;
  v_target public.topics%rowtype;
  v_neighbor public.topics%rowtype;
  v_temp_order integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_direction not in ('up', 'down') then raise exception 'INVALID_DIRECTION'; end if;

  select t.chapter_id into v_initial_chapter_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  select * into v_chapter from public.chapters c where c.id = v_initial_chapter_id for update;
  if not found then raise exception 'CHAPTER_NOT_FOUND'; end if;
  if v_chapter.removed_at is not null then raise exception 'CHAPTER_REMOVED'; end if;
  if not exists (select 1 from public.courses c where c.id = v_chapter.course_id and c.removed_at is null) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_chapter.course_id::text));

  select * into v_target from public.topics t where t.id = p_topic_id and t.chapter_id = v_chapter.id for update;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if v_target.removed_at is not null then raise exception 'TOPIC_REMOVED'; end if;
  if v_target.status = 'pending' then raise exception 'TOPIC_PENDING_FROZEN'; end if;
  if not public.d1_is_active_course_author(v_chapter.course_id, auth.uid()) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  if p_direction = 'up' then
    select * into v_neighbor from public.topics t
    where t.chapter_id = v_target.chapter_id and t.removed_at is null and t.order_index < v_target.order_index
    order by t.order_index desc, t.created_at desc, t.id desc limit 1 for update;
  else
    select * into v_neighbor from public.topics t
    where t.chapter_id = v_target.chapter_id and t.removed_at is null and t.order_index > v_target.order_index
    order by t.order_index asc, t.created_at asc, t.id asc limit 1 for update;
  end if;

  if not found then
    return jsonb_build_object(
      'status', 'noop',
      'reason', case when p_direction = 'up' then 'already_first' else 'already_last' end,
      'course_id', v_target.course_id,
      'chapter_id', v_target.chapter_id,
      'topic_id', v_target.id,
      'order_index', v_target.order_index
    );
  end if;
  if v_neighbor.status = 'pending' then raise exception 'TOPIC_PENDING_FROZEN'; end if;

  select coalesce(max(t.order_index), 0) + 1 into v_temp_order
  from public.topics t where t.chapter_id = v_target.chapter_id;
  update public.topics set order_index = v_temp_order, updated_at = timezone('utc', now()) where id = v_target.id;
  update public.topics set order_index = v_target.order_index, updated_at = timezone('utc', now()) where id = v_neighbor.id;
  update public.topics set order_index = v_neighbor.order_index, updated_at = timezone('utc', now()) where id = v_target.id;

  return jsonb_build_object(
    'status', 'moved',
    'course_id', v_target.course_id,
    'chapter_id', v_target.chapter_id,
    'topic_id', v_target.id,
    'neighbor_topic_id', v_neighbor.id,
    'direction', p_direction,
    'previous_order_index', v_target.order_index,
    'new_order_index', v_neighbor.order_index
  );
end;
$$;

revoke all on function public.move_topic_order(uuid, text) from public, anon;
grant execute on function public.move_topic_order(uuid, text) to authenticated, service_role;

-- 4. Restore mirrors delete (D36): one authority surface, not two. Only the
--    group check changes; the pending freeze, TOPIC_NOT_REMOVED and chapter
--    guards are preserved exactly.
create or replace function public.d1_restore_topic(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
begin
  select t.course_id into v_topic.course_id
  from public.topics t
  where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));
  select * into v_topic
  from public.topics t
  where t.id = p_topic_id
  for update;

  if not public.d1_can_delete_topic(v_topic.id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
  if v_topic.status = 'pending' then raise exception 'TOPIC_PENDING_FROZEN'; end if;
  if v_topic.removed_at is null then raise exception 'TOPIC_NOT_REMOVED'; end if;
  if v_topic.chapter_id is null or not exists (
    select 1 from public.chapters c
    where c.id = v_topic.chapter_id
      and c.course_id = v_topic.course_id
      and c.removed_at is null
  ) then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  update public.topics
  set status = 'draft', removed_at = null
  where id = p_topic_id;
  return jsonb_build_object('status', 'restored', 'course_id', v_topic.course_id, 'topic_id', p_topic_id);
end;
$$;

revoke all on function public.d1_restore_topic(uuid) from public;
grant execute on function public.d1_restore_topic(uuid) to authenticated, service_role;

-- The second membership predicate has no caller left once restore moved to
-- d1_can_delete_topic (D36: one semantic owner per question).
drop function if exists public.d1_topic_group_member_for_restore(uuid);

-- 5. Reviewer exclusion is split into a dynamic branch — the current authoring
--    group, unconditional at every round (D20) — and the historical branch,
--    which stays gated by first_approved_at (D21). The old single condition
--    made every exclusion expire at first approval, so an author could review
--    their own topic from round 2 onward.
create or replace function public.d1_is_topic_reviewer_excluded(
  p_topic_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.topics t
    where t.id = p_topic_id
      and (
        t.original_creator_user_id = p_user_id
        or t.responsible_author_user_id = p_user_id
        or exists (
          select 1
          from public.topic_contributors tc
          where tc.topic_id = t.id
            and tc.user_id = p_user_id
            and tc.removed_at is null
        )
        or (
          t.first_approved_at is null
          and exists (
            select 1
            from public.topic_author_review_exclusions e
            where e.topic_id = t.id
              and e.user_id = p_user_id
          )
        )
      )
  )
$$;

revoke all on function public.d1_is_topic_reviewer_excluded(uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_is_topic_reviewer_excluded(uuid, uuid) to service_role;

-- 6. request_topic_review moves from a course-scope gate to a topic-scope gate
--    and accepts both the creator and the current responsible author (D22).
--    The old course gate also wrongly blocked a creator whose course role had
--    been lowered to `previewer`.
create or replace function public.request_topic_review(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_topic public.topics%rowtype;
  v_card_count integer;
  v_exercise_count integer;
  v_attempt_number integer;
  v_submission public.topic_review_submissions%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select t.course_id into v_topic.course_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));

  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if v_topic.removed_at is not null then raise exception 'TOPIC_REMOVED'; end if;
  if v_topic.status <> 'draft'::public.item_status then raise exception 'TOPIC_NOT_DRAFT'; end if;
  if not public.d1_topic_group_member(p_topic_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_user_id not in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id) then
    raise exception 'TOPIC_AUTHOR_SUBMIT_REQUIRED';
  end if;
  if exists (
    select 1 from public.topic_review_submissions s
    where s.topic_id = p_topic_id and s.status = 'pending'::public.topic_review_submission_status
  ) then raise exception 'TOPIC_REVIEW_ALREADY_PENDING'; end if;

  select count(*) into v_card_count from public.cards c where c.topic_id = p_topic_id and c.removed_at is null;
  select count(*) into v_exercise_count from public.exercises e where e.topic_id = p_topic_id and e.removed_at is null;
  if v_card_count < 1 or v_exercise_count < 1 then
    raise exception using message = 'TOPIC_REVIEW_NOT_READY', detail = format('active_flashcards=%s active_exercises=%s', v_card_count, v_exercise_count);
  end if;
  if not public.d1_has_eligible_topic_reviewer(p_topic_id, v_user_id) then
    raise exception 'TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER';
  end if;

  select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number
  from public.topic_review_submissions s
  where s.topic_id = p_topic_id and s.submitted_by_user_id = v_user_id;
  insert into public.topic_review_submissions (topic_id, submitted_by_user_id, status, attempt_number)
  values (p_topic_id, v_user_id, 'pending', v_attempt_number)
  returning * into v_submission;

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'pending' where id = p_topic_id;
  return jsonb_build_object(
    'status', 'pending', 'course_id', v_topic.course_id, 'topic_id', p_topic_id,
    'submission_id', v_submission.id, 'attempt_number', v_attempt_number,
    'active_flashcard_count', v_card_count, 'active_exercise_count', v_exercise_count
  );
end;
$$;

revoke all on function public.request_topic_review(uuid) from public, anon;
grant execute on function public.request_topic_review(uuid) to authenticated, service_role;

-- 7. The creator is a member of the authoring group (D22), so the creator can
--    never occupy one of the two contributor slots either (U20). Enforced in
--    the trigger so direct Data API writes and service_role hit the same rule.
create or replace function public.d1_guard_topic_contributor_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_responsible_author_id uuid;
  v_original_creator_id uuid;
  v_active_count integer;
begin
  if tg_op = 'UPDATE'
     and (
       new.topic_id is distinct from old.topic_id
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at
     ) then
    raise exception 'TOPIC_CONTRIBUTOR_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;

  if new.removed_at is null then
    perform pg_advisory_xact_lock(hashtext(new.topic_id::text));

    select t.responsible_author_user_id, t.original_creator_user_id
    into v_responsible_author_id, v_original_creator_id
    from public.topics t
    where t.id = new.topic_id
    for update;

    if not found then
      raise exception 'TOPIC_NOT_FOUND';
    end if;

    if new.user_id = v_responsible_author_id then
      raise exception 'TOPIC_RESPONSIBLE_AUTHOR_NOT_CONTRIBUTOR';
    end if;

    if new.user_id = v_original_creator_id then
      raise exception 'TOPIC_CREATOR_NOT_CONTRIBUTOR';
    end if;

    select count(*)
    into v_active_count
    from public.topic_contributors c
    where c.topic_id = new.topic_id
      and c.removed_at is null
      and (tg_op <> 'UPDATE' or c.id <> new.id);

    if v_active_count >= 2 then
      raise exception 'TOPIC_CONTRIBUTOR_CAP_REACHED';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.d1_guard_topic_contributor_mutation() from public, anon, authenticated;
