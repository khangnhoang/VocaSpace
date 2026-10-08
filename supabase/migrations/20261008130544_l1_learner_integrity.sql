-- Không sửa hay xóa lịch sử để vượt qua ràng buộc mới; dữ liệu lệch phải chặn rollout.
do $$
begin
  if exists (
    select 1 from public.topics t join public.chapters ch on ch.id = t.chapter_id
    where t.course_id is distinct from ch.course_id
  ) or exists (
    select 1 from public.exercises e join public.topics t on t.id = e.topic_id
    where e.course_id is distinct from t.course_id
  ) or exists (
    select 1 from public.questions q join public.exercises e on e.id = q.exercise_id
    where q.course_id is distinct from e.course_id
  ) or exists (
    select 1 from public.questions q join public.question_groups g on g.id = q.group_id
    where q.exercise_id is distinct from g.exercise_id
  ) or exists (
    select 1 from public.user_question_answers a join public.question_options o on o.id = a.selected_option_id
    where a.question_id is distinct from o.question_id
  ) then
    raise exception 'L1_INVALID_EXISTING_RELATIONS';
  end if;
end
$$;

alter table public.chapters add constraint chapters_id_course_id_key unique (id, course_id);
alter table public.topics add constraint topics_id_course_id_key unique (id, course_id);
alter table public.exercises add constraint exercises_id_course_id_key unique (id, course_id);
alter table public.question_groups add constraint question_groups_id_exercise_id_key unique (id, exercise_id);
alter table public.question_options add constraint question_options_id_question_id_key unique (id, question_id);

-- Giữ tên và hành vi xóa của FK cũ, tránh tạo hai quan hệ khiến PostgREST không phân giải được embed.
alter table public.topics drop constraint topics_chapter_id_fkey;
alter table public.topics add constraint topics_chapter_id_fkey
  foreign key (chapter_id, course_id) references public.chapters (id, course_id) on delete cascade;
alter table public.exercises drop constraint exercises_topic_id_fkey;
alter table public.exercises add constraint exercises_topic_id_fkey
  foreign key (topic_id, course_id) references public.topics (id, course_id) on delete cascade;
alter table public.questions drop constraint q_exercise_id_fkey;
alter table public.questions add constraint q_exercise_id_fkey
  foreign key (exercise_id, course_id) references public.exercises (id, course_id) on delete cascade;
alter table public.questions drop constraint q_group_id_fkey;
alter table public.questions add constraint q_group_id_fkey
  foreign key (group_id, exercise_id) references public.question_groups (id, exercise_id) on delete cascade;
alter table public.user_question_answers drop constraint uqa_option_id_fkey;
alter table public.user_question_answers add constraint uqa_option_id_fkey
  foreign key (selected_option_id, question_id) references public.question_options (id, question_id);

-- Chỉ đọc metadata để kiểm tra quyền ghi; Q7 vẫn sở hữu enrollment và quyền đọc lịch sử không đổi.
create function private.l1_can_write_learning_target(p_target_kind text, p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.q7_has_learning_target_enrollment(p_target_kind, p_target_id)
    and exists (
      select 1 from public.topics t
      join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id
      join public.courses c on c.id = t.course_id
      join public.profiles p on p.id = (select auth.uid()) and p.removed_at is null
      where t.removed_at is null and ch.removed_at is null and c.removed_at is null
        and t.status = 'published'::public.item_status and c.status = 'published'::public.item_status
        and (
          (p_target_kind = 'card' and exists (
            select 1 from public.cards card
            where card.id = p_target_id and card.topic_id = t.id and card.removed_at is null
          )) or (p_target_kind = 'question' and exists (
            select 1 from public.questions q
            join public.exercises e on e.id = q.exercise_id and e.course_id = q.course_id
            where q.id = p_target_id and e.topic_id = t.id and e.course_id = t.course_id
              and q.removed_at is null and e.removed_at is null
              and (q.group_id is null or exists (
                select 1 from public.question_groups g
                where g.id = q.group_id and g.exercise_id = e.id and g.removed_at is null
              ))
          ))
        )
    )
$$;

revoke all on function private.l1_can_write_learning_target(text, uuid) from public, anon;
grant execute on function private.l1_can_write_learning_target(text, uuid) to authenticated;

-- Snapshot của lần trả lời: đọc theo quyền invoker, không cập nhật lịch sử khi tác giả đổi đáp án.
create function private.l1_derive_answer_correctness()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select coalesce(o.is_correct, false) into new.is_correct
  from public.question_options o
  where o.id = new.selected_option_id and o.question_id = new.question_id;
  if not found then
    raise exception 'L1_OPTION_UNAVAILABLE' using errcode = '23503';
  end if;
  return new;
end
$$;
revoke all on function private.l1_derive_answer_correctness() from public, anon, authenticated;
create trigger l1_answer_correctness before insert or update on public.user_question_answers
for each row execute function private.l1_derive_answer_correctness();

drop policy "User_answers - Auth Insert" on public.user_question_answers;
create policy "User_answers - Auth Insert" on public.user_question_answers
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and private.l1_can_write_learning_target('question', question_id)
  and exists (select 1 from public.question_options o
    where o.id = selected_option_id and o.question_id = user_question_answers.question_id and o.removed_at is null)
);
drop policy "User_answers - Auth Update" on public.user_question_answers;
create policy "User_answers - Auth Update" on public.user_question_answers
for update to authenticated
using ((select auth.uid()) = user_id and private.l1_can_write_learning_target('question', question_id))
with check (
  (select auth.uid()) = user_id and private.l1_can_write_learning_target('question', question_id)
  and exists (select 1 from public.question_options o
    where o.id = selected_option_id and o.question_id = user_question_answers.question_id and o.removed_at is null)
);
drop policy "User_flashcards - Auth Insert" on public.user_flashcards;
create policy "User_flashcards - Auth Insert" on public.user_flashcards
for insert to authenticated with check (
  (select auth.uid()) = user_id and private.l1_can_write_learning_target('card', card_id)
);
drop policy "User_flashcards - Auth Update" on public.user_flashcards;
create policy "User_flashcards - Auth Update" on public.user_flashcards
for update to authenticated
using ((select auth.uid()) = user_id and private.l1_can_write_learning_target('card', card_id))
with check ((select auth.uid()) = user_id and private.l1_can_write_learning_target('card', card_id));
