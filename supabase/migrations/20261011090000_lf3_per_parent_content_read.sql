-- LF3 (PERF-RLS-001): các policy SELECT của nội dung con kiểm tra quyền đọc theo đúng một parent (topic/exercise/question)
-- thay vì join lên toàn bộ topics qua RLS của topics (planner có thể băm và seq scan mọi topic đọc được). Kết quả đọc không đổi.
-- Helper là SECURITY DEFINER, search_path rỗng, chỉ nhận id của parent và chỉ trả topic_id của parent còn hiệu lực
-- (null khi parent bị xóa mềm hoặc không tồn tại); actor luôn lấy từ auth.uid() bên trong private.q7_can_read_topic.
-- private.q7_can_read_topic được policy gọi trực tiếp, không lồng trong helper: một hàm SQL gọi lồng trong hàm khác bị
-- plan lại ở mỗi lần gọi (đo được ~0,7 ms/lần so với ~0,1 ms/lần khi gọi trực tiếp), nên helper chỉ tra topic_id.
-- Không đổi policy "Select Deleted" của staff, policy topics hay q7_can_read_topic.

-- exercises/question_groups/questions: topic của exercise còn hiệu lực.
create or replace function private.lf3_active_exercise_topic_id(p_exercise_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.topic_id
  from public.exercises e
  where e.id = p_exercise_id
    and e.removed_at is null
$$;

-- question_options: question và exercise cha còn hiệu lực, trả topic của exercise.
create or replace function private.lf3_active_question_topic_id(p_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.topic_id
  from public.questions q
  join public.exercises e on e.id = q.exercise_id
  where q.id = p_question_id
    and q.removed_at is null
    and e.removed_at is null
$$;

revoke all on function private.lf3_active_exercise_topic_id(uuid) from public, anon;
revoke all on function private.lf3_active_question_topic_id(uuid) from public, anon;
grant execute on function private.lf3_active_exercise_topic_id(uuid) to authenticated;
grant execute on function private.lf3_active_question_topic_id(uuid) to authenticated;

-- cards/exercises: q7_can_read_topic đã yêu cầu topic tồn tại, nên gọi thẳng theo topic_id thay cho exists(topics).
alter policy "Select cards credential bound" on public.cards
using (removed_at is null and private.q7_can_read_topic(topic_id));

alter policy "Select exercises credential bound" on public.exercises
using (removed_at is null and private.q7_can_read_topic(topic_id));

alter policy "Select question_groups credential bound" on public.question_groups
using (removed_at is null and private.q7_can_read_topic(private.lf3_active_exercise_topic_id(exercise_id)));

alter policy "Select questions credential bound" on public.questions
using (removed_at is null and private.q7_can_read_topic(private.lf3_active_exercise_topic_id(exercise_id)));

alter policy "Select question_options credential bound" on public.question_options
using (removed_at is null and private.q7_can_read_topic(private.lf3_active_question_topic_id(question_id)));
