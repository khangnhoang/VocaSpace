create or replace function public.has_course_topic_read_access(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    join public.course_collaborators cc on cc.course_id = c.id
    join public.profiles p on p.id = cc.user_id
    where c.id = target_course_id
      and c.removed_at is null
      and p.removed_at is null
      and cc.user_id = auth.uid()
  );
$$;

revoke all on function public.has_course_topic_read_access(uuid) from public, anon;
grant execute on function public.has_course_topic_read_access(uuid) to authenticated, service_role;

create or replace function public.get_topic_workflow_state(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_topic public.topics%rowtype;
  v_role public.course_member_role;
  v_can_review boolean := false;
  v_can_edit boolean := false;
  v_card_count integer := 0;
  v_exercise_count integer := 0;
  v_pending public.topic_review_submissions%rowtype;
  v_latest_rejection public.topic_review_submissions%rowtype;
  v_rejection_count integer := 0;
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

  select cc.role, cc.can_review_topics
    into v_role, v_can_review
  from public.course_collaborators cc
  join public.profiles p on p.id = cc.user_id
  where cc.course_id = v_topic.course_id
    and cc.user_id = v_user_id
    and p.removed_at is null;
  if not found then raise exception 'TOPIC_WORKFLOW_FORBIDDEN'; end if;

  v_can_edit := v_role in (
    'owner'::public.course_member_role,
    'co_owner'::public.course_member_role,
    'editor'::public.course_member_role
  );
  v_can_review := v_role in (
    'owner'::public.course_member_role,
    'co_owner'::public.course_member_role
  ) or (
    v_role in (
      'editor'::public.course_member_role,
      'previewer'::public.course_member_role
    ) and v_can_review
  );

  select count(*) into v_card_count
  from public.cards c
  where c.topic_id = v_topic.id and c.removed_at is null;
  select count(*) into v_exercise_count
  from public.exercises e
  where e.topic_id = v_topic.id and e.removed_at is null;

  select * into v_pending
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id and s.status = 'pending'
  order by s.submitted_at desc, s.id desc
  limit 1;

  select * into v_latest_rejection
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id
    and s.submitted_by_user_id = v_user_id
    and s.status = 'rejected'
  order by s.reviewed_at desc nulls last, s.id desc
  limit 1;

  select count(*) into v_rejection_count
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id
    and s.status = 'rejected';

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
      and v_card_count > 0
      and v_exercise_count > 0,
    'activeFlashcardCount', v_card_count,
    'activeExerciseCount', v_exercise_count,
    'isReady', v_card_count > 0 and v_exercise_count > 0,
    'pendingSubmissionId', v_pending.id,
    'pendingSubmitterId', v_pending.submitted_by_user_id,
    'isCurrentUserSubmitter', coalesce(v_pending.submitted_by_user_id = v_user_id, false),
    'latestRejectionReason', v_latest_rejection.rejection_reason,
    'rejectionCount', coalesce(v_rejection_count, 0)
  );
end;
$$;

revoke all on function public.get_topic_workflow_state(uuid) from public, anon;
grant execute on function public.get_topic_workflow_state(uuid) to authenticated, service_role;
