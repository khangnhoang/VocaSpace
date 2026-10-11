-- Rollback của 20261011120000_lf3_memory_check_cards_seen_gate.sql: trả hai policy về định nghĩa LF2 (20261010120000), trả hai hàm
-- về thân LF2 (20261010150000) rồi mới bỏ helper mà chúng đang gọi. Chạy SAU khi đã deploy code không còn xử lý `cards_locked`.
-- Không nằm trong supabase/migrations nên Supabase CLI không tự áp dụng; chạy thủ công khi cần quay lui.
alter policy "User_answers - Auth Insert" on public.user_question_answers
with check (
  (select auth.uid()) = user_id
  and private.l1_can_write_learning_target('question', question_id)
  and exists (select 1 from public.question_options o
    where o.id = selected_option_id and o.question_id = user_question_answers.question_id and o.removed_at is null)
  and private.lf2_memory_gate_open(question_id)
);

alter policy "User_answers - Auth Update" on public.user_question_answers
with check (
  (select auth.uid()) = user_id and private.l1_can_write_learning_target('question', question_id)
  and exists (select 1 from public.question_options o
    where o.id = selected_option_id and o.question_id = user_question_answers.question_id and o.removed_at is null)
  and private.lf2_memory_gate_open(question_id)
);

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
  -- Read boundary: câu hỏi mà RLS đọc hiện tại cho người gọi thấy (question/exercise active + q7 của đúng topic),
  -- cộng parent chain tin cậy giống `hasTrustedParentChain` của action.
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

  return query select 'ok'::text, v_topic_id, v_explanation, v_stage = 'memory_check';
end
$$;

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
  on conflict (user_id, question_id) do update
  set selected_option_id = excluded.selected_option_id, is_correct = excluded.is_correct, updated_at = excluded.updated_at
  where private.l1_can_write_learning_target('question', p_question_id)
    and exists (select 1 from public.question_options o
      where o.id = p_selected_option_id and o.question_id = p_question_id and o.removed_at is null)
    and private.lf2_memory_gate_open(p_question_id)
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

  -- AC3a: sync hỏng thì suy ra trạng thái memory từ cùng định nghĩa D4 trong subtransaction riêng.
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

drop function private.lf3_cards_seen_gate_open(uuid);
