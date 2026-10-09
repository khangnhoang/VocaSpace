-- LF1: giai đoạn flashcard của topic chỉ xong khi lần đánh giá GẦN NHẤT của mọi thẻ active là Ổn/Dễ
-- (LEARNING-FOLLOWUP-001, Owner Decision 25; sửa vế flashcards_done của Decision 14).
-- Contract: docs/programs/student-user-flow-route/implementation-plans/learning-followup/plan.md (G1–G3).

-- 1. Thêm cột nullable, backfill, rồi mới khóa NOT NULL + CHECK để migration chạy được trên database
--    đã có dữ liệu. Thẻ có sẵn tính là Ổn (3) tới khi học viên đánh giá lại, nên không ai mất tiến độ (AC4).
--    Không đặt DEFAULT: writer quên truyền rating sẽ bị từ chối thay vì lặng lẽ được tính là đã nhớ (G3).
alter table public.user_flashcards add column last_rating smallint;

update public.user_flashcards set last_rating = 3 where last_rating is null;

alter table public.user_flashcards alter column last_rating set not null;
alter table public.user_flashcards
  add constraint user_flashcards_last_rating_check check (last_rating between 1 and 4);

-- 2. Chỉ đổi điều kiện flashcards_done (thêm `uf.last_rating >= 3`). Chữ ký, stable, search_path rỗng và revoke
--    giữ nguyên; memory_check_done và exercises_done không đổi nên mọi khóa suy ra từ chúng không đổi (G1, G5).
create or replace function private.d4_topic_completion_state(p_user_id uuid, p_topic_id uuid)
returns table (
  flashcards_done boolean,
  memory_check_done boolean,
  exercises_done boolean,
  all_done boolean
)
language sql
stable
set search_path = ''
as $$
  with state as (
    select
      not exists (
        select 1
        from public.cards c
        where c.topic_id = p_topic_id
          and c.removed_at is null
          and not exists (
            select 1 from public.user_flashcards uf
            where uf.user_id = p_user_id and uf.card_id = c.id
              and uf.last_rating >= 3
          )
      ) as flashcards_done,
      -- Cùng tập câu với cổng D3 (`toLoadedMemoryCheck`); parity được khóa bằng test.
      not exists (
        select 1
        from private.d3_active_memory_questions(p_topic_id) q
        where not exists (
          select 1
          from public.user_question_answers a
          join public.question_options o on o.id = a.selected_option_id
          where a.user_id = p_user_id
            and a.question_id = q.id
            and o.question_id = q.id
            and o.removed_at is null
            and o.is_correct
        )
      ) as memory_check_done,
      -- Tập câu bắt buộc phải trùng tập câu workspace hiển thị (G2).
      not exists (
        select 1
        from public.topics t
        join public.exercises e
          on e.topic_id = t.id
         and e.course_id = t.course_id
         and e.activity_stage = 'exercise'
         and e.removed_at is null
        join public.questions q
          on q.exercise_id = e.id
         and q.course_id = t.course_id
         and q.removed_at is null
        where t.id = p_topic_id
          and (
            q.group_id is null
            or exists (
              select 1 from public.question_groups g
              where g.id = q.group_id
                and g.exercise_id = e.id
                and g.removed_at is null
            )
          )
          and not exists (
            select 1
            from public.user_question_answers a
            join public.question_options o on o.id = a.selected_option_id
            where a.user_id = p_user_id
              and a.question_id = q.id
              and o.question_id = q.id
              and o.removed_at is null
              and o.is_correct
          )
      ) as exercises_done
  )
  select
    s.flashcards_done,
    s.memory_check_done,
    s.exercises_done,
    s.flashcards_done and s.memory_check_done and s.exercises_done
  from state s
$$;

revoke all on function private.d4_topic_completion_state(uuid, uuid) from public, anon, authenticated;
