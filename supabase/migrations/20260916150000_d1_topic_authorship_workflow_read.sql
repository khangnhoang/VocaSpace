-- D1 P3-A: expose the topic authorship group through the existing trusted workflow read boundary.
-- The recipient-scoped feedback field is intentionally read-only; all mutations remain
-- owned by the P1 topic-authorship RPCs.

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
  v_can_edit boolean := false;
  v_can_review boolean := false;
  v_card_count integer := 0;
  v_exercise_count integer := 0;
  v_pending public.topic_review_submissions%rowtype;
  v_latest_rejection public.topic_review_submissions%rowtype;
  v_rejection_count integer := 0;
  v_escalation public.topic_review_escalations%rowtype;
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
  v_has_distinct_reviewer := public.d1_has_eligible_topic_reviewer(v_topic.id, v_user_id);

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

  select * into v_escalation
  from public.topic_review_escalations e
  where e.topic_id = v_topic.id and e.unresolved
  order by e.updated_at desc, e.id desc
  limit 1;

  select count(*) into v_rejection_count
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id
    and s.submitted_by_user_id = v_user_id
    and s.status = 'rejected';

  select jsonb_build_object(
    'userId', p.id,
    'fullName', p.full_name,
    'email', p.email,
    'avatarUrl', p.avatar_url
  ) into v_original_creator
  from public.profiles p
  where p.id = v_topic.original_creator_user_id;

  select jsonb_build_object(
    'userId', p.id,
    'fullName', p.full_name,
    'email', p.email,
    'avatarUrl', p.avatar_url
  ) into v_responsible_author
  from public.profiles p
  where p.id = v_topic.responsible_author_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', tc.id,
        'userId', p.id,
        'fullName', p.full_name,
        'email', p.email,
        'avatarUrl', p.avatar_url
      ) order by tc.created_at, tc.id
    ),
    '[]'::jsonb
  ) into v_contributors
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
      and v_topic.responsible_author_user_id = v_user_id
      and v_topic.status = 'draft'
      and v_card_count > 0
      and v_exercise_count > 0
      and v_has_distinct_reviewer
      and not coalesce(v_escalation.unresolved, false),
    'activeFlashcardCount', v_card_count,
    'activeExerciseCount', v_exercise_count,
    'isReady', v_card_count > 0 and v_exercise_count > 0,
    'pendingSubmissionId', v_pending.id,
    'pendingSubmitterId', v_pending.submitted_by_user_id,
    'isCurrentUserSubmitter', coalesce(v_pending.submitted_by_user_id = v_user_id, false),
    'latestRejectionReason', v_latest_rejection.rejection_reason,
    'rejectionCount', v_rejection_count,
    'escalationUnresolved', coalesce(v_escalation.unresolved, false),
    'hasDistinctEligibleReviewer', v_has_distinct_reviewer,
    'escalationId', v_escalation.id,
    'escalationSubmitterId', v_escalation.submitted_by_user_id,
    'canResolveEscalation', v_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role),
    'originalCreator', v_original_creator,
    'responsibleAuthor', v_responsible_author,
    'contributors', v_contributors,
    'canManageAuthorship', v_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role),
    'isCurrentUserResponsible', v_topic.responsible_author_user_id = v_user_id,
    'isCurrentUserContributor', exists (
      select 1
      from public.topic_contributors tc
      where tc.topic_id = v_topic.id
        and tc.user_id = v_user_id
        and tc.removed_at is null
    ),
    'latestAuthorshipFeedback', v_latest_authorship_feedback
  );
end;
$$;

revoke all on function public.get_topic_workflow_state(uuid) from public, anon;
grant execute on function public.get_topic_workflow_state(uuid) to authenticated, service_role;
