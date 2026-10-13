-- Down script cho 20261013090000_lf7_structure_lock_order.sql.
-- Khôi phục bốn hàm về bản mới nhất trước LF7 (copy nguyên văn) và xóa rename_chapter.
-- Chỉ chạy trên hosted SAU KHI app LF7 đã được revert và bản app cũ đã được deploy lại,
-- vì app LF7 gọi rename_chapter.

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

  select coalesce(max(t.order_index), 0) + 1 into v_temp_order
  from public.topics t where t.chapter_id = v_target.chapter_id;

  -- Cờ chỉ bật quanh ba lệnh update order bên dưới, sau authorization.
  perform set_config('voca.d1_trusted_topic_order', 'on', true);
  update public.topics set order_index = v_temp_order, updated_at = timezone('utc', now()) where id = v_target.id;
  update public.topics set order_index = v_target.order_index, updated_at = timezone('utc', now()) where id = v_neighbor.id;
  update public.topics set order_index = v_neighbor.order_index, updated_at = timezone('utc', now()) where id = v_target.id;
  perform set_config('voca.d1_trusted_topic_order', 'off', true);

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

create or replace function public.move_topic_to_position(
  p_topic_id uuid,
  p_before_topic_id uuid,
  p_expected_topic_ids uuid[]
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
  v_ids uuid[];
  v_idx integer[];
  v_count integer;
  v_from integer;
  v_anchor integer;
  v_to integer;
  v_temp_order integer;
  v_k integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

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
  if not public.d1_is_active_course_author(v_chapter.course_id, auth.uid()) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  -- Khóa toàn bộ bài active của chương theo thứ tự xác định trước khi đọc
  -- thứ tự hiện tại, để danh sách bên dưới không đổi giữa lúc đọc và lúc ghi.
  perform 1 from public.topics t
  where t.chapter_id = v_chapter.id and t.removed_at is null
  order by t.order_index, t.created_at, t.id
  for update;

  select array_agg(t.id order by t.order_index, t.created_at, t.id),
         array_agg(t.order_index order by t.order_index, t.created_at, t.id)
  into v_ids, v_idx
  from public.topics t
  where t.chapter_id = v_chapter.id and t.removed_at is null;
  v_count := coalesce(array_length(v_ids, 1), 0);

  v_from := array_position(v_ids, p_topic_id);
  if v_from is null then raise exception 'TOPIC_NOT_FOUND'; end if;

  -- Client kéo trên thứ tự cũ thì không có gì đảm bảo vị trí thả còn đúng ý người dùng.
  -- Kiểm tra trước mọi nhánh noop/mutation, dưới khóa của cả chương.
  if p_expected_topic_ids is distinct from v_ids then
    raise exception 'TOPIC_ORDER_STALE';
  end if;

  -- Đặt chính nó trước chính nó là không đổi gì.
  if p_before_topic_id = p_topic_id then
    return jsonb_build_object(
      'status', 'noop',
      'reason', 'already_in_place',
      'course_id', v_target.course_id,
      'chapter_id', v_target.chapter_id,
      'topic_id', v_target.id,
      'order_index', v_target.order_index
    );
  end if;

  if p_before_topic_id is null then
    v_to := v_count;
  else
    v_anchor := array_position(v_ids, p_before_topic_id);
    if v_anchor is null then raise exception 'TOPIC_ORDER_STALE'; end if;
    -- Target rời vị trí cũ trước khi chèn, nên anchor ở sau target lùi một bước.
    v_to := case when v_anchor > v_from then v_anchor - 1 else v_anchor end;
  end if;

  if v_to = v_from then
    return jsonb_build_object(
      'status', 'noop',
      'reason', 'already_in_place',
      'course_id', v_target.course_id,
      'chapter_id', v_target.chapter_id,
      'topic_id', v_target.id,
      'order_index', v_target.order_index
    );
  end if;

  select coalesce(max(t.order_index), 0) + 1 into v_temp_order
  from public.topics t where t.chapter_id = v_chapter.id;

  -- Cờ chỉ bật quanh các lệnh update order bên dưới, sau authorization và
  -- sau khi đã xác nhận chương/khóa học/anchor còn hợp lệ.
  perform set_config('voca.d1_trusted_topic_order', 'on', true);
  update public.topics set order_index = v_temp_order, updated_at = timezone('utc', now())
  where id = v_target.id;

  if v_to < v_from then
    -- Kéo lên: các bài ở vị trí v_to..v_from-1 lùi xuống một vị trí, xử lý từ
    -- dưới lên để mỗi bài nhận đúng order vừa được giải phóng.
    for v_k in reverse (v_from - 1)..v_to loop
      update public.topics set order_index = v_idx[v_k + 1], updated_at = timezone('utc', now())
      where id = v_ids[v_k];
    end loop;
  else
    -- Kéo xuống: các bài ở vị trí v_from+1..v_to dồn lên một vị trí, xử lý từ
    -- trên xuống.
    for v_k in (v_from + 1)..v_to loop
      update public.topics set order_index = v_idx[v_k - 1], updated_at = timezone('utc', now())
      where id = v_ids[v_k];
    end loop;
  end if;

  update public.topics set order_index = v_idx[v_to], updated_at = timezone('utc', now())
  where id = v_target.id;
  perform set_config('voca.d1_trusted_topic_order', 'off', true);

  return jsonb_build_object(
    'status', 'moved',
    'course_id', v_target.course_id,
    'chapter_id', v_target.chapter_id,
    'topic_id', v_target.id,
    'previous_order_index', v_idx[v_from],
    'new_order_index', v_idx[v_to]
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

  select ch.course_id
  into v_initial_course_id
  from public.chapters ch
  where ch.id = p_chapter_id;

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

  select ch.*
  into v_target
  from public.chapters ch
  where ch.id = p_chapter_id
    and ch.course_id = v_course.id
  for update;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  if v_target.removed_at is not null then
    raise exception 'CHAPTER_REMOVED';
  end if;

  if not public.can_reorder_course_chapters(v_target.course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  if p_direction = 'up' then
    select ch.*
    into v_neighbor
    from public.chapters ch
    where ch.course_id = v_target.course_id
      and ch.removed_at is null
      and ch.order_index < v_target.order_index
    order by ch.order_index desc, ch.created_at desc, ch.id desc
    limit 1
    for update;
  else
    select ch.*
    into v_neighbor
    from public.chapters ch
    where ch.course_id = v_target.course_id
      and ch.removed_at is null
      and ch.order_index > v_target.order_index
    order by ch.order_index asc, ch.created_at asc, ch.id asc
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

  select coalesce(max(ch.order_index), 0) + 1
  into v_temp_order
  from public.chapters ch
  where ch.course_id = v_target.course_id;

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

  insert into public.chapters (course_id, title, order_index, created_by_user_id)
  values (p_course_id, v_title, v_next_order, auth.uid())
  returning * into v_chapter;

  return jsonb_build_object(
    'status', 'created',
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'course_id', v_chapter.course_id,
      'title', v_chapter.title,
      'order_index', v_chapter.order_index,
      'created_at', v_chapter.created_at,
      'updated_at', v_chapter.updated_at,
      'removed_at', v_chapter.removed_at
    )
  );
end;
$$;

drop function if exists public.rename_chapter(uuid, text);
