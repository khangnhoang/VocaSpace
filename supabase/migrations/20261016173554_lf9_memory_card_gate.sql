-- LF9: null = chưa vượt cổng lần đầu; tập id đã đạt được giữ qua các lần ôn lại.
alter table public.user_topic_progress add column memory_gate_card_ids uuid[];

-- Cả Data API và RPC gọi cùng phép ghi nhận; row lock ngăn hai lần chấm làm mất id đã đạt.
create function private.lf9_capture_memory_gate(p_user_id uuid, p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cleared uuid[];
  v_active uuid[];
  v_good uuid[];
  v_all_good boolean;
begin
  -- Khi xóa cả topic, cascade không được tạo lại progress của topic đang bị xóa.
  if not exists (select 1 from public.topics t where t.id = p_topic_id) then return; end if;
  insert into public.user_topic_progress (user_id, topic_id)
  values (p_user_id, p_topic_id)
  on conflict (user_id, topic_id) do nothing;

  select p.memory_gate_card_ids into v_cleared
  from public.user_topic_progress p
  where p.user_id = p_user_id and p.topic_id = p_topic_id
  for update;

  -- Tập thẻ và điều kiện đạt phải cùng snapshot: thẻ mới chen vào không được coi là đã đạt.
  select coalesce(array_agg(c.id order by c.id), '{}'::uuid[]),
         coalesce(array_agg(c.id order by c.id) filter (where uf.last_rating >= 3), '{}'::uuid[]),
         coalesce(bool_and(coalesce(uf.last_rating >= 3, false)), true)
  into v_active, v_good, v_all_good
  from public.cards c
  left join public.user_flashcards uf on uf.card_id = c.id and uf.user_id = p_user_id
  where c.topic_id = p_topic_id and c.removed_at is null;

  if v_cleared is null then
    if not v_all_good then return; end if;
    v_cleared := v_active;
  else
    v_cleared := array(select distinct id from unnest(v_cleared || v_good) id order by id);
  end if;

  update public.user_topic_progress p set memory_gate_card_ids = v_cleared
  where p.user_id = p_user_id and p.topic_id = p_topic_id
    and p.memory_gate_card_ids is distinct from v_cleared;
end;
$$;
revoke all on function private.lf9_capture_memory_gate(uuid, uuid) from public, anon, authenticated, service_role;

create function private.lf9_capture_card_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_topic_id uuid;
  v_old_topic_id uuid;
  v_old_user_id uuid;
  v_scope record;
begin
  select c.topic_id into v_new_topic_id from public.cards c where c.id = new.card_id;
  if tg_op = 'UPDATE' then
    select c.topic_id into v_old_topic_id from public.cards c where c.id = old.card_id;
    v_old_user_id := old.user_id;
  end if;
  -- Đổi card/user phải khóa cả scope nguồn và đích; giữ cùng thứ tự với trigger nội dung.
  for v_scope in
    select distinct s.topic_id, s.user_id
    from (values (v_new_topic_id, new.user_id), (v_old_topic_id, v_old_user_id)) s(topic_id, user_id)
    where s.topic_id is not null and s.user_id is not null
    order by s.topic_id, s.user_id
  loop
    perform private.lf9_capture_memory_gate(v_scope.user_id, v_scope.topic_id);
  end loop;
  return new;
end;
$$;
revoke all on function private.lf9_capture_card_rating() from public, anon, authenticated, service_role;

-- Mọi rating cùng khóa progress đến commit: downgrade trực tiếp không chen qua transaction đang ghi nhận mở cổng.
-- Rating bị từ chối hoặc rollback không để lại dấu vượt cổng.
create trigger lf9_capture_card_rating
after insert or update of last_rating, card_id, user_id on public.user_flashcards
for each row
execute function private.lf9_capture_card_rating();

-- Gỡ thẻ còn thiếu cũng có thể mở cổng lần đầu; ghi nhận ngay, trước lần ôn Lại/Khó kế tiếp.
create function private.lf9_capture_card_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_topic uuid;
  v_progress record;
begin
  if tg_op <> 'DELETE' then
    if new.topic_id is not distinct from old.topic_id and new.removed_at is not distinct from old.removed_at then return null; end if;
    if new.topic_id is distinct from old.topic_id then v_new_topic := new.topic_id; end if;
  end if;
  for v_progress in
    select p.user_id, p.topic_id from public.user_topic_progress p
    where (p.topic_id = old.topic_id and p.memory_gate_card_ids is null) or p.topic_id = v_new_topic
    order by p.topic_id, p.user_id
  loop
    perform private.lf9_capture_memory_gate(v_progress.user_id, v_progress.topic_id);
  end loop;
  return null;
end;
$$;
revoke all on function private.lf9_capture_card_content_change() from public, anon, authenticated, service_role;
create trigger lf9_capture_card_content_change
after delete or update of removed_at, topic_id on public.cards
for each row execute function private.lf9_capture_card_content_change();

-- Dữ liệu cũ không có mốc mở: giữ chủ đề đã xong hoặc memory check hiện đúng hết (Owner).
insert into public.user_topic_progress (user_id, topic_id)
select distinct a.user_id, e.topic_id
from public.user_question_answers a
join public.questions q on q.id = a.question_id
join public.exercises e on e.id = q.exercise_id
where e.activity_stage = 'memory_check' and e.removed_at is null
  and q.removed_at is null and q.group_id is null
on conflict (user_id, topic_id) do nothing;

insert into public.user_topic_progress (user_id, topic_id)
select distinct uf.user_id, c.topic_id from public.user_flashcards uf join public.cards c on c.id = uf.card_id
on conflict (user_id, topic_id) do nothing;

update public.user_topic_progress p
set memory_gate_card_ids = array(
  select c.id from public.cards c where c.topic_id = p.topic_id and c.removed_at is null order by c.id
)
where p.is_topic_completed
  or (select s.flashcards_done from private.d4_topic_completion_state(p.user_id, p.topic_id) s)
  or (
    exists (select 1 from private.d3_active_memory_questions(p.topic_id))
    and (select s.memory_check_done from private.d4_topic_completion_state(p.user_id, p.topic_id) s)
  );

-- Giữ identity để hai policy và cả hai nhánh ghi RPC dùng một điều kiện; quyền cũ không đổi.
create or replace function private.lf3_cards_seen_gate_open(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (select auth.uid()) is not null
      and (
        e.activity_stage is distinct from 'memory_check'
        or not exists (
          select 1 from public.cards c
          where c.topic_id = e.topic_id and c.removed_at is null
            and not (c.id = any(coalesce(p.memory_gate_card_ids, '{}'::uuid[])))
        )
      )
    from public.questions q
    join public.exercises e on e.id = q.exercise_id and e.course_id = q.course_id
    left join public.user_topic_progress p on p.topic_id = e.topic_id and p.user_id = (select auth.uid())
    where q.id = p_question_id
  ), false)
$$;


-- Cùng phép ghi nhận khi nội dung thay đổi; giữ nguyên năm khóa JSON của RPC đang triển khai.
create or replace function public.d4_sync_topic_progress(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_was_completed boolean;
  v_completed_at timestamptz;
  v_state record;
  v_is_completed boolean;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  -- Dùng lại read boundary Q7, cộng điều kiện của learner: helper Q7 cho admin hoặc
  -- collaborator đọc topic draft, nhưng chỉ topic đang publish mới tính tiến độ.
  if not private.q7_can_read_topic(p_topic_id)
    or not exists (
      select 1
      from public.topics t
      join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id
      join public.courses c on c.id = t.course_id
      where t.id = p_topic_id
        and t.status = 'published'::public.item_status
        and t.removed_at is null
        and ch.removed_at is null
        and c.status = 'published'::public.item_status
        and c.removed_at is null
    )
  then
    raise exception 'TOPIC_UNAVAILABLE';
  end if;

  if not private.q7_has_learning_target_enrollment('topic', p_topic_id) then
    raise exception 'ENROLLMENT_REQUIRED';
  end if;

  -- Bảo đảm có dòng rồi khóa nó: giá trị cũ đọc dưới row lock nên hai lần sync đồng thời
  -- không thể cùng báo newly_completed, và trạng thái được suy ra sau khi đã có khóa.
  insert into public.user_topic_progress (user_id, topic_id)
  values (v_user_id, p_topic_id)
  on conflict (user_id, topic_id) do nothing;

  select coalesce(p.is_topic_completed, false), p.completed_at
  into v_was_completed, v_completed_at
  from public.user_topic_progress p
  where p.user_id = v_user_id and p.topic_id = p_topic_id
  for update;

  perform private.lf9_capture_memory_gate(v_user_id, p_topic_id);

  select * into v_state from private.d4_topic_completion_state(v_user_id, p_topic_id);

  -- Hoàn thành không bao giờ bị hạ (G4); cờ stage luôn là snapshot hiện tại.
  v_is_completed := v_was_completed or v_state.all_done;

  update public.user_topic_progress p
  set
    is_flashcard_completed = v_state.flashcards_done,
    is_exercise_completed = v_state.exercises_done,
    is_topic_completed = v_is_completed,
    -- Giữ mốc cũ; chỉ đóng dấu now() khi snapshot hiện tại thật sự hoàn thành (H2).
    completed_at = coalesce(v_completed_at, case when v_state.all_done then now() end),
    updated_at = now()
  where p.user_id = v_user_id and p.topic_id = p_topic_id;

  return jsonb_build_object(
    'is_flashcard_completed', v_state.flashcards_done,
    'is_memory_check_passed', v_state.memory_check_done,
    'is_exercise_completed', v_state.exercises_done,
    'is_topic_completed', v_is_completed,
    'newly_completed', v_is_completed and not v_was_completed
  );
end;
$$;

revoke all on function public.d4_sync_topic_progress(uuid) from public, anon;
grant execute on function public.d4_sync_topic_progress(uuid) to authenticated;
