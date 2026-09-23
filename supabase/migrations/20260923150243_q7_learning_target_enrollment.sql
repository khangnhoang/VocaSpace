-- Q7: learner-state write requires enrollment for the target object's course.
-- This helper deliberately does not consult topic/content read RLS or status.
create or replace function private.q7_has_learning_target_enrollment(
  p_target_kind text,
  p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and case p_target_kind
      when 'topic' then exists (
        select 1 from public.topics t
        join public.enrollments e on e.course_id = t.course_id
        where t.id = p_target_id and e.user_id = (select auth.uid())
      )
      when 'question' then exists (
        select 1 from public.questions q
        join public.enrollments e on e.course_id = q.course_id
        where q.id = p_target_id and e.user_id = (select auth.uid())
      )
      when 'card' then exists (
        select 1 from public.cards c
        join public.topics t on t.id = c.topic_id
        join public.enrollments e on e.course_id = t.course_id
        where c.id = p_target_id and e.user_id = (select auth.uid())
      )
      else false
    end
$$;

revoke all on function private.q7_has_learning_target_enrollment(text, uuid)
  from public, anon;
grant execute on function private.q7_has_learning_target_enrollment(text, uuid)
  to authenticated;

drop policy if exists "User_progress - Auth Insert" on public.user_topic_progress;
create policy "User_progress - Auth Insert" on public.user_topic_progress
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('topic', topic_id)
);

drop policy if exists "User_progress - Auth Update" on public.user_topic_progress;
create policy "User_progress - Auth Update" on public.user_topic_progress
for update to authenticated
using (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('topic', topic_id)
)
with check (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('topic', topic_id)
);

drop policy if exists "User_answers - Auth Insert" on public.user_question_answers;
create policy "User_answers - Auth Insert" on public.user_question_answers
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('question', question_id)
);

drop policy if exists "User_answers - Auth Update" on public.user_question_answers;
create policy "User_answers - Auth Update" on public.user_question_answers
for update to authenticated
using (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('question', question_id)
)
with check (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('question', question_id)
);

drop policy if exists "User_flashcards - Auth Insert" on public.user_flashcards;
create policy "User_flashcards - Auth Insert" on public.user_flashcards
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('card', card_id)
);

drop policy if exists "User_flashcards - Auth Update" on public.user_flashcards;
create policy "User_flashcards - Auth Update" on public.user_flashcards
for update to authenticated
using (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('card', card_id)
)
with check (
  (select auth.uid()) = user_id
  and private.q7_has_learning_target_enrollment('card', card_id)
);
