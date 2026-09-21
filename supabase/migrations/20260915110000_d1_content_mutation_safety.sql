-- D1 P2: keep pending topics frozen and make published content mutations explicit,
-- atomic and reversible before the future candidate-revision model exists.

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

  -- Match course-scoped collaborator mutations before taking the topic lock.
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
end;
$$;

create or replace function public.d1_guard_topic_lifecycle_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_status public.item_status;
begin
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_course_id := old.course_id;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  perform pg_advisory_xact_lock(hashtext(old.id::text));
  select t.status into v_status
  from public.topics t
  where t.id = old.id
  for update;

  if v_status = 'pending'
     and current_setting('voca.d1_trusted_topic_lifecycle', true) is distinct from 'on' then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

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
  if not public.has_course_authoring_access(v_topic.course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
  if v_topic.status = 'pending' then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;
  if v_topic.status = 'published' then
    if not coalesce(p_confirm_published, false) then
      raise exception 'TOPIC_PUBLISHED_CONFIRM_REQUIRED';
    end if;
    -- The following content write is in the same transaction. Any later
    -- error rolls this demotion back with the content mutation.
    update public.topics
    set status = 'draft'
    where id = v_topic.id;
  end if;

  return case when v_topic.status = 'published' then 'draft'::public.item_status else v_topic.status end;
end;
$$;

revoke all on function public.d1_prepare_topic_content_mutation(uuid, boolean) from public, anon, authenticated;
grant execute on function public.d1_prepare_topic_content_mutation(uuid, boolean) to service_role;

create or replace function public.d1_update_topic(
  p_topic_id uuid,
  p_title text,
  p_confirm_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_title is null then raise exception 'TOPIC_TITLE_REQUIRED'; end if;
  if length(v_title) < 4 then raise exception 'TOPIC_TITLE_TOO_SHORT'; end if;
  if length(v_title) > 120 then raise exception 'TOPIC_TITLE_TOO_LONG'; end if;

  perform public.d1_prepare_topic_content_mutation(p_topic_id, p_confirm_published);
  select t.course_id into v_course_id from public.topics t where t.id = p_topic_id;
  update public.topics set title = v_title where id = p_topic_id;
  return jsonb_build_object('status', 'updated', 'course_id', v_course_id, 'topic_id', p_topic_id);
end;
$$;

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
  v_course_id uuid;
begin
  perform public.d1_prepare_topic_content_mutation(p_topic_id, p_confirm_published);
  select t.course_id into v_course_id from public.topics t where t.id = p_topic_id;
  update public.topics
  set status = 'draft', removed_at = timezone('utc', now())
  where id = p_topic_id;
  return jsonb_build_object('status', 'removed', 'course_id', v_course_id, 'topic_id', p_topic_id);
end;
$$;

create or replace function public.d1_restore_topic(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
begin
  select t.course_id into v_topic.course_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));
  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if not public.has_course_authoring_access(v_topic.course_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_topic.status = 'pending' then raise exception 'TOPIC_PENDING_FROZEN'; end if;
  if v_topic.removed_at is null then raise exception 'TOPIC_NOT_REMOVED'; end if;
  if v_topic.chapter_id is null or not exists (
    select 1 from public.chapters c
    where c.id = v_topic.chapter_id and c.course_id = v_topic.course_id and c.removed_at is null
  ) then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;
  update public.topics set status = 'draft', removed_at = null where id = p_topic_id;
  return jsonb_build_object('status', 'restored', 'course_id', v_topic.course_id, 'topic_id', p_topic_id);
end;
$$;

create or replace function public.d1_create_card(
  p_topic_id uuid,
  p_front_content jsonb,
  p_back_content jsonb,
  p_confirm_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order integer;
  v_card_id uuid;
  v_course_id uuid;
begin
  perform public.d1_prepare_topic_content_mutation(p_topic_id, p_confirm_published);
  select t.course_id into v_course_id from public.topics t where t.id = p_topic_id;
  select coalesce(max(c.order_index), 0) + 1 into v_order
  from public.cards c where c.topic_id = p_topic_id;
  insert into public.cards (topic_id, front_content, back_content, order_index)
  values (p_topic_id, p_front_content, p_back_content, v_order)
  returning id into v_card_id;
  return jsonb_build_object('status', 'created', 'course_id', v_course_id, 'topic_id', p_topic_id, 'card_id', v_card_id);
end;
$$;

create or replace function public.d1_bulk_create_cards(
  p_topic_id uuid,
  p_cards jsonb,
  p_confirm_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card jsonb;
  v_order integer;
  v_count integer := 0;
  v_course_id uuid;
begin
  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) = 0 then
    raise exception 'CARD_PAYLOAD_INVALID';
  end if;
  perform public.d1_prepare_topic_content_mutation(p_topic_id, p_confirm_published);
  select t.course_id into v_course_id from public.topics t where t.id = p_topic_id;
  select coalesce(max(c.order_index), 0) into v_order
  from public.cards c where c.topic_id = p_topic_id;
  for v_card in select value from jsonb_array_elements(p_cards)
  loop
    if jsonb_typeof(v_card->'front_content') <> 'object'
       or jsonb_typeof(v_card->'back_content') <> 'object' then
      raise exception 'CARD_PAYLOAD_INVALID';
    end if;
    v_order := v_order + 1;
    insert into public.cards (topic_id, front_content, back_content, order_index)
    values (p_topic_id, v_card->'front_content', v_card->'back_content', v_order);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('status', 'created', 'course_id', v_course_id, 'topic_id', p_topic_id, 'inserted_cards', v_count);
end;
$$;

create or replace function public.d1_update_card(
  p_card_id uuid,
  p_front_content jsonb,
  p_back_content jsonb,
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
begin
  select c.topic_id into v_topic_id from public.cards c where c.id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  update public.cards
  set front_content = p_front_content, back_content = p_back_content
  where id = p_card_id and removed_at is null;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  select t.course_id into v_course_id from public.topics t where t.id = v_topic_id;
  return jsonb_build_object('status', 'updated', 'course_id', v_course_id, 'topic_id', v_topic_id, 'card_id', p_card_id);
end;
$$;

create or replace function public.d1_delete_card(
  p_card_id uuid,
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
begin
  select c.topic_id into v_topic_id from public.cards c where c.id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  update public.cards set removed_at = timezone('utc', now()) where id = p_card_id and removed_at is null;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  select t.course_id into v_course_id from public.topics t where t.id = v_topic_id;
  return jsonb_build_object('status', 'removed', 'course_id', v_course_id, 'topic_id', v_topic_id, 'card_id', p_card_id);
end;
$$;

create or replace function public.d1_restore_topic_content(
  p_content_type text,
  p_content_id uuid,
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
  v_parent_removed_at timestamptz;
  v_removed_at timestamptz;
begin
  if p_content_type = 'card' then
    select c.topic_id, c.removed_at into v_topic_id, v_removed_at from public.cards c where c.id = p_content_id for update;
  elsif p_content_type = 'exercise' then
    select e.topic_id, e.removed_at into v_topic_id, v_removed_at from public.exercises e where e.id = p_content_id for update;
  elsif p_content_type = 'question_group' then
    select e.topic_id, qg.removed_at, e.removed_at into v_topic_id, v_removed_at, v_parent_removed_at
    from public.question_groups qg join public.exercises e on e.id = qg.exercise_id where qg.id = p_content_id for update of qg;
  elsif p_content_type = 'question' then
    select e.topic_id, q.removed_at, coalesce(e.removed_at, qg.removed_at) into v_topic_id, v_removed_at, v_parent_removed_at
    from public.questions q join public.exercises e on e.id = q.exercise_id
    left join public.question_groups qg on qg.id = q.group_id
    where q.id = p_content_id for update of q;
  elsif p_content_type = 'question_option' then
    select e.topic_id, qo.removed_at, coalesce(q.removed_at, e.removed_at, qg.removed_at) into v_topic_id, v_removed_at, v_parent_removed_at
    from public.question_options qo join public.questions q on q.id = qo.question_id
    join public.exercises e on e.id = q.exercise_id
    left join public.question_groups qg on qg.id = q.group_id
    where qo.id = p_content_id for update of qo;
  else
    raise exception 'CONTENT_TYPE_INVALID';
  end if;
  if v_topic_id is null then raise exception 'CONTENT_NOT_FOUND'; end if;
  if v_removed_at is null then raise exception 'CONTENT_NOT_REMOVED'; end if;
  if v_parent_removed_at is not null then raise exception 'CONTENT_PARENT_REMOVED'; end if;

  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  if p_content_type = 'card' then
    update public.cards set removed_at = null where id = p_content_id;
  elsif p_content_type = 'exercise' then
    update public.exercises set removed_at = null where id = p_content_id;
  elsif p_content_type = 'question_group' then
    update public.question_groups set removed_at = null where id = p_content_id;
  elsif p_content_type = 'question' then
    update public.questions set removed_at = null where id = p_content_id;
  else
    update public.question_options set removed_at = null where id = p_content_id;
  end if;
  select t.course_id into v_course_id from public.topics t where t.id = v_topic_id;
  return jsonb_build_object('status', 'restored', 'course_id', v_course_id, 'topic_id', v_topic_id, 'content_type', p_content_type, 'content_id', p_content_id);
end;
$$;

create or replace function public.d1_update_exercise_basic(
  p_exercise_id uuid,
  p_title text,
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
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_title is null then raise exception 'EXERCISE_TITLE_REQUIRED'; end if;
  if length(v_title) < 4 then raise exception 'EXERCISE_TITLE_TOO_SHORT'; end if;
  select e.topic_id into v_topic_id from public.exercises e where e.id = p_exercise_id for update;
  if not found then raise exception 'EXERCISE_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  update public.exercises set title = v_title where id = p_exercise_id and removed_at is null;
  if not found then raise exception 'EXERCISE_NOT_FOUND'; end if;
  select t.course_id into v_course_id from public.topics t where t.id = v_topic_id;
  return jsonb_build_object('status', 'updated', 'course_id', v_course_id, 'topic_id', v_topic_id, 'exercise_id', p_exercise_id);
end;
$$;

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
begin
  select e.topic_id into v_topic_id
  from public.question_groups qg join public.exercises e on e.id = qg.exercise_id
  where qg.id = p_group_id for update of qg;
  if not found then raise exception 'QUESTION_GROUP_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  update public.question_groups
  set passage_text = nullif(btrim(coalesce(p_passage_text, '')), ''),
      audio_url = nullif(btrim(coalesce(p_audio_url, '')), ''),
      image_url = nullif(btrim(coalesce(p_image_url, '')), '')
  where id = p_group_id and removed_at is null;
  if not found then raise exception 'QUESTION_GROUP_NOT_FOUND'; end if;
  select t.course_id into v_course_id from public.topics t where t.id = v_topic_id;
  return jsonb_build_object('status', 'updated', 'course_id', v_course_id, 'topic_id', v_topic_id, 'group_id', p_group_id);
end;
$$;

create or replace function public.d1_delete_question_group(
  p_group_id uuid,
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
  v_removed_at timestamptz := timezone('utc', now());
begin
  select e.topic_id into v_topic_id
  from public.question_groups qg join public.exercises e on e.id = qg.exercise_id
  where qg.id = p_group_id for update of qg;
  if not found then raise exception 'QUESTION_GROUP_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  update public.question_options qo set removed_at = v_removed_at
  where qo.removed_at is null and exists (
    select 1 from public.questions q where q.id = qo.question_id and q.group_id = p_group_id
  );
  update public.questions set removed_at = v_removed_at where group_id = p_group_id and removed_at is null;
  update public.question_groups set removed_at = v_removed_at where id = p_group_id and removed_at is null;
  if not found then raise exception 'QUESTION_GROUP_NOT_FOUND'; end if;
  select t.course_id into v_course_id from public.topics t where t.id = v_topic_id;
  return jsonb_build_object('status', 'removed', 'course_id', v_course_id, 'topic_id', v_topic_id, 'group_id', p_group_id);
end;
$$;

create or replace function public.d1_delete_question(
  p_question_id uuid,
  p_confirm_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions%rowtype;
  v_topic_id uuid;
  v_course_id uuid;
  v_count integer;
  v_group_count integer;
  v_standalone_count integer;
  v_group_ids uuid[];
  v_removed_at timestamptz := timezone('utc', now());
begin
  select q.* into v_question from public.questions q where q.id = p_question_id for update;
  if not found or v_question.removed_at is not null then raise exception 'QUESTION_NOT_FOUND'; end if;
  select e.topic_id into v_topic_id from public.exercises e where e.id = v_question.exercise_id;
  if v_topic_id is null then raise exception 'QUESTION_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);

  if v_question.group_id is not null then
    select count(*) into v_count from public.questions q
    where q.group_id = v_question.group_id and q.removed_at is null;
    if v_count <= 1 then raise exception 'QUESTION_GROUP_LAST_QUESTION'; end if;
  else
    select count(*) into v_standalone_count from public.questions q
    where q.exercise_id = v_question.exercise_id and q.group_id is null and q.removed_at is null;
    select array_agg(qg.id) into v_group_ids from public.question_groups qg
    where qg.exercise_id = v_question.exercise_id and qg.removed_at is null;
    if v_group_ids is null then
      v_group_count := 0;
    else
      select count(*) into v_group_count from public.questions q
      where q.group_id = any(v_group_ids) and q.removed_at is null;
    end if;
    if coalesce(v_standalone_count, 0) + coalesce(v_group_count, 0) <= 1 then
      raise exception 'EXERCISE_LAST_QUESTION';
    end if;
  end if;

  update public.question_options set removed_at = v_removed_at
  where question_id = p_question_id and removed_at is null;
  update public.questions set removed_at = v_removed_at where id = p_question_id and removed_at is null;
  select t.course_id into v_course_id from public.topics t where t.id = v_topic_id;
  return jsonb_build_object('status', 'removed', 'course_id', v_course_id, 'topic_id', v_topic_id, 'question_id', p_question_id);
end;
$$;

-- Existing RPCs retain their draft-only arity. These wrappers add the P2
-- confirmation boundary while reusing their established validation and writes.
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
  return public.create_exercise_with_content(p_topic_id, p_payload);
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
  v_topic_id uuid;
begin
  select e.topic_id into v_topic_id from public.exercises e where e.id = p_exercise_id for update;
  if not found then raise exception 'EXERCISE_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  return public.soft_delete_exercise_cascade(p_exercise_id);
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
  from public.questions q join public.exercises e on e.id = q.exercise_id
  where q.id = p_question_id for update of q;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  perform public.d1_prepare_topic_content_mutation(v_topic_id, p_confirm_published);
  return public.sync_question_with_options(p_question_id, p_content, p_explanation, p_options);
end;
$$;

revoke all on function public.d1_update_topic(uuid, text, boolean) from public;
revoke all on function public.d1_delete_topic(uuid, boolean) from public;
revoke all on function public.d1_restore_topic(uuid) from public;
revoke all on function public.d1_create_card(uuid, jsonb, jsonb, boolean) from public;
revoke all on function public.d1_bulk_create_cards(uuid, jsonb, boolean) from public;
revoke all on function public.d1_update_card(uuid, jsonb, jsonb, boolean) from public;
revoke all on function public.d1_delete_card(uuid, boolean) from public;
revoke all on function public.d1_restore_topic_content(text, uuid, boolean) from public;
revoke all on function public.d1_update_exercise_basic(uuid, text, boolean) from public;
revoke all on function public.d1_update_question_group(uuid, text, text, text, boolean) from public;
revoke all on function public.d1_delete_question_group(uuid, boolean) from public;
revoke all on function public.d1_delete_question(uuid, boolean) from public;
revoke all on function public.create_exercise_with_content(uuid, jsonb, boolean) from public;
revoke all on function public.soft_delete_exercise_cascade(uuid, boolean) from public;
revoke all on function public.sync_question_with_options(uuid, text, text, jsonb, boolean) from public;

grant execute on function public.d1_update_topic(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.d1_delete_topic(uuid, boolean) to authenticated, service_role;
grant execute on function public.d1_restore_topic(uuid) to authenticated, service_role;
grant execute on function public.d1_create_card(uuid, jsonb, jsonb, boolean) to authenticated, service_role;
grant execute on function public.d1_bulk_create_cards(uuid, jsonb, boolean) to authenticated, service_role;
grant execute on function public.d1_update_card(uuid, jsonb, jsonb, boolean) to authenticated, service_role;
grant execute on function public.d1_delete_card(uuid, boolean) to authenticated, service_role;
grant execute on function public.d1_restore_topic_content(text, uuid, boolean) to authenticated, service_role;
grant execute on function public.d1_update_exercise_basic(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.d1_update_question_group(uuid, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.d1_delete_question_group(uuid, boolean) to authenticated, service_role;
grant execute on function public.d1_delete_question(uuid, boolean) to authenticated, service_role;
grant execute on function public.create_exercise_with_content(uuid, jsonb, boolean) to authenticated, service_role;
grant execute on function public.soft_delete_exercise_cascade(uuid, boolean) to authenticated, service_role;
grant execute on function public.sync_question_with_options(uuid, text, text, jsonb, boolean) to authenticated, service_role;
