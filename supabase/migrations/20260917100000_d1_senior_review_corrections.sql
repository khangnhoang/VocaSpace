-- D1 correction: close the senior-review gaps without introducing candidate revisions.

-- Management transfers may take responsibility themselves or assign an existing
-- topic contributor. Self-leave keeps the separately accepted owner/co_owner
-- recipient semantics.
create or replace function public.d1_transfer_topic_responsibility_locked(
  p_topic_id uuid,
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_allow_unrelated_owner_recipient boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
  v_recipient_role public.course_member_role;
begin
  select * into v_topic
  from public.topics t
  where t.id = p_topic_id
  for update;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if v_topic.status = 'pending'::public.item_status then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;
  if p_recipient_user_id is null or p_recipient_user_id = v_topic.responsible_author_user_id then
    raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID';
  end if;

  select cc.role into v_recipient_role
  from public.course_collaborators cc
  join public.profiles p on p.id = cc.user_id
  where cc.course_id = v_topic.course_id
    and cc.user_id = p_recipient_user_id
    and p.removed_at is null;
  if not found or v_recipient_role not in (
    'owner'::public.course_member_role,
    'co_owner'::public.course_member_role,
    'editor'::public.course_member_role
  ) then
    raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID';
  end if;

  if p_recipient_user_id = p_actor_user_id then
    if v_recipient_role not in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role) then
      raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID';
    end if;
  elsif not exists (
    select 1
    from public.topic_contributors tc
    where tc.topic_id = v_topic.id
      and tc.user_id = p_recipient_user_id
      and tc.removed_at is null
  ) and not (
    p_allow_unrelated_owner_recipient
    and v_recipient_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
  ) then
    raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID';
  end if;

  if v_topic.first_approved_at is null then
    insert into public.topic_author_review_exclusions (
      topic_id,
      user_id,
      exclusion_type,
      recorded_by_user_id
    ) values (
      v_topic.id,
      v_topic.responsible_author_user_id,
      'preapproval_responsible',
      p_actor_user_id
    ) on conflict (topic_id, user_id, exclusion_type) do nothing;
  end if;

  update public.topic_contributors
  set removed_at = timezone('utc', now()),
      removed_by_user_id = p_actor_user_id
  where topic_id = v_topic.id
    and user_id = p_recipient_user_id
    and removed_at is null;

  perform set_config('voca.d1_topic_authorship', 'on', true);
  update public.topics
  set responsible_author_user_id = p_recipient_user_id
  where id = v_topic.id;

  if p_recipient_user_id <> p_actor_user_id then
    insert into public.topic_authorship_feedback (
      topic_id,
      recipient_user_id,
      actor_user_id,
      previous_responsible_user_id,
      new_responsible_user_id,
      feedback_type
    ) values (
      v_topic.id,
      p_recipient_user_id,
      p_actor_user_id,
      v_topic.responsible_author_user_id,
      p_recipient_user_id,
      'responsibility_transfer'
    );
  end if;
end;
$$;

revoke all on function public.d1_transfer_topic_responsibility_locked(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.d1_transfer_topic_responsibility_locked(uuid, uuid, uuid, boolean) to service_role;

-- Keep the existing three-argument internal boundary strict for direct/manual
-- management calls; self-leave opts into the operation-specific fourth argument.
create or replace function public.d1_transfer_topic_responsibility_locked(
  p_topic_id uuid,
  p_recipient_user_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.d1_transfer_topic_responsibility_locked(
    p_topic_id,
    p_recipient_user_id,
    p_actor_user_id,
    false
  );
end;
$$;

revoke all on function public.d1_transfer_topic_responsibility_locked(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_transfer_topic_responsibility_locked(uuid, uuid, uuid) to service_role;

create or replace function public.d1_transfer_member_topic_responsibilities(
  p_course_id uuid,
  p_member_user_id uuid,
  p_recipient_user_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
  v_count integer := 0;
  v_allow_unrelated_owner_recipient boolean := p_member_user_id = p_actor_user_id;
begin
  if p_recipient_user_id is null then
    if exists (
      select 1 from public.topics t
      where t.course_id = p_course_id
        and t.responsible_author_user_id = p_member_user_id
        and t.first_approved_at is null
    ) then
      raise exception 'TOPIC_RESPONSIBILITY_TRANSFER_REQUIRED';
    end if;
    return 0;
  end if;

  for v_topic in
    select t.*
    from public.topics t
    where t.course_id = p_course_id
      and t.responsible_author_user_id = p_member_user_id
      and t.first_approved_at is null
    order by t.id
    for update
  loop
    perform public.d1_transfer_topic_responsibility_locked(
      v_topic.id,
      p_recipient_user_id,
      p_actor_user_id,
      v_allow_unrelated_owner_recipient
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.d1_transfer_member_topic_responsibilities(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_transfer_member_topic_responsibilities(uuid, uuid, uuid, uuid) to service_role;

-- Ordinary review requests remain blocked for the topic while any escalation
-- is unresolved, regardless of the current responsible author.
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
  if not public.has_course_authoring_access(v_topic.course_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_topic.responsible_author_user_id <> v_user_id then raise exception 'TOPIC_RESPONSIBLE_AUTHOR_REQUIRED'; end if;
  if exists (
    select 1 from public.topic_review_escalations e
    where e.topic_id = p_topic_id and e.unresolved
  ) then raise exception 'TOPIC_REVIEW_ESCALATION_HOLD'; end if;
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

-- A terminal close/abandon also invalidates any legacy or concurrently-created
-- pending submission before releasing the escalation hold.
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
  select * into v_escalation from public.topic_review_escalations e where e.id = p_escalation_id for update;
  perform pg_advisory_xact_lock(hashtext(v_escalation.topic_id::text));
  select * into v_topic from public.topics t where t.id = v_escalation.topic_id for update;
  if not v_escalation.unresolved then raise exception 'TOPIC_REVIEW_ESCALATION_STALE'; end if;
  if not public.is_course_owner_or_co_owner(v_topic.course_id) then raise exception 'TOPIC_REVIEW_ESCALATION_FORBIDDEN'; end if;

  if p_action = 'rescue' then
    if v_escalation.submitted_by_user_id = v_user_id then raise exception 'TOPIC_REVIEW_RESCUE_FORBIDDEN'; end if;
    if v_topic.removed_at is not null or v_topic.status <> 'draft' then raise exception 'TOPIC_NOT_DRAFT'; end if;
    select count(*) into v_card_count from public.cards c where c.topic_id = v_topic.id and c.removed_at is null;
    select count(*) into v_exercise_count from public.exercises e where e.topic_id = v_topic.id and e.removed_at is null;
    if v_card_count < 1 or v_exercise_count < 1 then raise exception 'TOPIC_REVIEW_NOT_READY'; end if;
    if not public.d1_has_eligible_topic_reviewer(v_topic.id, v_user_id, v_escalation.submitted_by_user_id) then raise exception 'TOPIC_REVIEW_NO_REMAINING_REVIEWER'; end if;
    if exists (select 1 from public.topic_review_escalations e where e.topic_id = v_topic.id and e.unresolved and e.id <> v_escalation.id) then raise exception 'TOPIC_REVIEW_ESCALATION_HOLD'; end if;
    if exists (select 1 from public.topic_review_submissions s where s.topic_id = v_topic.id and s.status = 'pending') then raise exception 'TOPIC_REVIEW_ALREADY_PENDING'; end if;
    select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number from public.topic_review_submissions s where s.topic_id = v_topic.id and s.submitted_by_user_id = v_user_id;
    insert into public.topic_review_submissions (topic_id, submitted_by_user_id, status, attempt_number, rescue_escalation_id)
    values (v_topic.id, v_user_id, 'pending', v_attempt_number, v_escalation.id) returning * into v_submission;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics set status = 'pending' where id = v_topic.id;
    return jsonb_build_object('status', 'pending', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'submission_id', v_submission.id, 'escalation_id', v_escalation.id);
  end if;

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topic_review_submissions
  set status = 'cancelled',
      cancelled_by_user_id = v_user_id,
      cancelled_at = now(),
      cancellation_reason = v_reason
  where topic_id = v_topic.id
    and status = 'pending';
  update public.topics
  set status = 'draft'
  where id = v_topic.id and status = 'pending';

  update public.topic_review_escalations
  set unresolved = false, resolved_by_user_id = v_user_id, resolved_at = now(), resolution_action = p_action, resolution_reason = v_reason
  where id = v_escalation.id;
  if p_action = 'abandon' then
    update public.topics set removed_at = now(), status = 'draft' where id = v_topic.id;
  end if;
  return jsonb_build_object('status', case when p_action = 'abandon' then 'removed' else 'draft' end, 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'escalation_id', v_escalation.id);
end;
$$;

revoke all on function public.resolve_topic_review_escalation(uuid, text, text) from public, anon;
grant execute on function public.resolve_topic_review_escalation(uuid, text, text) to authenticated, service_role;

-- Topic metadata has a trusted locked boundary already. Remove the old direct
-- UPDATE policies so Data API cannot race that boundary with a snapshot check.
drop policy if exists "Topics - Staff Update" on public.topics;
drop policy if exists "Topics - Staff Soft Delete" on public.topics;

-- Batch the same authoritative topic-group predicate for Course Structure rows.
create or replace function public.d1_topic_structure_permissions(p_topic_ids uuid[])
returns table(topic_id uuid, can_edit boolean)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, public.d1_topic_group_member(t.id)
  from public.topics t
  join public.chapters ch on ch.id = t.chapter_id
  where t.id = any(p_topic_ids)
    and t.removed_at is null
    and ch.removed_at is null
    and public.has_course_topic_read_access(t.course_id)
$$;

revoke all on function public.d1_topic_structure_permissions(uuid[]) from public, anon;
grant execute on function public.d1_topic_structure_permissions(uuid[]) to authenticated, service_role;

-- Persisted question-group media changes return the old references after the
-- DB-first mutation. The application cleans those old objects only after this
-- transaction succeeds; a cleanup failure can leave an orphan, never a broken
-- persisted reference.
create or replace function public.d1_question_group_media_delete_allowed(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_course_id text := split_part(p_object_name, '/', 1);
  v_topic_id text := split_part(p_object_name, '/', 2);
  v_topic public.topics%rowtype;
begin
  if p_bucket_id not in ('question_group_images', 'question_group_audios')
    or split_part(p_object_name, '/', 3) = ''
    or split_part(p_object_name, '/', 4) = ''
  then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_course_id));
  perform pg_advisory_xact_lock(hashtext(v_topic_id));
  select * into v_topic
  from public.topics t
  where t.id::text = v_topic_id
    and t.course_id::text = v_course_id
  for update;

  if not found
    or v_topic.removed_at is not null
    or v_topic.status <> 'draft'::public.item_status
    or not public.d1_topic_group_member(v_topic.id)
  then
    return false;
  end if;

  return not exists (
    select 1
    from public.question_groups qg
    join public.exercises e on e.id = qg.exercise_id
    where e.topic_id = v_topic.id
      and qg.removed_at is null
      and e.removed_at is null
      and (
        split_part(qg.audio_url, '/storage/v1/object/public/' || p_bucket_id || '/', 2) = p_object_name
        or split_part(qg.image_url, '/storage/v1/object/public/' || p_bucket_id || '/', 2) = p_object_name
      )
  );
end;
$$;

revoke all on function public.d1_question_group_media_delete_allowed(text, text) from public, anon;
grant execute on function public.d1_question_group_media_delete_allowed(text, text) to authenticated, service_role;

drop policy if exists "Owner or Admin Delete Question Group Images" on storage.objects;
create policy "Owner or Admin Delete Question Group Images"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'question_group_images'
  and (
    public.is_admin()
    or (
      owner = auth.uid()
      and public.d1_question_group_media_delete_allowed(bucket_id, name)
    )
  )
);

drop policy if exists "Owner or Admin Delete Question Group Audios" on storage.objects;
create policy "Owner or Admin Delete Question Group Audios"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'question_group_audios'
  and (
    public.is_admin()
    or (
      owner = auth.uid()
      and public.d1_question_group_media_delete_allowed(bucket_id, name)
    )
  )
);

create or replace function public.d1_update_question_group(
  p_group_id uuid,
  p_passage_text text,
  p_audio_url text,
  p_image_url text,
  p_confirm_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
  v_course_id uuid;
  v_previous_audio_url text;
  v_previous_image_url text;
begin
  select e.topic_id into v_topic_id
  from public.question_groups qg join public.exercises e on e.id = qg.exercise_id
  where qg.id = p_group_id;
  if not found then raise exception 'QUESTION_GROUP_NOT_FOUND'; end if;

  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);

  select qg.audio_url, qg.image_url
  into v_previous_audio_url, v_previous_image_url
  from public.question_groups qg
  where qg.id = p_group_id
  for update;
  if not found then raise exception 'QUESTION_GROUP_NOT_FOUND'; end if;

  update public.question_groups
  set passage_text = nullif(btrim(coalesce(p_passage_text, '')), ''),
      audio_url = nullif(btrim(coalesce(p_audio_url, '')), ''),
      image_url = nullif(btrim(coalesce(p_image_url, '')), '')
  where id = p_group_id and removed_at is null;
  if not found then raise exception 'QUESTION_GROUP_NOT_FOUND'; end if;

  select t.course_id into v_course_id from public.topics t where t.id = v_topic_id;
  return jsonb_build_object(
    'status', 'updated',
    'course_id', v_course_id,
    'topic_id', v_topic_id,
    'group_id', p_group_id,
    'previous_audio_url', v_previous_audio_url,
    'previous_image_url', v_previous_image_url
  );
end;
$$;

revoke all on function public.d1_update_question_group(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.d1_update_question_group(uuid, text, text, text, boolean) to authenticated, service_role;
