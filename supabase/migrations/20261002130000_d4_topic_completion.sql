-- D4: hoàn thành topic là sự thật do server suy ra (Owner Decision 14, PROGRESS-001).
-- Contract: docs/refactors/student-user-flow-route/implementation-plans/d4/plan.md (G1–G6, H1–H3).

-- 1. Suy ra trạng thái từ dữ liệu server (H1). Không đọc cờ stage đã lưu, không đọc
--    `user_question_answers.is_correct` (learner ghi được cột này qua Data API).
--    "Đúng" = option đang chọn còn active, thuộc đúng câu và hiện có is_correct (G3).
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

-- 2. Đồng bộ dòng progress của chính người gọi (H2). SECURITY DEFINER vì learner không còn
--    policy ghi trên user_topic_progress; search_path rỗng và mọi object đều ghi rõ schema.
create or replace function public.d4_sync_topic_progress(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_was_completed boolean;
  v_completed_at timestamptz;
  v_state record;
  v_is_completed boolean;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  -- Dùng lại read boundary Q7, cộng điều kiện của learner: helper Q7 cho admin hoặc
  -- collaborator đọc topic draft, nhưng chỉ topic đang publish mới tính tiến độ.
  if not private.q7_can_read_topic(p_topic_id)
    or not exists (
      select 1
      from public.topics t
      join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id
      join public.courses c on c.id = t.course_id
      where t.id = p_topic_id
        and t.status = 'published'::public.item_status
        and t.removed_at is null
        and ch.removed_at is null
        and c.status = 'published'::public.item_status
        and c.removed_at is null
    )
  then
    raise exception 'TOPIC_UNAVAILABLE';
  end if;

  if not private.q7_has_learning_target_enrollment('topic', p_topic_id) then
    raise exception 'ENROLLMENT_REQUIRED';
  end if;

  -- Bảo đảm có dòng rồi khóa nó: giá trị cũ đọc dưới row lock nên hai lần sync đồng thời
  -- không thể cùng báo newly_completed, và trạng thái được suy ra sau khi đã có khóa.
  insert into public.user_topic_progress (user_id, topic_id)
  values (v_user_id, p_topic_id)
  on conflict (user_id, topic_id) do nothing;

  select coalesce(p.is_topic_completed, false), p.completed_at
  into v_was_completed, v_completed_at
  from public.user_topic_progress p
  where p.user_id = v_user_id and p.topic_id = p_topic_id
  for update;

  select * into v_state from private.d4_topic_completion_state(v_user_id, p_topic_id);

  -- Hoàn thành không bao giờ bị hạ (G4); cờ stage luôn là snapshot hiện tại.
  v_is_completed := v_was_completed or v_state.all_done;

  update public.user_topic_progress p
  set
    is_flashcard_completed = v_state.flashcards_done,
    is_exercise_completed = v_state.exercises_done,
    is_topic_completed = v_is_completed,
    -- Giữ mốc cũ; chỉ đóng dấu now() khi snapshot hiện tại thật sự hoàn thành (H2).
    completed_at = coalesce(v_completed_at, case when v_state.all_done then now() end),
    updated_at = now()
  where p.user_id = v_user_id and p.topic_id = p_topic_id;

  return jsonb_build_object(
    'is_flashcard_completed', v_state.flashcards_done,
    'is_memory_check_passed', v_state.memory_check_done,
    'is_exercise_completed', v_state.exercises_done,
    'is_topic_completed', v_is_completed,
    'newly_completed', v_is_completed and not v_was_completed
  );
end;
$$;

revoke all on function public.d4_sync_topic_progress(uuid) from public, anon;
grant execute on function public.d4_sync_topic_progress(uuid) to authenticated;

-- 3. Learner không còn ghi thẳng user_topic_progress (G5, Owner decision 5). SELECT
--    self-owner giữ nguyên; không có policy DELETE như trước. Chỉ RPC ở trên được ghi.
drop policy if exists "User_progress - Auth Insert" on public.user_topic_progress;
drop policy if exists "User_progress - Auth Update" on public.user_topic_progress;
