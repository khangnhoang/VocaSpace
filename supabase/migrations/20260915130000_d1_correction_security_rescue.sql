revoke update on table public.profiles from authenticated;
grant update (
  email,
  phone,
  username,
  full_name,
  avatar_url,
  dob,
  gender,
  updated_at,
  removed_at
) on table public.profiles to authenticated;

alter table public.topic_review_submissions
  add column if not exists rescue_escalation_id uuid
  references public.topic_review_escalations(id) on delete set null;

create index if not exists topic_review_submissions_rescue_escalation_idx
  on public.topic_review_submissions (rescue_escalation_id)
  where rescue_escalation_id is not null;

alter table public.topic_review_escalations
  drop constraint if exists topic_review_escalations_resolution_action_check;

alter table public.topic_review_escalations
  add constraint topic_review_escalations_resolution_action_check check (
    resolution_action is null
    or resolution_action in ('rescue', 'close', 'abandon', 'moderation')
  );

alter table public.platform_moderation_audits
  drop constraint if exists platform_moderation_audits_action_check;

alter table public.platform_moderation_audits
  add constraint platform_moderation_audits_action_check check (
    action in ('demote', 'takedown', 'invalidate_review', 'cancel_escalation')
  );

create or replace function public.d1_has_distinct_topic_reviewer(
  p_course_id uuid,
  p_excluded_user_id uuid,
  p_second_excluded_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_collaborators cc
    join public.profiles p on p.id = cc.user_id
    join public.courses c on c.id = cc.course_id
    where cc.course_id = p_course_id
      and c.removed_at is null
      and p.removed_at is null
      and cc.user_id <> p_excluded_user_id
      and (p_second_excluded_user_id is null or cc.user_id <> p_second_excluded_user_id)
      and (
        cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
        or (
          cc.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role)
          and cc.can_review_topics
        )
      )
  );
$$;

revoke all on function public.d1_has_distinct_topic_reviewer(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_has_distinct_topic_reviewer(uuid, uuid, uuid) to service_role;

create or replace function public.d1_resolve_topic_escalations_for_moderation(
  p_topic_ids uuid[],
  p_actor_user_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.topic_review_escalations
  set unresolved = false,
      resolved_by_user_id = p_actor_user_id,
      resolved_at = now(),
      resolution_action = 'moderation',
      resolution_reason = p_reason
  where topic_id = any(p_topic_ids)
    and unresolved;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.d1_resolve_topic_escalations_for_moderation(uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.d1_resolve_topic_escalations_for_moderation(uuid[], uuid, text) to service_role;

create or replace function public.d1_lock_topics_for_moderation(p_topic_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  for v_topic_id in
    select topic_id from unnest(p_topic_ids) as topic_ids(topic_id) order by topic_id
  loop
    perform pg_advisory_xact_lock(hashtext(v_topic_id::text));
    perform 1 from public.topics where id = v_topic_id for update;
  end loop;
end;
$$;

revoke all on function public.d1_lock_topics_for_moderation(uuid[]) from public, anon, authenticated;
grant execute on function public.d1_lock_topics_for_moderation(uuid[]) to service_role;

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

  select t.course_id into v_topic.course_id
  from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));

  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if v_topic.removed_at is not null then raise exception 'TOPIC_REMOVED'; end if;
  if v_topic.status <> 'draft' then raise exception 'TOPIC_NOT_DRAFT'; end if;
  if not public.has_course_authoring_access(v_topic.course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  if exists (
    select 1 from public.topic_review_escalations e
    where e.topic_id = p_topic_id
      and e.submitted_by_user_id = v_user_id
      and e.unresolved
  ) then
    raise exception 'TOPIC_REVIEW_ESCALATION_HOLD';
  end if;

  if exists (
    select 1 from public.topic_review_submissions s
    where s.topic_id = p_topic_id and s.status = 'pending'
  ) then
    raise exception 'TOPIC_REVIEW_ALREADY_PENDING';
  end if;

  select count(*) into v_card_count from public.cards c
  where c.topic_id = p_topic_id and c.removed_at is null;
  select count(*) into v_exercise_count from public.exercises e
  where e.topic_id = p_topic_id and e.removed_at is null;
  if v_card_count < 1 or v_exercise_count < 1 then
    raise exception using message = 'TOPIC_REVIEW_NOT_READY',
      detail = format('active_flashcards=%s active_exercises=%s', v_card_count, v_exercise_count);
  end if;

  if not public.d1_has_distinct_topic_reviewer(v_topic.course_id, v_user_id) then
    raise exception 'TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER';
  end if;

  select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number
  from public.topic_review_submissions s
  where s.topic_id = p_topic_id and s.submitted_by_user_id = v_user_id;

  insert into public.topic_review_submissions (
    topic_id, submitted_by_user_id, status, attempt_number
  ) values (
    p_topic_id, v_user_id, 'pending', v_attempt_number
  ) returning * into v_submission;

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'pending' where id = p_topic_id;

  return jsonb_build_object(
    'status', 'pending',
    'course_id', v_topic.course_id,
    'topic_id', p_topic_id,
    'submission_id', v_submission.id,
    'attempt_number', v_attempt_number,
    'active_flashcard_count', v_card_count,
    'active_exercise_count', v_exercise_count
  );
end;
$$;

create or replace function public.approve_topic_review(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.topic_review_submissions%rowtype;
  v_topic public.topics%rowtype;
  v_escalation public.topic_review_escalations%rowtype;
  v_course_id uuid;
  v_card_count integer;
  v_exercise_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select public.d1_review_submission_course_id(p_submission_id) into v_course_id;
  if v_course_id is null then raise exception 'TOPIC_REVIEW_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));

  select * into v_submission from public.topic_review_submissions s
  where s.id = p_submission_id for update;
  if not found then raise exception 'TOPIC_REVIEW_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_submission.topic_id::text));
  select * into v_topic from public.topics t
  where t.id = v_submission.topic_id for update;
  if not found or v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;
  if v_submission.status <> 'pending' or v_topic.status <> 'pending' then
    raise exception 'TOPIC_REVIEW_STALE';
  end if;
  if v_submission.submitted_by_user_id = v_user_id then raise exception 'TOPIC_REVIEW_SELF_REVIEW'; end if;
  if not public.has_topic_review_access(v_topic.id) then raise exception 'TOPIC_REVIEW_FORBIDDEN'; end if;

  if exists (
    select 1 from public.topic_review_escalations e
    where e.topic_id = v_topic.id and e.unresolved
  ) then
    if v_submission.rescue_escalation_id is null then
      raise exception 'TOPIC_REVIEW_ESCALATION_HOLD';
    end if;

    select * into v_escalation
    from public.topic_review_escalations e
    where e.id = v_submission.rescue_escalation_id
    for update;
    if not found
       or v_escalation.topic_id <> v_topic.id
       or not v_escalation.unresolved
       or v_escalation.submitted_by_user_id = v_submission.submitted_by_user_id
       or v_escalation.submitted_by_user_id = v_user_id then
      raise exception 'TOPIC_REVIEW_RESCUE_FORBIDDEN';
    end if;
    if exists (
      select 1
      from public.topic_review_escalations e
      where e.topic_id = v_topic.id
        and e.unresolved
        and e.id <> v_escalation.id
    ) then
      raise exception 'TOPIC_REVIEW_ESCALATION_HOLD';
    end if;
  elsif v_submission.rescue_escalation_id is not null then
    raise exception 'TOPIC_REVIEW_RESCUE_STALE';
  end if;

  select count(*) into v_card_count from public.cards c
  where c.topic_id = v_topic.id and c.removed_at is null;
  select count(*) into v_exercise_count from public.exercises e
  where e.topic_id = v_topic.id and e.removed_at is null;
  if v_card_count < 1 or v_exercise_count < 1 then raise exception 'TOPIC_REVIEW_NOT_READY'; end if;

  update public.topic_review_submissions
  set status = 'approved', reviewed_by_user_id = v_user_id, reviewed_at = now()
  where id = v_submission.id;
  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'published' where id = v_topic.id;

  if v_submission.rescue_escalation_id is not null then
    update public.topic_review_escalations
    set unresolved = false,
        resolved_by_user_id = v_user_id,
        resolved_at = now(),
        resolution_action = 'rescue',
        resolution_reason = 'Owner/co-owner rescue lifecycle was approved.'
    where id = v_submission.rescue_escalation_id;
  end if;

  return jsonb_build_object('status', 'published', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'submission_id', v_submission.id);
end;
$$;

create or replace function public.resolve_topic_review_escalation(
  p_escalation_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_escalation public.topic_review_escalations%rowtype;
  v_topic public.topics%rowtype;
  v_course_id uuid;
  v_attempt_number integer;
  v_submission public.topic_review_submissions%rowtype;
  v_card_count integer;
  v_exercise_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_action not in ('rescue', 'close', 'abandon') then raise exception 'TOPIC_REVIEW_ESCALATION_ACTION_INVALID'; end if;
  if v_reason is null then raise exception 'TOPIC_REVIEW_REASON_REQUIRED'; end if;
  if length(v_reason) > 2000 then raise exception 'TOPIC_REVIEW_REASON_TOO_LONG'; end if;

  select t.course_id into v_course_id
  from public.topic_review_escalations e join public.topics t on t.id = e.topic_id
  where e.id = p_escalation_id;
  if v_course_id is null then raise exception 'TOPIC_REVIEW_ESCALATION_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));

  select * into v_escalation from public.topic_review_escalations e
  where e.id = p_escalation_id for update;
  perform pg_advisory_xact_lock(hashtext(v_escalation.topic_id::text));
  select * into v_topic from public.topics t where t.id = v_escalation.topic_id for update;
  if not v_escalation.unresolved then raise exception 'TOPIC_REVIEW_ESCALATION_STALE'; end if;
  if not public.is_course_owner_or_co_owner(v_topic.course_id) then raise exception 'TOPIC_REVIEW_ESCALATION_FORBIDDEN'; end if;

  if p_action = 'rescue' then
    if v_escalation.submitted_by_user_id = v_user_id then
      raise exception 'TOPIC_REVIEW_RESCUE_FORBIDDEN';
    end if;
    if v_topic.removed_at is not null or v_topic.status <> 'draft' then raise exception 'TOPIC_NOT_DRAFT'; end if;
    select count(*) into v_card_count from public.cards c where c.topic_id = v_topic.id and c.removed_at is null;
    select count(*) into v_exercise_count from public.exercises e where e.topic_id = v_topic.id and e.removed_at is null;
    if v_card_count < 1 or v_exercise_count < 1 then raise exception 'TOPIC_REVIEW_NOT_READY'; end if;
    if not public.d1_has_distinct_topic_reviewer(v_topic.course_id, v_user_id, v_escalation.submitted_by_user_id) then
      raise exception 'TOPIC_REVIEW_NO_REMAINING_REVIEWER';
    end if;
    if exists (
      select 1
      from public.topic_review_escalations e
      where e.topic_id = v_topic.id
        and e.unresolved
        and e.id <> v_escalation.id
    ) then
      raise exception 'TOPIC_REVIEW_ESCALATION_HOLD';
    end if;

    if exists (select 1 from public.topic_review_submissions s where s.topic_id = v_topic.id and s.status = 'pending') then
      raise exception 'TOPIC_REVIEW_ALREADY_PENDING';
    end if;
    select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number
    from public.topic_review_submissions s where s.topic_id = v_topic.id and s.submitted_by_user_id = v_user_id;
    insert into public.topic_review_submissions (
      topic_id, submitted_by_user_id, status, attempt_number, rescue_escalation_id
    ) values (
      v_topic.id, v_user_id, 'pending', v_attempt_number, v_escalation.id
    ) returning * into v_submission;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics set status = 'pending' where id = v_topic.id;

    return jsonb_build_object('status', 'pending', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'submission_id', v_submission.id, 'escalation_id', v_escalation.id);
  end if;

  update public.topic_review_escalations
  set unresolved = false,
      resolved_by_user_id = v_user_id,
      resolved_at = now(),
      resolution_action = p_action,
      resolution_reason = v_reason
  where id = v_escalation.id;

  if p_action = 'abandon' then
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics set removed_at = now(), status = 'draft' where id = v_topic.id;
  end if;

  return jsonb_build_object('status', case when p_action = 'abandon' then 'removed' else 'draft' end, 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'escalation_id', v_escalation.id);
end;
$$;

create or replace function public.moderate_platform_content(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_course_id uuid;
  v_previous_status public.item_status;
  v_previous_removed_at timestamptz;
  v_topic_ids uuid[];
  v_cancelled integer := 0;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_actor and p.role = 'admin') then
    raise exception 'ADMIN_MODERATION_FORBIDDEN';
  end if;
  if p_target_type not in ('course', 'chapter', 'topic') then raise exception 'MODERATION_TARGET_INVALID'; end if;
  if p_action not in ('demote', 'takedown', 'invalidate_review', 'cancel_escalation') then raise exception 'MODERATION_ACTION_INVALID'; end if;
  if v_reason is null then raise exception 'MODERATION_REASON_REQUIRED'; end if;
  if length(v_reason) > 2000 then raise exception 'MODERATION_REASON_TOO_LONG'; end if;

  if p_target_type = 'topic' then
    select t.course_id, t.status, t.removed_at into v_course_id, v_previous_status, v_previous_removed_at
    from public.topics t where t.id = p_target_id;
    if v_course_id is null then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    perform pg_advisory_xact_lock(hashtext(p_target_id::text));
    select t.status, t.removed_at into v_previous_status, v_previous_removed_at from public.topics t where t.id = p_target_id for update;
    if p_action = 'cancel_escalation' then
      if v_previous_removed_at is not null or v_previous_status not in ('draft', 'pending') then
        raise exception 'MODERATION_TARGET_STATE_INVALID';
      end if;
      if not exists (select 1 from public.topic_review_escalations e where e.topic_id = p_target_id and e.unresolved) then
        raise exception 'TOPIC_REVIEW_ESCALATION_NOT_FOUND';
      end if;
    elsif p_action = 'invalidate_review' and v_previous_status <> 'pending' then
      raise exception 'MODERATION_TARGET_STATE_INVALID';
    elsif p_action = 'demote' and v_previous_status not in ('published', 'pending') then
      raise exception 'MODERATION_TARGET_STATE_INVALID';
    elsif p_action = 'takedown' and v_previous_removed_at is not null then
      raise exception 'MODERATION_TARGET_ALREADY_REMOVED';
    end if;
    v_topic_ids := array[p_target_id];
    if v_previous_status = 'pending' then
      v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_topic_ids, v_actor, v_reason);
    end if;
    perform public.d1_resolve_topic_escalations_for_moderation(v_topic_ids, v_actor, v_reason);
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics
    set status = 'draft', removed_at = case when p_action = 'takedown' then now() else null end
    where id = p_target_id;
  elsif p_target_type = 'chapter' then
    if p_action = 'cancel_escalation' then raise exception 'MODERATION_ACTION_NOT_SUPPORTED'; end if;
    select c.course_id, c.removed_at into v_course_id, v_previous_removed_at from public.chapters c where c.id = p_target_id;
    if v_course_id is null then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    select c.removed_at into v_previous_removed_at from public.chapters c where c.id = p_target_id for update;
    if p_action <> 'takedown' or v_previous_removed_at is not null then raise exception 'MODERATION_ACTION_NOT_SUPPORTED'; end if;
    select array_agg(t.id) into v_topic_ids from public.topics t where t.chapter_id = p_target_id and t.removed_at is null;
    if v_topic_ids is not null then
      perform public.d1_lock_topics_for_moderation(v_topic_ids);
      v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_topic_ids, v_actor, v_reason);
      perform public.d1_resolve_topic_escalations_for_moderation(v_topic_ids, v_actor, v_reason);
    end if;
    update public.chapters set removed_at = now() where id = p_target_id;
    v_previous_status := null;
  else
    if p_action = 'cancel_escalation' then raise exception 'MODERATION_ACTION_NOT_SUPPORTED'; end if;
    select c.status, c.removed_at into v_previous_status, v_previous_removed_at from public.courses c where c.id = p_target_id;
    if not found then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    v_course_id := p_target_id;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    if p_action = 'demote' then
      if v_previous_status <> 'published' then raise exception 'MODERATION_TARGET_STATE_INVALID'; end if;
      select array_agg(t.id) into v_topic_ids from public.topics t where t.course_id = p_target_id and t.status = 'pending' and t.removed_at is null;
      if v_topic_ids is not null then
        perform public.d1_lock_topics_for_moderation(v_topic_ids);
        v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_topic_ids, v_actor, v_reason);
        perform public.d1_resolve_topic_escalations_for_moderation(v_topic_ids, v_actor, v_reason);
      end if;
      update public.courses set status = 'draft' where id = p_target_id;
    elsif p_action = 'takedown' then
      if v_previous_removed_at is not null then raise exception 'MODERATION_TARGET_ALREADY_REMOVED'; end if;
      select array_agg(t.id) into v_topic_ids from public.topics t where t.course_id = p_target_id and t.removed_at is null;
      if v_topic_ids is not null then
        perform public.d1_lock_topics_for_moderation(v_topic_ids);
        v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_topic_ids, v_actor, v_reason);
        perform public.d1_resolve_topic_escalations_for_moderation(v_topic_ids, v_actor, v_reason);
      end if;
      update public.courses set status = 'draft', removed_at = now() where id = p_target_id;
    else
      raise exception 'MODERATION_ACTION_NOT_SUPPORTED';
    end if;
  end if;

  insert into public.platform_moderation_audits (
    actor_user_id, target_type, target_id, action, reason, previous_status, previous_removed_at
  ) values (
    v_actor, p_target_type, p_target_id, p_action, v_reason, v_previous_status, v_previous_removed_at
  );

  return jsonb_build_object('status', case when p_action = 'takedown' then 'removed' else 'draft' end, 'course_id', v_course_id, 'target_type', p_target_type, 'target_id', p_target_id, 'cancelled_reviews', v_cancelled);
end;
$$;

revoke all on function public.request_topic_review(uuid) from public, anon;
revoke all on function public.approve_topic_review(uuid) from public, anon;
revoke all on function public.reject_topic_review(uuid, text) from public, anon;
revoke all on function public.resolve_topic_review_escalation(uuid, text, text) from public, anon;
revoke all on function public.moderate_platform_content(text, uuid, text, text) from public, anon;
grant execute on function public.request_topic_review(uuid) to authenticated, service_role;
grant execute on function public.approve_topic_review(uuid) to authenticated, service_role;
grant execute on function public.reject_topic_review(uuid, text) to authenticated, service_role;
grant execute on function public.resolve_topic_review_escalation(uuid, text, text) to authenticated, service_role;
grant execute on function public.moderate_platform_content(text, uuid, text, text) to authenticated, service_role;

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
  v_can_review boolean := false;
  v_can_edit boolean := false;
  v_card_count integer := 0;
  v_exercise_count integer := 0;
  v_pending public.topic_review_submissions%rowtype;
  v_latest_rejection public.topic_review_submissions%rowtype;
  v_rejection_count integer := 0;
  v_escalation public.topic_review_escalations%rowtype;
  v_has_distinct_reviewer boolean := false;
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

  select cc.role, cc.can_review_topics
    into v_role, v_can_review
  from public.course_collaborators cc
  join public.profiles p on p.id = cc.user_id
  where cc.course_id = v_topic.course_id
    and cc.user_id = v_user_id
    and p.removed_at is null;
  if not found then raise exception 'TOPIC_WORKFLOW_FORBIDDEN'; end if;

  v_can_edit := v_role in (
    'owner'::public.course_member_role,
    'co_owner'::public.course_member_role,
    'editor'::public.course_member_role
  );
  v_can_review := v_role in (
    'owner'::public.course_member_role,
    'co_owner'::public.course_member_role
  ) or (
    v_role in (
      'editor'::public.course_member_role,
      'previewer'::public.course_member_role
    ) and v_can_review
  );
  v_has_distinct_reviewer := public.d1_has_distinct_topic_reviewer(v_topic.course_id, v_user_id);

  select count(*) into v_card_count
  from public.cards c
  where c.topic_id = v_topic.id and c.removed_at is null;
  select count(*) into v_exercise_count
  from public.exercises e
  where e.topic_id = v_topic.id and e.removed_at is null;

  select * into v_pending
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id and s.status = 'pending'
  order by s.submitted_at desc, s.id desc
  limit 1;

  select * into v_latest_rejection
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id
    and s.submitted_by_user_id = v_user_id
    and s.status = 'rejected'
  order by s.reviewed_at desc nulls last, s.id desc
  limit 1;

  select * into v_escalation
  from public.topic_review_escalations e
  where e.topic_id = v_topic.id and e.unresolved
  order by e.updated_at desc, e.id desc
  limit 1;

  select count(*) into v_rejection_count
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id
    and s.submitted_by_user_id = v_user_id
    and s.status = 'rejected';

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
      and v_card_count > 0
      and v_exercise_count > 0
      and v_has_distinct_reviewer
      and not coalesce(v_escalation.unresolved, false),
    'activeFlashcardCount', v_card_count,
    'activeExerciseCount', v_exercise_count,
    'isReady', v_card_count > 0 and v_exercise_count > 0,
    'pendingSubmissionId', v_pending.id,
    'pendingSubmitterId', v_pending.submitted_by_user_id,
    'isCurrentUserSubmitter', coalesce(v_pending.submitted_by_user_id = v_user_id, false),
    'latestRejectionReason', v_latest_rejection.rejection_reason,
    'rejectionCount', v_rejection_count,
    'escalationUnresolved', coalesce(v_escalation.unresolved, false),
    'hasDistinctEligibleReviewer', v_has_distinct_reviewer,
    'escalationId', v_escalation.id,
    'escalationSubmitterId', v_escalation.submitted_by_user_id,
    'canResolveEscalation', v_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
  );
end;
$$;

revoke all on function public.get_topic_workflow_state(uuid) from public, anon;
grant execute on function public.get_topic_workflow_state(uuid) to authenticated, service_role;
