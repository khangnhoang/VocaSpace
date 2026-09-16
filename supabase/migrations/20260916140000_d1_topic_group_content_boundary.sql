-- D1 P2-A: apply topic authorship-group authority to every supported content
-- mutation while preserving the trusted published demotion boundary.

-- Direct Data API RLS is evaluated before the row trigger. Re-check the
-- topic group after taking the same locks used by collaborator mutations so
-- a membership change cannot slip between authorization and commit.
create or replace function public.d1_lock_topic_for_mutation(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_status public.item_status;
  v_removed_at timestamptz;
begin
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    return;
  end if;

  select t.course_id
  into v_course_id
  from public.topics t
  where t.id = p_topic_id;
  if not found then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));

  select t.status, t.removed_at
  into v_status, v_removed_at
  from public.topics t
  where t.id = p_topic_id
  for update;

  if v_removed_at is not null then
    raise exception 'TOPIC_NOT_FOUND';
  end if;
  if v_status = 'pending' then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;
  if v_status = 'published' then
    raise exception 'TOPIC_PUBLISHED_MUTATION_REQUIRES_TRUSTED_BOUNDARY';
  end if;
  if not public.d1_topic_group_member(p_topic_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
end;
$$;

revoke all on function public.d1_lock_topic_for_mutation(uuid) from public, anon;
grant execute on function public.d1_lock_topic_for_mutation(uuid) to authenticated, service_role;

create or replace function public.d1_topic_group_member_for_restore(p_topic_id uuid)
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
      and ch.removed_at is null
      and ch.course_id = t.course_id
      and c.removed_at is null
      and p.removed_at is null
      and cc.role in (
        'owner'::public.course_member_role,
        'co_owner'::public.course_member_role,
        'editor'::public.course_member_role
      )
      and (
        t.responsible_author_user_id = auth.uid()
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

revoke all on function public.d1_topic_group_member_for_restore(uuid) from public, anon;
grant execute on function public.d1_topic_group_member_for_restore(uuid) to authenticated, service_role;

-- Direct table writes are draft-only. Published edits must go through the
-- trusted RPCs below so confirmation and demotion stay in one transaction.
create or replace function public.can_modify_content_by_topic(target_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.topics t
    where t.id = target_topic_id
      and t.removed_at is null
      and t.status = 'draft'::public.item_status
      and public.d1_topic_group_member(t.id)
  )
$$;

create or replace function public.can_modify_exercise_by_id(target_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exercises e
    where e.id = target_exercise_id
      and public.can_modify_content_by_topic(e.topic_id)
  )
$$;

create or replace function public.can_modify_question_by_id(target_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.questions q
    join public.exercises e on e.id = q.exercise_id
    where q.id = target_question_id
      and public.can_modify_content_by_topic(e.topic_id)
  )
$$;

create or replace function public.can_modify_exercise_child(target_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exercises e
    where e.id = target_exercise_id
      and public.can_modify_content_by_topic(e.topic_id)
  )
$$;

create or replace function public.can_modify_question_option(target_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.questions q
    join public.exercises e on e.id = q.exercise_id
    where q.id = target_question_id
      and public.can_modify_content_by_topic(e.topic_id)
  )
$$;

revoke all on function public.can_modify_content_by_topic(uuid) from public, anon;
revoke all on function public.can_modify_exercise_by_id(uuid) from public, anon;
revoke all on function public.can_modify_question_by_id(uuid) from public, anon;
revoke all on function public.can_modify_exercise_child(uuid) from public, anon;
revoke all on function public.can_modify_question_option(uuid) from public, anon;
grant execute on function public.can_modify_content_by_topic(uuid) to authenticated, service_role;
grant execute on function public.can_modify_exercise_by_id(uuid) to authenticated, service_role;
grant execute on function public.can_modify_question_by_id(uuid) to authenticated, service_role;
grant execute on function public.can_modify_exercise_child(uuid) to authenticated, service_role;
grant execute on function public.can_modify_question_option(uuid) to authenticated, service_role;

create or replace function public.d1_prepare_topic_content_mutation(
  p_topic_id uuid,
  p_confirm_published boolean default false
)
returns public.item_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id uuid;
  v_topic public.topics%rowtype;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select t.course_id into v_course_id
  from public.topics t
  where t.id = p_topic_id;
  if not found then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));
  select * into v_topic
  from public.topics t
  where t.id = p_topic_id
  for update;

  if v_topic.removed_at is not null then
    raise exception 'TOPIC_NOT_FOUND';
  end if;
  if not public.d1_topic_group_member(v_topic.id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
  if v_topic.status = 'pending' then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;
  if v_topic.status = 'published' then
    if not coalesce(p_confirm_published, false) then
      raise exception 'TOPIC_PUBLISHED_CONFIRM_REQUIRED';
    end if;
    -- The following content write is in this transaction. Any later error
    -- rolls the demotion back with the content mutation.
    update public.topics
    set status = 'draft'
    where id = v_topic.id;
  end if;

  return case when v_topic.status = 'published' then 'draft'::public.item_status else v_topic.status end;
end;
$$;

revoke all on function public.d1_prepare_topic_content_mutation(uuid, boolean) from public, anon, authenticated;
grant execute on function public.d1_prepare_topic_content_mutation(uuid, boolean) to service_role;

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

  if not public.d1_topic_group_member_for_restore(v_topic.id) then
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

-- Topic ordering is a topic-scoped mutation. The neighbor's order shift is a
-- mechanical consequence of moving the requested topic, so authorization is
-- checked against that requested topic at the same locked boundary.
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
  if not public.d1_topic_group_member(v_target.id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;

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

-- The legacy arities remain supported by existing callers, so make them
-- trusted wrappers too instead of leaving a callable bypass around the new
-- confirmation wrapper. The original implementations become owner-only
-- internal helpers.
alter function public.create_exercise_with_content(uuid, jsonb)
  rename to d1_create_exercise_with_content_unchecked;
revoke all on function public.d1_create_exercise_with_content_unchecked(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.d1_create_exercise_with_content_unchecked(uuid, jsonb) to service_role;

create or replace function public.create_exercise_with_content(
  p_topic_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.d1_prepare_topic_content_mutation(p_topic_id, false);
  return public.d1_create_exercise_with_content_unchecked(p_topic_id, p_payload);
end;
$$;

create or replace function public.create_exercise_with_content(
  p_topic_id uuid,
  p_payload jsonb,
  p_confirm_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.d1_prepare_topic_content_mutation(p_topic_id, p_confirm_published);
  return public.d1_create_exercise_with_content_unchecked(p_topic_id, p_payload);
end;
$$;

revoke all on function public.create_exercise_with_content(uuid, jsonb) from public, anon;
revoke all on function public.create_exercise_with_content(uuid, jsonb, boolean) from public, anon;
grant execute on function public.create_exercise_with_content(uuid, jsonb) to authenticated, service_role;
grant execute on function public.create_exercise_with_content(uuid, jsonb, boolean) to authenticated, service_role;

alter function public.soft_delete_exercise_cascade(uuid)
  rename to d1_soft_delete_exercise_cascade_unchecked;
revoke all on function public.d1_soft_delete_exercise_cascade_unchecked(uuid) from public, anon, authenticated;
grant execute on function public.d1_soft_delete_exercise_cascade_unchecked(uuid) to service_role;

create or replace function public.soft_delete_exercise_cascade(p_exercise_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exercise public.exercises%rowtype;
begin
  select * into v_exercise
  from public.exercises e
  where e.id = p_exercise_id;
  if not found then raise exception 'EXERCISE_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_exercise.topic_id, false);
  return public.d1_soft_delete_exercise_cascade_unchecked(p_exercise_id);
end;
$$;

create or replace function public.soft_delete_exercise_cascade(
  p_exercise_id uuid,
  p_confirm_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exercise public.exercises%rowtype;
begin
  select * into v_exercise
  from public.exercises e
  where e.id = p_exercise_id;
  if not found then raise exception 'EXERCISE_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_exercise.topic_id, p_confirm_published);
  return public.d1_soft_delete_exercise_cascade_unchecked(p_exercise_id);
end;
$$;

revoke all on function public.soft_delete_exercise_cascade(uuid) from public, anon;
revoke all on function public.soft_delete_exercise_cascade(uuid, boolean) from public, anon;
grant execute on function public.soft_delete_exercise_cascade(uuid) to authenticated, service_role;
grant execute on function public.soft_delete_exercise_cascade(uuid, boolean) to authenticated, service_role;

alter function public.sync_question_with_options(uuid, text, text, jsonb)
  rename to d1_sync_question_with_options_unchecked;
revoke all on function public.d1_sync_question_with_options_unchecked(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.d1_sync_question_with_options_unchecked(uuid, text, text, jsonb) to service_role;

create or replace function public.sync_question_with_options(
  p_question_id uuid,
  p_content text,
  p_explanation text,
  p_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  select e.topic_id into v_topic_id
  from public.questions q
  join public.exercises e on e.id = q.exercise_id
  where q.id = p_question_id;
  if v_topic_id is null then raise exception 'QUESTION_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, false);
  return public.d1_sync_question_with_options_unchecked(p_question_id, p_content, p_explanation, p_options);
end;
$$;

create or replace function public.sync_question_with_options(
  p_question_id uuid,
  p_content text,
  p_explanation text,
  p_options jsonb,
  p_confirm_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  select e.topic_id into v_topic_id
  from public.questions q
  join public.exercises e on e.id = q.exercise_id
  where q.id = p_question_id;
  if v_topic_id is null then raise exception 'QUESTION_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  return public.d1_sync_question_with_options_unchecked(p_question_id, p_content, p_explanation, p_options);
end;
$$;

revoke all on function public.sync_question_with_options(uuid, text, text, jsonb) from public, anon;
revoke all on function public.sync_question_with_options(uuid, text, text, jsonb, boolean) from public, anon;
grant execute on function public.sync_question_with_options(uuid, text, text, jsonb) to authenticated, service_role;
grant execute on function public.sync_question_with_options(uuid, text, text, jsonb, boolean) to authenticated, service_role;

-- Normal question-group media upload follows the same topic group as DB
-- authoring. Object deletion remains owner/admin moderation behavior.
drop policy if exists "Teacher and Admin Upload Question Group Images" on storage.objects;
drop policy if exists "Course Author Upload Question Group Images" on storage.objects;
create policy "Course Author Upload Question Group Images"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'question_group_images'
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) <> ''
  and exists (
    select 1
    from public.topics t
    where t.id::text = split_part(storage.objects.name, '/', 2)
      and t.course_id::text = split_part(storage.objects.name, '/', 1)
      and t.removed_at is null
      and t.status <> 'pending'::public.item_status
      and public.d1_topic_group_member(t.id)
  )
);

drop policy if exists "Teacher and Admin Upload Question Group Audios" on storage.objects;
drop policy if exists "Course Author Upload Question Group Audios" on storage.objects;
create policy "Course Author Upload Question Group Audios"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'question_group_audios'
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) <> ''
  and exists (
    select 1
    from public.topics t
    where t.id::text = split_part(storage.objects.name, '/', 2)
      and t.course_id::text = split_part(storage.objects.name, '/', 1)
      and t.removed_at is null
      and t.status <> 'pending'::public.item_status
      and public.d1_topic_group_member(t.id)
  )
);
