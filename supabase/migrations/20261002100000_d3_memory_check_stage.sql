-- D3: memory check là một activity stage riêng của exercises.
-- Owner Decision 15 (sửa đổi 2026-10-02: tùy chọn theo topic), Decision 16 và MEMORY-001:
-- stage không được mã hóa vào `part_type`; memory check không mang TOEIC part.
-- Contract: docs/refactors/student-user-flow-route/implementation-plans/d3/plan.md.

-- 1. Stage và ghép đôi với part_type (G1). Row cũ nhận 'exercise' nhờ default và
--    đều có part_type not null, nên check ghép đôi hợp lệ với dữ liệu hiện có.
alter table public.exercises
  add column activity_stage text not null default 'exercise';

alter table public.exercises
  add constraint exercises_activity_stage_check
  check (activity_stage in ('exercise', 'memory_check'));

alter table public.exercises
  alter column part_type drop not null;

alter table public.exercises
  add constraint exercises_stage_part_type_check
  check (
    (activity_stage = 'exercise' and part_type is not null)
    or (activity_stage = 'memory_check' and part_type is null)
  );

-- 2. Tối đa một bộ memory check active cho mỗi topic (G5).
create unique index exercises_one_active_memory_check_per_topic
  on public.exercises (topic_id)
  where activity_stage = 'memory_check' and removed_at is null;

-- 3. Stage không đổi sau khi tạo: đổi stage trên row có sẵn sẽ biến nội dung exercise
--    thành cổng khóa của learner (hoặc ngược lại) mà không qua luồng authoring D3.
create or replace function public.d3_guard_exercise_activity_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.activity_stage is distinct from old.activity_stage then
    raise exception 'EXERCISE_ACTIVITY_STAGE_IMMUTABLE';
  end if;
  return new;
end;
$$;

revoke all on function public.d3_guard_exercise_activity_stage() from public;

create trigger d3_guard_exercises_activity_stage
before update of activity_stage on public.exercises
for each row execute function public.d3_guard_exercise_activity_stage();

-- 4. Câu memory check active: câu standalone, active, thuộc bộ memory check active của topic.
--    Một định nghĩa duy nhất cho readiness và workflow read; Server Action learner dùng
--    cùng predicate (group_id null) ở phía ứng dụng.
create or replace function private.d3_active_memory_questions(p_topic_id uuid)
returns setof public.questions
language sql
stable
set search_path = public
as $$
  select q.*
  from public.questions q
  join public.exercises e on e.id = q.exercise_id
  where e.topic_id = p_topic_id
    and e.activity_stage = 'memory_check'
    and e.removed_at is null
    and q.removed_at is null
    and q.group_id is null
$$;

-- Topic không có memory check vẫn "ready": stage là tùy chọn (Decision 15 sửa đổi).
create or replace function private.d3_memory_check_ready(p_topic_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select not exists (
    select 1
    from private.d3_active_memory_questions(p_topic_id) q
    where (
        select count(*) from public.question_options o
        where o.question_id = q.id and o.removed_at is null
      ) < 2
      or not exists (
        select 1 from public.question_options o
        where o.question_id = q.id and o.removed_at is null and o.is_correct
      )
  )
$$;

revoke all on function private.d3_active_memory_questions(uuid) from public, anon, authenticated;
revoke all on function private.d3_memory_check_ready(uuid) from public, anon, authenticated;
grant execute on function private.d3_active_memory_questions(uuid) to service_role;
grant execute on function private.d3_memory_check_ready(uuid) to service_role;

-- 5. Review readiness: memory check không bao giờ thỏa yêu cầu exercise (G2) và
--    mọi câu memory check active phải trả lời được trước khi rời draft (G4).
--    Thân hàm sao chép nguyên bản mới nhất, chỉ đổi phần readiness.
create or replace function public.request_topic_review(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_topic public.topics%rowtype;
  v_card_count integer;
  v_exercise_count integer;
  v_attempt_number integer;
  v_submission public.topic_review_submissions%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select t.course_id into v_topic.course_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));

  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if v_topic.removed_at is not null then raise exception 'TOPIC_REMOVED'; end if;
  if v_topic.status <> 'draft'::public.item_status then raise exception 'TOPIC_NOT_DRAFT'; end if;
  if not public.d1_topic_group_member(p_topic_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_user_id not in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id) then
    raise exception 'TOPIC_AUTHOR_SUBMIT_REQUIRED';
  end if;
  if exists (
    select 1 from public.topic_review_submissions s
    where s.topic_id = p_topic_id and s.status = 'pending'::public.topic_review_submission_status
  ) then raise exception 'TOPIC_REVIEW_ALREADY_PENDING'; end if;

  select count(*) into v_card_count from public.cards c where c.topic_id = p_topic_id and c.removed_at is null;
  select count(*) into v_exercise_count from public.exercises e
  where e.topic_id = p_topic_id and e.removed_at is null and e.activity_stage = 'exercise';
  if v_card_count < 1 or v_exercise_count < 1 then
    raise exception using message = 'TOPIC_REVIEW_NOT_READY', detail = format('active_flashcards=%s active_exercises=%s', v_card_count, v_exercise_count);
  end if;
  if not private.d3_memory_check_ready(p_topic_id) then
    raise exception 'TOPIC_MEMORY_CHECK_NOT_READY';
  end if;
  if not public.d1_has_eligible_topic_reviewer(p_topic_id, v_user_id) then
    raise exception 'TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER';
  end if;

  select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number
  from public.topic_review_submissions s
  where s.topic_id = p_topic_id and s.submitted_by_user_id = v_user_id;
  insert into public.topic_review_submissions (topic_id, submitted_by_user_id, status, attempt_number)
  values (p_topic_id, v_user_id, 'pending', v_attempt_number)
  returning * into v_submission;

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'pending' where id = p_topic_id;
  return jsonb_build_object(
    'status', 'pending', 'course_id', v_topic.course_id, 'topic_id', p_topic_id,
    'submission_id', v_submission.id, 'attempt_number', v_attempt_number,
    'active_flashcard_count', v_card_count, 'active_exercise_count', v_exercise_count
  );
end;
$$;

create or replace function public.approve_topic_review(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.topic_review_submissions%rowtype;
  v_topic public.topics%rowtype;
  v_course_id uuid;
  v_card_count integer;
  v_exercise_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select public.d1_review_submission_course_id(p_submission_id) into v_course_id;
  if v_course_id is null then raise exception 'TOPIC_REVIEW_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));

  select * into v_submission from public.topic_review_submissions s
  where s.id = p_submission_id for update;
  if not found then raise exception 'TOPIC_REVIEW_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_submission.topic_id::text));
  select * into v_topic from public.topics t
  where t.id = v_submission.topic_id for update;
  if not found or v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;
  if v_submission.status <> 'pending' or v_topic.status <> 'pending' then
    raise exception 'TOPIC_REVIEW_STALE';
  end if;
  if v_submission.submitted_by_user_id = v_user_id then raise exception 'TOPIC_REVIEW_SELF_REVIEW'; end if;
  if not public.has_topic_review_access(v_topic.id) then raise exception 'TOPIC_REVIEW_FORBIDDEN'; end if;

  select count(*) into v_card_count from public.cards c
  where c.topic_id = v_topic.id and c.removed_at is null;
  select count(*) into v_exercise_count from public.exercises e
  where e.topic_id = v_topic.id and e.removed_at is null and e.activity_stage = 'exercise';
  if v_card_count < 1 or v_exercise_count < 1 then raise exception 'TOPIC_REVIEW_NOT_READY'; end if;
  if not private.d3_memory_check_ready(v_topic.id) then raise exception 'TOPIC_MEMORY_CHECK_NOT_READY'; end if;

  update public.topic_review_submissions
  set status = 'approved', reviewed_by_user_id = v_user_id, reviewed_at = now()
  where id = v_submission.id;
  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'published' where id = v_topic.id;

  return jsonb_build_object('status', 'published', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'submission_id', v_submission.id);
end;
$$;

-- Q7 đã chuyển hàm này sang schema private; wrapper public giữ nguyên.
create or replace function private.get_topic_workflow_state(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_topic public.topics%rowtype;
  v_role public.course_member_role;
  v_can_edit boolean := false;
  v_can_review boolean := false;
  v_can_delete boolean := false;
  v_can_withdraw boolean := false;
  v_card_count integer := 0;
  v_exercise_count integer := 0;
  v_memory_question_count integer := 0;
  v_memory_ready boolean := true;
  v_pending public.topic_review_submissions%rowtype;
  v_rejection_history jsonb := '[]'::jsonb;
  v_has_distinct_reviewer boolean := false;
  v_original_creator jsonb;
  v_responsible_author jsonb;
  v_contributors jsonb := '[]'::jsonb;
  v_latest_authorship_feedback jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select t.* into v_topic
  from public.topics t
  join public.chapters ch on ch.id = t.chapter_id
  join public.courses c on c.id = t.course_id
  where t.id = p_topic_id
    and t.removed_at is null
    and ch.removed_at is null
    and ch.course_id = t.course_id
    and c.removed_at is null;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;

  select cc.role into v_role
  from public.course_collaborators cc
  join public.profiles p on p.id = cc.user_id
  where cc.course_id = v_topic.course_id
    and cc.user_id = v_user_id
    and p.removed_at is null;
  if not found then raise exception 'TOPIC_WORKFLOW_FORBIDDEN'; end if;

  v_can_edit := public.d1_topic_group_member(v_topic.id);
  v_can_review := public.has_topic_review_access(v_topic.id);
  v_can_delete := public.d1_can_delete_topic(v_topic.id);
  v_has_distinct_reviewer := public.d1_has_eligible_topic_reviewer(v_topic.id, v_user_id);

  select count(*) into v_card_count
  from public.cards c where c.topic_id = v_topic.id and c.removed_at is null;
  select count(*) into v_exercise_count
  from public.exercises e where e.topic_id = v_topic.id and e.removed_at is null and e.activity_stage = 'exercise';
  select count(*) into v_memory_question_count
  from private.d3_active_memory_questions(v_topic.id);
  v_memory_ready := private.d3_memory_check_ready(v_topic.id);

  select * into v_pending
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id and s.status = 'pending'
  order by s.submitted_at desc, s.id desc
  limit 1;

  -- D30/D34: withdrawing is a distinct capability from requesting, and it is
  -- limited to the creator and the current responsible author.
  v_can_withdraw := v_can_edit
    and v_topic.status = 'pending'
    and v_pending.id is not null
    and v_user_id in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id);

  -- Lịch sử từ chối tính theo TOPIC, không theo người gửi: mọi caller đọc cùng
  -- một canonical state. `index` do server cấp (1-based, cũ -> mới).
  select coalesce(jsonb_agg(jsonb_build_object(
           'index', r.rn,
           'reason', r.rejection_reason,
           'reviewer', r.reviewer,
           'reviewedAt', r.reviewed_at
         ) order by r.rn), '[]'::jsonb)
  into v_rejection_history
  from (
    select s.rejection_reason, s.reviewed_at,
           row_number() over (order by s.reviewed_at asc, s.id asc) as rn,
           case when s.reviewed_by_user_id is null then null else (
             select jsonb_build_object(
               'userId', p.id,
               'fullName', p.full_name,
               'email', p.email,
               'avatarUrl', p.avatar_url
             )
             from public.profiles p
             where p.id = s.reviewed_by_user_id
           ) end as reviewer
    from public.topic_review_submissions s
    where s.topic_id = v_topic.id
      and s.status = 'rejected'
  ) r;

  select jsonb_build_object(
    'userId', p.id, 'fullName', p.full_name, 'email', p.email, 'avatarUrl', p.avatar_url
  ) into v_original_creator
  from public.profiles p where p.id = v_topic.original_creator_user_id;

  select jsonb_build_object(
    'userId', p.id, 'fullName', p.full_name, 'email', p.email, 'avatarUrl', p.avatar_url
  ) into v_responsible_author
  from public.profiles p where p.id = v_topic.responsible_author_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', tc.id, 'userId', p.id, 'fullName', p.full_name, 'email', p.email, 'avatarUrl', p.avatar_url
  ) order by tc.created_at, tc.id), '[]'::jsonb) into v_contributors
  from public.topic_contributors tc
  left join public.profiles p on p.id = tc.user_id
  where tc.topic_id = v_topic.id and tc.removed_at is null;

  select jsonb_build_object(
    'id', f.id,
    'actorUserId', f.actor_user_id,
    'previousResponsibleUserId', f.previous_responsible_user_id,
    'newResponsibleUserId', f.new_responsible_user_id,
    'feedbackType', f.feedback_type,
    'createdAt', f.created_at
  ) into v_latest_authorship_feedback
  from public.topic_authorship_feedback f
  where f.topic_id = v_topic.id and f.recipient_user_id = v_user_id
  order by f.created_at desc, f.id desc
  limit 1;

  return jsonb_build_object(
    'topicId', v_topic.id,
    'courseId', v_topic.course_id,
    'chapterId', v_topic.chapter_id,
    'title', v_topic.title,
    'status', v_topic.status,
    'role', v_role,
    'canEdit', v_can_edit,
    'canReview', v_can_review,
    'canRequestReview', v_can_edit
      and v_topic.status = 'draft'
      and v_user_id in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id)
      and v_card_count > 0
      and v_exercise_count > 0
      and v_memory_ready
      and v_has_distinct_reviewer,
    'canWithdrawReview', v_can_withdraw,
    'canDeleteTopic', v_can_delete,
    'activeFlashcardCount', v_card_count,
    'activeExerciseCount', v_exercise_count,
    'activeMemoryCheckQuestionCount', v_memory_question_count,
    'isMemoryCheckReady', v_memory_ready,
    'isReady', v_card_count > 0 and v_exercise_count > 0 and v_memory_ready,
    'pendingSubmissionId', v_pending.id,
    'pendingSubmitterId', v_pending.submitted_by_user_id,
    'isCurrentUserSubmitter', coalesce(v_pending.submitted_by_user_id = v_user_id, false),
    -- Ẩn lịch sử khi topic đã published: giữ nguyên hành vi cũ.
    'rejectionCount', case when v_topic.status = 'published' then 0 else jsonb_array_length(v_rejection_history) end,
    'rejectionHistory', case when v_topic.status = 'published' then '[]'::jsonb else v_rejection_history end,
    'hasDistinctEligibleReviewer', v_has_distinct_reviewer,
    'originalCreator', v_original_creator,
    'responsibleAuthor', v_responsible_author,
    'contributors', v_contributors,
    'canManageAuthorship', v_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role),
    'isCurrentUserResponsible', v_topic.responsible_author_user_id = v_user_id,
    'isCurrentUserContributor', exists (
      select 1 from public.topic_contributors tc
      where tc.topic_id = v_topic.id and tc.user_id = v_user_id and tc.removed_at is null
    ),
    'latestAuthorshipFeedback', v_latest_authorship_feedback
  );
end;
$$;

-- 6. Thêm một câu vào bộ memory check của topic; tạo bộ nếu chưa có.
--    `create_exercise_with_content` luôn tạo exercise mới và `sync_question_with_options`
--    chỉ sửa câu đã có, nên không có đường ghi nào khác để thêm câu vào bộ hiện hữu.
--    Authority, khóa, pending freeze và hạ published về draft đều do
--    `d1_prepare_topic_content_mutation` xử lý trong cùng transaction với phần ghi.
create or replace function public.d3_add_memory_check_question(
  p_topic_id uuid,
  p_question jsonb,
  p_confirm_published boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.item_status;
  v_course_id uuid;
  v_exercise_id uuid;
  v_created boolean := false;
  v_question_id uuid;
  v_question_order integer;
  v_content text;
  v_option jsonb;
  v_option_content text;
  v_option_order integer := 0;
  v_clean_option_count integer;
  v_correct_option_count integer;
  v_label text;
  v_label_index integer;
begin
  v_status := public.d1_prepare_topic_content_mutation(p_topic_id, p_confirm_published);

  if jsonb_typeof(p_question) is distinct from 'object'
    or jsonb_typeof(coalesce(p_question->'options', '[]'::jsonb)) <> 'array' then
    raise exception 'QUESTION_PAYLOAD_INVALID';
  end if;

  v_content := nullif(btrim(coalesce(p_question->>'content', '')), '');
  if v_content is null then
    raise exception 'QUESTION_CONTENT_REQUIRED';
  end if;

  select count(*), count(*) filter (where coalesce((value->>'is_correct')::boolean, false))
  into v_clean_option_count, v_correct_option_count
  from jsonb_array_elements(coalesce(p_question->'options', '[]'::jsonb))
  where nullif(btrim(coalesce(value->>'content', '')), '') is not null;

  if v_clean_option_count < 2 then
    raise exception 'QUESTION_REQUIRES_TWO_OPTIONS';
  end if;
  if v_correct_option_count < 1 then
    raise exception 'QUESTION_REQUIRES_CORRECT_OPTION';
  end if;

  select t.course_id into v_course_id from public.topics t where t.id = p_topic_id;

  select e.id into v_exercise_id
  from public.exercises e
  where e.topic_id = p_topic_id
    and e.activity_stage = 'memory_check'
    and e.removed_at is null
  for update;

  if v_exercise_id is null then
    insert into public.exercises (topic_id, course_id, title, part_type, activity_stage, order_index)
    values (p_topic_id, v_course_id, 'Memory check', null, 'memory_check', 0)
    returning id into v_exercise_id;
    v_created := true;
  end if;

  select coalesce(max(q.order_index), 0) + 1
  into v_question_order
  from public.questions q
  where q.exercise_id = v_exercise_id and q.removed_at is null;

  insert into public.questions (group_id, exercise_id, course_id, content, explanation, order_index)
  values (
    null,
    v_exercise_id,
    v_course_id,
    v_content,
    nullif(btrim(coalesce(p_question->>'explanation', '')), ''),
    v_question_order
  )
  returning id into v_question_id;

  for v_option in
    select value from jsonb_array_elements(coalesce(p_question->'options', '[]'::jsonb))
  loop
    v_option_content := nullif(btrim(coalesce(v_option->>'content', '')), '');
    continue when v_option_content is null;

    v_label := '';
    v_label_index := v_option_order;
    loop
      v_label := chr(65 + (v_label_index % 26)) || v_label;
      v_label_index := floor(v_label_index / 26)::integer - 1;
      exit when v_label_index < 0;
    end loop;

    insert into public.question_options (question_id, content, label, is_correct, order_index)
    values (
      v_question_id,
      v_option_content,
      v_label,
      coalesce((v_option->>'is_correct')::boolean, false),
      v_option_order
    );
    v_option_order := v_option_order + 1;
  end loop;

  return jsonb_build_object(
    'exercise_id', v_exercise_id,
    'question_id', v_question_id,
    'created_memory_check', v_created,
    'topic_status', v_status
  );
end;
$$;

revoke all on function public.d3_add_memory_check_question(uuid, jsonb, boolean) from public, anon;
grant execute on function public.d3_add_memory_check_question(uuid, jsonb, boolean) to authenticated, service_role;
