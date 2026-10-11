-- LF3 / CP3: memory check chỉ được trả lời sau khi học viên đã xem (có dòng user_flashcards của chính mình) mọi thẻ active của topic.
-- Contract: docs/programs/student-user-flow-route/implementation-plans/lf3/plan.md (AC4, AC5, G4-G7).
-- Rollback: supabase/rollbacks/20261011120000_lf3_memory_check_cards_seen_gate.down.sql
--   (chạy sau khi gỡ code xử lý `cards_locked`; thứ tự gỡ nằm trong file rollback).

-- 1. Định nghĩa DUY NHẤT của điều kiện "đã xem hết thẻ" (G4). SECURITY DEFINER vì user_flashcards chỉ cho học viên đọc dòng của
--    mình và admin đọc tất cả; helper luôn lọc user_id = auth.uid() một cách tường minh nên admin không bị coi là "đã xem"
--    nhờ dòng của người khác. Người gọi lấy từ auth.uid() (không nhận user id từ client).
--    - Chỉ áp cho câu của exercise memory_check; câu bài tập thường đi theo cổng LF2 (private.lf2_memory_gate_open) và luôn qua ở đây.
--    - "Thẻ active" đúng như D4 (G5): cards.topic_id = topic và removed_at is null. Chỉ hỏi dòng user_flashcards của mình có tồn tại,
--      bỏ qua last_rating (Lại/Khó không đóng lại cổng). Ràng buộc unique_user_card (user_id, card_id) đã chặn dòng trùng nên đếm theo từng thẻ chỉ là biện pháp an toàn.
--    - Topic không có thẻ active thì không khóa. Không tìm thấy câu/exercise thì trả false (đường ghi đã đóng sẵn bằng LF2 + L1).
create function private.lf3_cards_seen_gate_open(p_question_id uuid)
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
            and not exists (
              select 1 from public.user_flashcards uf
              where uf.card_id = c.id and uf.user_id = (select auth.uid())
            )
        )
      )
    from public.questions q
    join public.exercises e on e.id = q.exercise_id and e.course_id = q.course_id
    where q.id = p_question_id
  ), false)
$$;

revoke all on function private.lf3_cards_seen_gate_open(uuid) from public, anon;
grant execute on function private.lf3_cards_seen_gate_open(uuid) to authenticated;

-- 2. AND điều kiện vào WITH CHECK của hai policy ghi (G6): giữ nguyên USING, vai trò, lệnh và điều kiện L1/LF2; không thêm policy
--    permissive mới. SELECT không đổi nên đáp án đã lưu vẫn đọc được khi cổng đóng lại.
alter policy "User_answers - Auth Insert" on public.user_question_answers
with check (
  (select auth.uid()) = user_id
  and private.l1_can_write_learning_target('question', question_id)
  and exists (select 1 from public.question_options o
    where o.id = selected_option_id and o.question_id = user_question_answers.question_id and o.removed_at is null)
  and private.lf2_memory_gate_open(question_id)
  and private.lf3_cards_seen_gate_open(question_id)
);

alter policy "User_answers - Auth Update" on public.user_question_answers
with check (
  (select auth.uid()) = user_id and private.l1_can_write_learning_target('question', question_id)
  and exists (select 1 from public.question_options o
    where o.id = selected_option_id and o.question_id = user_question_answers.question_id and o.removed_at is null)
  and private.lf2_memory_gate_open(question_id)
  and private.lf3_cards_seen_gate_open(question_id)
);

-- 3. Phân loại: thêm trạng thái `cards_locked` ngay sau `memory_locked` (hai trạng thái loại trừ nhau: memory_locked chỉ áp cho câu
--    bài tập, cards_locked chỉ cho câu memory check). Các trạng thái và thứ tự còn lại giữ nguyên như LF2.
create or replace function private.lf2_answer_precheck(p_question_id uuid, p_option_id uuid)
returns table (o_status text, o_topic_id uuid, o_explanation text, o_is_memory boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_course_id uuid;
  v_topic_id uuid;
  v_explanation text;
  v_stage text;
begin
  select q.course_id, e.topic_id, q.explanation, e.activity_stage
    into v_course_id, v_topic_id, v_explanation, v_stage
  from public.questions q
  join public.exercises e on e.id = q.exercise_id and e.course_id = q.course_id and e.removed_at is null
  join public.topics t on t.id = e.topic_id and t.course_id = q.course_id
    and t.status = 'published'::public.item_status and t.removed_at is null
  join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id and ch.removed_at is null
  where q.id = p_question_id and q.removed_at is null
    and private.q7_can_read_topic(e.topic_id);
  if not found then
    return query select 'unavailable'::text, null::uuid, null::text, null::boolean;
    return;
  end if;

  if v_uid is null or not exists (
    select 1 from public.enrollments en where en.user_id = v_uid and en.course_id = v_course_id
  ) then
    return query select 'not_enrolled'::text, null::uuid, null::text, null::boolean;
    return;
  end if;

  if not exists (
    select 1 from public.question_options o
    where o.id = p_option_id and o.question_id = p_question_id and o.removed_at is null
  ) then
    return query select 'option_unavailable'::text, null::uuid, null::text, null::boolean;
    return;
  end if;

  if v_stage <> 'memory_check' and not private.lf2_memory_gate_open(p_question_id) then
    return query select 'memory_locked'::text, null::uuid, null::text, null::boolean;
    return;
  end if;

  if v_stage = 'memory_check' and not private.lf3_cards_seen_gate_open(p_question_id) then
    return query select 'cards_locked'::text, null::uuid, null::text, null::boolean;
    return;
  end if;

  return query select 'ok'::text, v_topic_id, v_explanation, v_stage = 'memory_check';
end
$$;

-- 4. RPC trả lời: lặp điều kiện mới NGUYÊN VĂN trong câu ghi ở cả nhánh insert và `on conflict do update where` (G4), dùng chung
--    helper với policy. Phần còn lại giống LF2. Ghi 0 dòng thì phân loại lại (có thể ra `cards_locked`).
create or replace function public.lf2_submit_question_answer(p_question_id uuid, p_selected_option_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pre record;
  v_post record;
  v_is_correct boolean;
  v_progress jsonb;
  v_memory boolean;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'auth_required');
  end if;

  select * into v_pre from private.lf2_answer_precheck(p_question_id, p_selected_option_id);
  if v_pre.o_status <> 'ok' then
    return jsonb_build_object('status', v_pre.o_status);
  end if;

  insert into public.user_question_answers as a (user_id, question_id, selected_option_id, is_correct, updated_at)
  select v_uid, p_question_id, p_selected_option_id, false, now()
  where private.l1_can_write_learning_target('question', p_question_id)
    and exists (select 1 from public.question_options o
      where o.id = p_selected_option_id and o.question_id = p_question_id and o.removed_at is null)
    and private.lf2_memory_gate_open(p_question_id)
    and private.lf3_cards_seen_gate_open(p_question_id)
  on conflict (user_id, question_id) do update
  set selected_option_id = excluded.selected_option_id, is_correct = excluded.is_correct, updated_at = excluded.updated_at
  where private.l1_can_write_learning_target('question', p_question_id)
    and exists (select 1 from public.question_options o
      where o.id = p_selected_option_id and o.question_id = p_question_id and o.removed_at is null)
    and private.lf2_memory_gate_open(p_question_id)
    and private.lf3_cards_seen_gate_open(p_question_id)
  returning a.is_correct into v_is_correct;

  if not found then
    select * into v_post from private.lf2_answer_precheck(p_question_id, p_selected_option_id);
    return jsonb_build_object('status', case when v_post.o_status = 'ok' then 'save_failed' else v_post.o_status end);
  end if;

  begin
    v_progress := public.d4_sync_topic_progress(v_pre.o_topic_id);
    if v_pre.o_is_memory then
      v_memory := (v_progress ->> 'is_memory_check_passed')::boolean;
    end if;
  exception when others or query_canceled then
    v_progress := null;
    v_memory := null;
  end;

  if v_pre.o_is_memory and v_memory is null then
    begin
      select s.memory_check_done into v_memory
      from private.d4_topic_completion_state(v_uid, v_pre.o_topic_id) s;
    exception when others or query_canceled then
      v_memory := null;
    end;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'is_correct', v_is_correct,
    'explanation', v_pre.o_explanation,
    'is_memory_check', v_pre.o_is_memory,
    'progress', v_progress,
    'memory_check_passed', v_memory
  );
end
$$;
