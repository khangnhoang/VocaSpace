-- Rollback của 20261011090000_lf3_per_parent_content_read.sql: trả năm policy về định nghĩa Q7
-- (20260923143029_q7_topic_read_and_private_media.sql) rồi mới bỏ hai helper mà policy đang gọi.
-- Không nằm trong supabase/migrations nên Supabase CLI không tự áp dụng; chạy thủ công khi cần quay lui.
alter policy "Select cards credential bound" on public.cards
using (
  removed_at is null
  and exists (
    select 1 from public.topics t
    where t.id = cards.topic_id and private.q7_can_read_topic(t.id)
  )
);

alter policy "Select exercises credential bound" on public.exercises
using (
  removed_at is null
  and exists (
    select 1 from public.topics t
    where t.id = exercises.topic_id and private.q7_can_read_topic(t.id)
  )
);

alter policy "Select question_groups credential bound" on public.question_groups
using (
  removed_at is null
  and exists (
    select 1 from public.exercises e
    join public.topics t on t.id = e.topic_id
    where e.id = question_groups.exercise_id
      and e.removed_at is null
      and private.q7_can_read_topic(t.id)
  )
);

alter policy "Select questions credential bound" on public.questions
using (
  removed_at is null
  and exists (
    select 1 from public.exercises e
    join public.topics t on t.id = e.topic_id
    where e.id = questions.exercise_id
      and e.removed_at is null
      and private.q7_can_read_topic(t.id)
  )
);

alter policy "Select question_options credential bound" on public.question_options
using (
  removed_at is null
  and exists (
    select 1 from public.questions q
    join public.exercises e on e.id = q.exercise_id
    join public.topics t on t.id = e.topic_id
    where q.id = question_options.question_id
      and q.removed_at is null
      and e.removed_at is null
      and private.q7_can_read_topic(t.id)
  )
);

drop function private.lf3_active_question_topic_id(uuid);
drop function private.lf3_active_exercise_topic_id(uuid);
