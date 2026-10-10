-- Rollback của 20261010120000_lf2_memory_check_answer_gate.sql: trả hai policy về định nghĩa L1
-- (20261008130544_l1_learner_integrity.sql) rồi mới bỏ helper mà policy đang gọi.
-- Không nằm trong supabase/migrations nên Supabase CLI không tự áp dụng; chạy thủ công khi cần quay lui.
alter policy "User_answers - Auth Insert" on public.user_question_answers
with check (
  (select auth.uid()) = user_id
  and private.l1_can_write_learning_target('question', question_id)
  and exists (select 1 from public.question_options o
    where o.id = selected_option_id and o.question_id = user_question_answers.question_id and o.removed_at is null)
);

alter policy "User_answers - Auth Update" on public.user_question_answers
with check (
  (select auth.uid()) = user_id and private.l1_can_write_learning_target('question', question_id)
  and exists (select 1 from public.question_options o
    where o.id = selected_option_id and o.question_id = user_question_answers.question_id and o.removed_at is null)
);

drop function private.lf2_memory_gate_open(uuid);
