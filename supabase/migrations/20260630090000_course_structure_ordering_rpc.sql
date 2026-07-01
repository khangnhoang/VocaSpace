do $$
begin
  if exists (
    select 1
    from public.chapters
    where removed_at is null
      and order_index is null
  ) then
    raise exception 'ACTIVE_CHAPTER_ORDER_INDEX_NULL';
  end if;

  if exists (
    select 1
    from public.topics
    where removed_at is null
      and order_index is null
  ) then
    raise exception 'ACTIVE_TOPIC_ORDER_INDEX_NULL';
  end if;

  if exists (
    select 1
    from public.chapters
    where removed_at is null
      and order_index < 0
  ) then
    raise exception 'ACTIVE_CHAPTER_ORDER_INDEX_NEGATIVE';
  end if;

  if exists (
    select 1
    from public.topics
    where removed_at is null
      and order_index < 0
  ) then
    raise exception 'ACTIVE_TOPIC_ORDER_INDEX_NEGATIVE';
  end if;

  if exists (
    select 1
    from public.chapters
    where removed_at is null
    group by course_id, order_index
    having count(*) > 1
  ) then
    raise exception 'ACTIVE_CHAPTER_ORDER_INDEX_DUPLICATE';
  end if;

  if exists (
    select 1
    from public.topics
    where removed_at is null
    group by chapter_id, order_index
    having count(*) > 1
  ) then
    raise exception 'ACTIVE_TOPIC_ORDER_INDEX_DUPLICATE';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.chapters'::regclass
      and conname = 'chapters_active_order_index_present_check'
  ) then
    alter table public.chapters
      add constraint chapters_active_order_index_present_check
      check (removed_at is not null or order_index is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.chapters'::regclass
      and conname = 'chapters_active_order_index_nonnegative_check'
  ) then
    alter table public.chapters
      add constraint chapters_active_order_index_nonnegative_check
      check (removed_at is not null or order_index >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.topics'::regclass
      and conname = 'topics_active_order_index_present_check'
  ) then
    alter table public.topics
      add constraint topics_active_order_index_present_check
      check (removed_at is not null or order_index is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.topics'::regclass
      and conname = 'topics_active_order_index_nonnegative_check'
  ) then
    alter table public.topics
      add constraint topics_active_order_index_nonnegative_check
      check (removed_at is not null or order_index >= 0);
  end if;
end $$;

create unique index if not exists chapters_course_id_order_index_active_unique_idx
  on public.chapters (course_id, order_index)
  where removed_at is null;

create unique index if not exists topics_chapter_id_order_index_active_unique_idx
  on public.topics (chapter_id, order_index)
  where removed_at is null;

create or replace function public.create_chapter_ordered(
  p_course_id uuid,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_course record;
  v_next_order integer;
  v_chapter public.chapters%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');

  if v_title is null then
    raise exception 'CHAPTER_TITLE_REQUIRED';
  end if;

  if length(v_title) < 3 then
    raise exception 'CHAPTER_TITLE_TOO_SHORT';
  end if;

  if length(v_title) > 100 then
    raise exception 'CHAPTER_TITLE_TOO_LONG';
  end if;

  select c.id, c.removed_at
  into v_course
  from public.courses c
  where c.id = p_course_id
  for update;

  if not found or v_course.removed_at is not null then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  if not public.has_course_management_access(p_course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  select coalesce(max(c.order_index), 0) + 1
  into v_next_order
  from public.chapters c
  where c.course_id = p_course_id;

  insert into public.chapters (course_id, title, order_index)
  values (p_course_id, v_title, v_next_order)
  returning *
  into v_chapter;

  return jsonb_build_object(
    'status', 'created',
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'course_id', v_chapter.course_id,
      'title', v_chapter.title,
      'order_index', v_chapter.order_index,
      'created_at', v_chapter.created_at,
      'updated_at', v_chapter.updated_at
    )
  );
end;
$$;

create or replace function public.create_topic_ordered(
  p_course_id uuid,
  p_chapter_id uuid,
  p_title text,
  p_status public.item_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_chapter public.chapters%rowtype;
  v_next_order integer;
  v_topic public.topics%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_status is null then
    raise exception 'TOPIC_STATUS_REQUIRED';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');

  if v_title is null then
    raise exception 'TOPIC_TITLE_REQUIRED';
  end if;

  if length(v_title) < 4 then
    raise exception 'TOPIC_TITLE_TOO_SHORT';
  end if;

  if length(v_title) > 120 then
    raise exception 'TOPIC_TITLE_TOO_LONG';
  end if;

  select c.*
  into v_chapter
  from public.chapters c
  where c.id = p_chapter_id
  for update;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  if v_chapter.removed_at is not null then
    raise exception 'CHAPTER_REMOVED';
  end if;

  if v_chapter.course_id <> p_course_id then
    raise exception 'TOPIC_COURSE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and c.removed_at is null
  ) then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  if not public.has_course_management_access(p_course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  select coalesce(max(t.order_index), 0) + 1
  into v_next_order
  from public.topics t
  where t.chapter_id = p_chapter_id;

  insert into public.topics (course_id, chapter_id, title, status, order_index)
  values (p_course_id, p_chapter_id, v_title, p_status, v_next_order)
  returning *
  into v_topic;

  return jsonb_build_object(
    'status', 'created',
    'topic', jsonb_build_object(
      'id', v_topic.id,
      'course_id', v_topic.course_id,
      'chapter_id', v_topic.chapter_id,
      'title', v_topic.title,
      'status', v_topic.status,
      'order_index', v_topic.order_index,
      'created_at', v_topic.created_at,
      'updated_at', v_topic.updated_at
    )
  );
end;
$$;

create or replace function public.move_chapter_order(
  p_chapter_id uuid,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_course_id uuid;
  v_course record;
  v_target public.chapters%rowtype;
  v_neighbor public.chapters%rowtype;
  v_temp_order integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'INVALID_DIRECTION';
  end if;

  select c.course_id
  into v_initial_course_id
  from public.chapters c
  where c.id = p_chapter_id;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  select c.id, c.removed_at
  into v_course
  from public.courses c
  where c.id = v_initial_course_id
  for update;

  if not found or v_course.removed_at is not null then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select c.*
  into v_target
  from public.chapters c
  where c.id = p_chapter_id
    and c.course_id = v_course.id
  for update;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  if v_target.removed_at is not null then
    raise exception 'CHAPTER_REMOVED';
  end if;

  if not public.has_course_management_access(v_target.course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  if p_direction = 'up' then
    select c.*
    into v_neighbor
    from public.chapters c
    where c.course_id = v_target.course_id
      and c.removed_at is null
      and c.order_index < v_target.order_index
    order by c.order_index desc, c.created_at desc, c.id desc
    limit 1
    for update;
  else
    select c.*
    into v_neighbor
    from public.chapters c
    where c.course_id = v_target.course_id
      and c.removed_at is null
      and c.order_index > v_target.order_index
    order by c.order_index asc, c.created_at asc, c.id asc
    limit 1
    for update;
  end if;

  if not found then
    return jsonb_build_object(
      'status', 'noop',
      'reason', case when p_direction = 'up' then 'already_first' else 'already_last' end,
      'course_id', v_target.course_id,
      'chapter_id', v_target.id,
      'order_index', v_target.order_index
    );
  end if;

  select coalesce(max(c.order_index), 0) + 1
  into v_temp_order
  from public.chapters c
  where c.course_id = v_target.course_id;

  update public.chapters
  set order_index = v_temp_order,
      updated_at = timezone('utc', now())
  where id = v_target.id;

  update public.chapters
  set order_index = v_target.order_index,
      updated_at = timezone('utc', now())
  where id = v_neighbor.id;

  update public.chapters
  set order_index = v_neighbor.order_index,
      updated_at = timezone('utc', now())
  where id = v_target.id;

  return jsonb_build_object(
    'status', 'moved',
    'course_id', v_target.course_id,
    'chapter_id', v_target.id,
    'neighbor_chapter_id', v_neighbor.id,
    'direction', p_direction,
    'previous_order_index', v_target.order_index,
    'new_order_index', v_neighbor.order_index
  );
end;
$$;

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
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'INVALID_DIRECTION';
  end if;

  select t.chapter_id
  into v_initial_chapter_id
  from public.topics t
  where t.id = p_topic_id;

  if not found then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  select c.*
  into v_chapter
  from public.chapters c
  where c.id = v_initial_chapter_id
  for update;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  if v_chapter.removed_at is not null then
    raise exception 'CHAPTER_REMOVED';
  end if;

  if not exists (
    select 1
    from public.courses c
    where c.id = v_chapter.course_id
      and c.removed_at is null
  ) then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select t.*
  into v_target
  from public.topics t
  where t.id = p_topic_id
    and t.chapter_id = v_chapter.id
  for update;

  if not found then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  if v_target.removed_at is not null then
    raise exception 'TOPIC_REMOVED';
  end if;

  if not public.has_course_management_access(v_target.course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  if p_direction = 'up' then
    select t.*
    into v_neighbor
    from public.topics t
    where t.chapter_id = v_target.chapter_id
      and t.removed_at is null
      and t.order_index < v_target.order_index
    order by t.order_index desc, t.created_at desc, t.id desc
    limit 1
    for update;
  else
    select t.*
    into v_neighbor
    from public.topics t
    where t.chapter_id = v_target.chapter_id
      and t.removed_at is null
      and t.order_index > v_target.order_index
    order by t.order_index asc, t.created_at asc, t.id asc
    limit 1
    for update;
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

  select coalesce(max(t.order_index), 0) + 1
  into v_temp_order
  from public.topics t
  where t.chapter_id = v_target.chapter_id;

  update public.topics
  set order_index = v_temp_order,
      updated_at = timezone('utc', now())
  where id = v_target.id;

  update public.topics
  set order_index = v_target.order_index,
      updated_at = timezone('utc', now())
  where id = v_neighbor.id;

  update public.topics
  set order_index = v_neighbor.order_index,
      updated_at = timezone('utc', now())
  where id = v_target.id;

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

revoke all on function public.create_chapter_ordered(uuid, text) from public;
grant execute on function public.create_chapter_ordered(uuid, text) to authenticated;
grant execute on function public.create_chapter_ordered(uuid, text) to service_role;

revoke all on function public.create_topic_ordered(uuid, uuid, text, public.item_status) from public;
grant execute on function public.create_topic_ordered(uuid, uuid, text, public.item_status) to authenticated;
grant execute on function public.create_topic_ordered(uuid, uuid, text, public.item_status) to service_role;

revoke all on function public.move_chapter_order(uuid, text) from public;
grant execute on function public.move_chapter_order(uuid, text) to authenticated;
grant execute on function public.move_chapter_order(uuid, text) to service_role;

revoke all on function public.move_topic_order(uuid, text) from public;
grant execute on function public.move_topic_order(uuid, text) to authenticated;
grant execute on function public.move_topic_order(uuid, text) to service_role;
