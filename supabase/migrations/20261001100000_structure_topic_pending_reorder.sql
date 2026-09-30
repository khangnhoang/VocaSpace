-- UI-4 follow-up (Owner decision 2026-10-01, R3): thứ tự bài học là cấu trúc,
-- không phải nội dung được duyệt (`approve_topic_review` không đọc
-- `order_index` hay `updated_at`), nên bài `pending` được phép đổi chỗ. Mọi
-- pending-freeze khác giữ nguyên (D1 §4.4).

-- 1. Guard trigger: thêm một ngoại lệ chỉ cho `order_index`/`updated_at`.
--    Cờ `voca.d1_trusted_topic_order` là cờ riêng (không dùng lại
--    `voca.d1_trusted_topic_lifecycle`, vì cờ đó mở mọi cột). Ngoại lệ chỉ qua
--    khi cờ bật VÀ mọi cột khác của dòng không đổi; nhánh nào khác giữ y hệt
--    bản trong 20260915110000_d1_content_mutation_safety.sql.
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
    -- So sánh JSONB để bất kỳ cột nào khác ngoài order_index/updated_at bị đổi
    -- (kể cả cột thêm sau này) đều vẫn bị chặn, dù cờ order đang bật.
    if not (
      tg_op = 'UPDATE'
      -- `is not distinct from` không bao giờ trả NULL: cờ chưa từng được đặt vẫn là "không bật".
      and current_setting('voca.d1_trusted_topic_order', true) is not distinct from 'on'
      and (to_jsonb(new) - 'order_index' - 'updated_at')
        = (to_jsonb(old) - 'order_index' - 'updated_at')
    ) then
      raise exception 'TOPIC_PENDING_FROZEN';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- 2. move_topic_order: bỏ hai check TOPIC_PENDING_FROZEN (target và neighbor)
--    và bật cờ order sau khi đã qua authorization. Chữ ký, kiểu trả về, lock
--    order (chapter -> course advisory -> topic rows) và authority
--    `d1_is_active_course_author` (D37) giữ nguyên so với
--    20260919100000_d1_topic_authority_split.sql.
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

revoke all on function public.move_topic_order(uuid, text) from public, anon;
grant execute on function public.move_topic_order(uuid, text) to authenticated, service_role;

-- 3. Kéo-thả: đặt bài ngay trước `p_before_topic_id` (null = cuối chương).
--    Cùng lock order và authority với move_topic_order. `p_expected_topic_ids` là
--    thứ tự các bài active mà client đã thấy lúc kéo; dưới khóa, nếu thứ tự hiện
--    tại khác (đổi chỗ, thêm, xóa, anchor không còn trong chương) thì báo
--    TOPIC_ORDER_STALE thay vì đoán vị trí (A5).
--    Bộ order_index của các bài active được giữ nguyên và chỉ hoán vị; các dòng
--    nằm giữa dịch từng bước sau khi target được đưa ra order tạm, để không
--    va unique index active `topics_chapter_id_order_index_active_unique_idx`.
drop function if exists public.move_topic_to_position(uuid, uuid);

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

revoke all on function public.move_topic_to_position(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.move_topic_to_position(uuid, uuid, uuid[]) to authenticated, service_role;
