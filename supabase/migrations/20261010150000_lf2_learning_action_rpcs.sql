-- LF2 / CP3: giảm số round trip của hai Server Action học tập bằng hai RPC (plan r4 §3, G9-G11).
-- Contract: docs/programs/student-user-flow-route/implementation-plans/lf2/plan.md.
-- Rollback: supabase/rollbacks/20261010150000_lf2_learning_action_rpcs.down.sql (chỉ chạy sau khi gỡ code gọi RPC).
-- Không đổi policy đọc nội dung, q7 hay policy ghi của L1/MEMORY-002; cổng 20261010120000 giữ nguyên.

-- 1. Phân loại trạng thái của một lần trả lời theo đúng thứ tự ưu tiên của action:
--    unavailable (read boundary + parent chain) -> not_enrolled -> option_unavailable -> memory_locked -> ok.
--    Dùng cùng helper với policy/ghi: private.q7_can_read_topic, enrollments, option active của đúng câu và
--    private.lf2_memory_gate_open; không có định nghĩa thứ hai. Chỉ được gọi từ RPC bên dưới (actor luôn là auth.uid()).
create function private.lf2_answer_precheck(p_question_id uuid, p_option_id uuid)
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

revoke all on function private.lf2_answer_precheck(uuid, uuid) from public, anon, authenticated;

-- 2. RPC trả lời câu hỏi. SECURITY DEFINER nên điều kiện của policy L1/MEMORY-002 được lặp lại NGUYÊN VĂN
--    trong chính câu ghi (cả nhánh insert lẫn `on conflict do update where`) và dùng cùng helper với policy.
--    Chấm đúng/sai lấy từ RETURNING sau trigger L1 (`private.l1_derive_answer_correctness`), không tin client.
--    Ghi 0 dòng thì phân loại lại và không bao giờ trả success. Đồng bộ D4 và trạng thái memory nằm trong
--    subtransaction bắt OTHERS + QUERY_CANCELED (57014): lỗi hay timeout của sync không rollback đáp án đã ghi.
create function public.lf2_submit_question_answer(p_question_id uuid, p_selected_option_id uuid)
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

revoke all on function public.lf2_submit_question_answer(uuid, uuid) from public, anon;
grant execute on function public.lf2_submit_question_answer(uuid, uuid) to authenticated;

-- 3. RPC ôn thẻ. SECURITY INVOKER: policy L1 của user_flashcards vẫn quyết định quyền ghi. FSRS tính ở TypeScript.
--    Xác nhận đúng một dòng được ghi; 0 dòng (RLS ẩn hoặc dòng đã mất) trả mutation_failed và không sync.
--    Nhánh update chỉ chạm dòng của chính người gọi và đúng thẻ này.
create function public.lf2_submit_card_review(
  p_card_id uuid,
  p_user_flashcard_id uuid,
  p_next_review_date timestamptz,
  p_fsrs_meta jsonb,
  p_last_rating smallint,
  p_updated_at timestamptz
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_written uuid;
  v_topic_id uuid;
  v_progress jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'mutation_failed');
  end if;

  if p_user_flashcard_id is null then
    insert into public.user_flashcards (user_id, card_id, next_review_date, fsrs_meta, last_rating, updated_at)
    values (v_uid, p_card_id, p_next_review_date, p_fsrs_meta, p_last_rating, p_updated_at)
    returning id into v_written;
  else
    update public.user_flashcards
    set next_review_date = p_next_review_date, fsrs_meta = p_fsrs_meta,
        last_rating = p_last_rating, updated_at = p_updated_at
    where id = p_user_flashcard_id and user_id = v_uid and card_id = p_card_id
    returning id into v_written;
  end if;

  if v_written is null then
    return jsonb_build_object('status', 'mutation_failed');
  end if;

  begin
    select c.topic_id into v_topic_id from public.cards c where c.id = p_card_id;
    if v_topic_id is not null then
      v_progress := public.d4_sync_topic_progress(v_topic_id);
    end if;
  exception when others or query_canceled then
    v_progress := null;
  end;

  return jsonb_build_object('status', 'ok', 'progress', v_progress);
end
$$;

revoke all on function public.lf2_submit_card_review(uuid, uuid, timestamptz, jsonb, smallint, timestamptz) from public, anon;
grant execute on function public.lf2_submit_card_review(uuid, uuid, timestamptz, jsonb, smallint, timestamptz) to authenticated;
