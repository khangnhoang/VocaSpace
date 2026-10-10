-- LF2 / MEMORY-002: cổng memory check của exercise phải được database ép, không chỉ Server Action.
-- Contract: docs/programs/student-user-flow-route/implementation-plans/lf2/plan.md (AC4, G3-G5).
-- Rollback: supabase/rollbacks/20261010120000_lf2_memory_check_answer_gate.down.sql.

-- 1. Helper trả lời "cổng của câu hỏi này đang mở cho người gọi không". SECURITY DEFINER vì
--    private.d4_topic_completion_state bị revoke khỏi authenticated, nên một wrapper invoker sẽ lỗi quyền.
--    Người gọi luôn lấy từ auth.uid() (không nhận user id từ client) nên chỉ lộ trạng thái của chính họ.
--    Dùng lại nguyên định nghĩa memory_check_done của D4 (G3): cùng tập câu private.d3_active_memory_questions
--    và cùng quy tắc option đang chọn còn active, thuộc đúng câu, hiện là đáp án đúng; không có bản định nghĩa thứ hai.
--    Câu thuộc memory check luôn trả lời được. Topic không có câu memory active thì memory_check_done = true.
create function private.lf2_memory_gate_open(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (select auth.uid()) is not null
      and (
        e.activity_stage = 'memory_check'
        or (select s.memory_check_done
            from private.d4_topic_completion_state((select auth.uid()), e.topic_id) s)
      )
    from public.questions q
    join public.exercises e on e.id = q.exercise_id and e.course_id = q.course_id
    where q.id = p_question_id
  ), false)
$$;

revoke all on function private.lf2_memory_gate_open(uuid) from public, anon;
grant execute on function private.lf2_memory_gate_open(uuid) to authenticated;

-- 2. AND cổng vào WITH CHECK của hai policy L1 (G5). Chỉ sửa WITH CHECK bằng ALTER POLICY nên USING,
--    vai trò, lệnh và không có policy permissive mới nào được thêm: policy permissive thứ hai sẽ được OR với L1
--    và mở lại đường vòng. SELECT không đổi nên đáp án lịch sử vẫn đọc được sau khi cổng khóa lại.
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
