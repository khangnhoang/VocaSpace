-- D3: memory check chỉ gồm câu standalone (H2/G4).
-- Readiness, workflow và cổng learner chỉ đếm câu `group_id is null`; nếu staff gắn câu
-- memory check vào group qua Data API thì câu đó rơi khỏi cổng và exercises mở sai.
-- Chặn ở DB: không group nào thuộc bộ memory check, không câu memory check nào có group.
-- Contract: docs/refactors/student-user-flow-route/implementation-plans/d3/plan.md.

-- SECURITY DEFINER để đọc stage của exercise cha không phụ thuộc RLS của người ghi.
create or replace function public.d3_guard_memory_check_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.exercises e
    where e.id = new.exercise_id and e.activity_stage = 'memory_check'
  ) then
    raise exception 'MEMORY_CHECK_GROUP_NOT_ALLOWED';
  end if;
  return new;
end;
$$;

revoke all on function public.d3_guard_memory_check_group() from public;

create trigger d3_guard_question_groups_memory_check
before insert or update of exercise_id on public.question_groups
for each row execute function public.d3_guard_memory_check_group();

create or replace function public.d3_guard_memory_check_question_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is not null and exists (
    select 1 from public.exercises e
    where e.id = new.exercise_id and e.activity_stage = 'memory_check'
  ) then
    raise exception 'MEMORY_CHECK_GROUP_NOT_ALLOWED';
  end if;
  return new;
end;
$$;

revoke all on function public.d3_guard_memory_check_question_group() from public;

create trigger d3_guard_questions_memory_check_group
before insert or update of group_id, exercise_id on public.questions
for each row execute function public.d3_guard_memory_check_question_group();
