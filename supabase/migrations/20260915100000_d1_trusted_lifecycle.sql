-- D1 P1: trusted topic lifecycle, pending freeze, reviewer safety and moderation.

create or replace function public.has_course_management_access(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_course_authoring_access(target_course_id)
$$;

create or replace function public.clear_topic_review_capability_on_role_downgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.role = 'owner'::public.course_member_role and new.role <> 'owner'::public.course_member_role)
     or (old.role = 'co_owner'::public.course_member_role and new.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role))
     or (old.role = 'editor'::public.course_member_role and new.role = 'previewer'::public.course_member_role) then
    new.can_review_topics := false;
  end if;

  return new;
end;
$$;

revoke all on function public.clear_topic_review_capability_on_role_downgrade() from public;

create or replace function public.can_modify_content_by_topic(target_topic_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_topic record;
begin
  select t.course_id, t.status, t.removed_at
  into v_topic
  from public.topics t
  where t.id = target_topic_id;

  if not found or v_topic.removed_at is not null or v_topic.status = 'pending' then
    return false;
  end if;

  return public.has_course_authoring_access(v_topic.course_id);
end;
$$;

create or replace function public.can_modify_exercise_by_id(target_exercise_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  select e.topic_id into v_topic_id
  from public.exercises e
  where e.id = target_exercise_id;

  return v_topic_id is not null and public.can_modify_content_by_topic(v_topic_id);
end;
$$;

create or replace function public.can_modify_question_by_id(target_question_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  select e.topic_id into v_topic_id
  from public.questions q
  join public.exercises e on e.id = q.exercise_id
  where q.id = target_question_id;

  return v_topic_id is not null and public.can_modify_content_by_topic(v_topic_id);
end;
$$;

create or replace function public.can_modify_exercise_child(target_exercise_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  select e.topic_id into v_topic_id
  from public.exercises e
  where e.id = target_exercise_id;

  return v_topic_id is not null and public.can_modify_content_by_topic(v_topic_id);
end;
$$;

create or replace function public.can_modify_question_option(target_question_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_topic_id uuid;
begin
  select e.topic_id into v_topic_id
  from public.questions q
  join public.exercises e on e.id = q.exercise_id
  where q.id = target_question_id;

  return v_topic_id is not null and public.can_modify_content_by_topic(v_topic_id);
end;
$$;

revoke all on function public.can_modify_content_by_topic(uuid) from public;
revoke all on function public.can_modify_exercise_by_id(uuid) from public;
revoke all on function public.can_modify_question_by_id(uuid) from public;
revoke all on function public.can_modify_exercise_child(uuid) from public;
revoke all on function public.can_modify_question_option(uuid) from public;
grant execute on function public.can_modify_content_by_topic(uuid) to authenticated, service_role;
grant execute on function public.can_modify_exercise_by_id(uuid) to authenticated, service_role;
grant execute on function public.can_modify_question_by_id(uuid) to authenticated, service_role;
grant execute on function public.can_modify_exercise_child(uuid) to authenticated, service_role;
grant execute on function public.can_modify_question_option(uuid) to authenticated, service_role;

create or replace function public.can_modify_chapter_by_id(target_chapter_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
begin
  select c.course_id into v_course_id
  from public.chapters c
  where c.id = target_chapter_id;

  return v_course_id is not null
    and public.has_course_authoring_access(v_course_id)
    and not exists (
      select 1
      from public.topics t
      where t.chapter_id = target_chapter_id
        and t.status = 'pending'
        and t.removed_at is null
    );
end;
$$;

revoke all on function public.can_modify_chapter_by_id(uuid) from public;
grant execute on function public.can_modify_chapter_by_id(uuid) to authenticated, service_role;

create or replace function public.has_topic_review_access(target_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.topics t
    join public.courses c on c.id = t.course_id
    join public.course_collaborators cc on cc.course_id = c.id
    join public.profiles p on p.id = cc.user_id
    where t.id = target_topic_id
      and t.removed_at is null
      and c.removed_at is null
      and p.removed_at is null
      and cc.user_id = auth.uid()
      and (
        cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
        or (
          cc.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role)
          and cc.can_review_topics
        )
      )
  )
$$;

revoke all on function public.has_topic_review_access(uuid) from public;
grant execute on function public.has_topic_review_access(uuid) to authenticated, service_role;

create or replace function public.d1_lock_topic_for_mutation(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.item_status;
  v_removed_at timestamptz;
begin
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));

  select t.status, t.removed_at
  into v_status, v_removed_at
  from public.topics t
  where t.id = p_topic_id
  for update;

  if not found or v_removed_at is not null then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  if v_status = 'pending' then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;

end;
$$;

revoke all on function public.d1_lock_topic_for_mutation(uuid) from public;
grant execute on function public.d1_lock_topic_for_mutation(uuid) to authenticated, service_role;

create or replace function public.d1_guard_topic_content_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_topic_id uuid;
  v_new_topic_id uuid;
begin
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op <> 'INSERT' then
    if tg_table_name = 'cards' then
      v_old_topic_id := old.topic_id;
    elsif tg_table_name = 'exercises' then
      v_old_topic_id := old.topic_id;
    elsif tg_table_name = 'question_groups' then
      select e.topic_id into v_old_topic_id
      from public.exercises e
      where e.id = old.exercise_id;
    elsif tg_table_name = 'questions' then
      select e.topic_id into v_old_topic_id
      from public.exercises e
      where e.id = old.exercise_id;
    elsif tg_table_name = 'question_options' then
      select e.topic_id into v_old_topic_id
      from public.questions q
      join public.exercises e on e.id = q.exercise_id
      where q.id = old.question_id;
    end if;
  end if;

  if tg_op <> 'DELETE' then
    if tg_table_name = 'cards' then
      v_new_topic_id := new.topic_id;
    elsif tg_table_name = 'exercises' then
      v_new_topic_id := new.topic_id;
    elsif tg_table_name = 'question_groups' then
      select e.topic_id into v_new_topic_id
      from public.exercises e
      where e.id = new.exercise_id;
    elsif tg_table_name = 'questions' then
      select e.topic_id into v_new_topic_id
      from public.exercises e
      where e.id = new.exercise_id;
    elsif tg_table_name = 'question_options' then
      select e.topic_id into v_new_topic_id
      from public.questions q
      join public.exercises e on e.id = q.exercise_id
      where q.id = new.question_id;
    end if;
  end if;

  if v_old_topic_id is not null and v_new_topic_id is not null and v_old_topic_id > v_new_topic_id then
    declare
      v_swap uuid;
    begin
      v_swap := v_old_topic_id;
      v_old_topic_id := v_new_topic_id;
      v_new_topic_id := v_swap;
    end;
  end if;

  if v_old_topic_id is not null then
    perform public.d1_lock_topic_for_mutation(v_old_topic_id);
  end if;
  if v_new_topic_id is not null and v_new_topic_id is distinct from v_old_topic_id then
    perform public.d1_lock_topic_for_mutation(v_new_topic_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.d1_guard_topic_content_mutation() from public;

drop trigger if exists d1_guard_cards_topic_mutation on public.cards;
create trigger d1_guard_cards_topic_mutation
before insert or update or delete on public.cards
for each row execute function public.d1_guard_topic_content_mutation();

drop trigger if exists d1_guard_exercises_topic_mutation on public.exercises;
create trigger d1_guard_exercises_topic_mutation
before insert or update or delete on public.exercises
for each row execute function public.d1_guard_topic_content_mutation();

drop trigger if exists d1_guard_question_groups_topic_mutation on public.question_groups;
create trigger d1_guard_question_groups_topic_mutation
before insert or update or delete on public.question_groups
for each row execute function public.d1_guard_topic_content_mutation();

drop trigger if exists d1_guard_questions_topic_mutation on public.questions;
create trigger d1_guard_questions_topic_mutation
before insert or update or delete on public.questions
for each row execute function public.d1_guard_topic_content_mutation();

drop trigger if exists d1_guard_question_options_topic_mutation on public.question_options;
create trigger d1_guard_question_options_topic_mutation
before insert or update or delete on public.question_options
for each row execute function public.d1_guard_topic_content_mutation();

create or replace function public.d1_guard_topic_lifecycle_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.item_status;
begin
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(old.id::text));
  select t.status into v_status
  from public.topics t
  where t.id = old.id
  for update;

  if v_status = 'pending'
     and current_setting('voca.d1_trusted_topic_lifecycle', true) is distinct from 'on' then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.d1_guard_topic_lifecycle_mutation() from public;

drop trigger if exists d1_guard_topic_lifecycle_mutation on public.topics;
create trigger d1_guard_topic_lifecycle_mutation
before update or delete on public.topics
for each row execute function public.d1_guard_topic_lifecycle_mutation();

create or replace function public.d1_guard_chapter_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_course_id uuid;
  v_new_course_id uuid;
  v_old_chapter_id uuid;
  v_new_chapter_id uuid;
begin
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op <> 'INSERT' then
    v_old_course_id := old.course_id;
    v_old_chapter_id := old.id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_course_id := new.course_id;
    v_new_chapter_id := new.id;
  end if;

  if v_old_course_id is not null and v_new_course_id is not null and v_old_course_id > v_new_course_id then
    declare
      v_swap uuid;
    begin
      v_swap := v_old_course_id;
      v_old_course_id := v_new_course_id;
      v_new_course_id := v_swap;
    end;
  end if;

  if v_old_course_id is not null then
    perform pg_advisory_xact_lock(hashtext(v_old_course_id::text));
  end if;
  if v_new_course_id is not null and v_new_course_id is distinct from v_old_course_id then
    perform pg_advisory_xact_lock(hashtext(v_new_course_id::text));
  end if;

  if exists (
    select 1
    from public.topics t
    where t.status = 'pending'::public.item_status
      and t.removed_at is null
      and (t.chapter_id = v_old_chapter_id or t.chapter_id = v_new_chapter_id)
  ) then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.d1_guard_chapter_mutation() from public;

drop trigger if exists d1_guard_chapter_mutation on public.chapters;
create trigger d1_guard_chapter_mutation
before insert or update or delete on public.chapters
for each row execute function public.d1_guard_chapter_mutation();

drop policy if exists "Chapters - Staff Insert" on public.chapters;
create policy "Chapters - Staff Insert" on public.chapters
for insert to authenticated
with check (public.has_course_authoring_access(course_id));

drop policy if exists "Chapters - Staff Select Deleted" on public.chapters;
create policy "Chapters - Staff Select Deleted" on public.chapters
for select to authenticated
using (removed_at is not null and public.has_course_authoring_access(course_id));

drop policy if exists "Chapters - Staff Soft Delete" on public.chapters;
create policy "Chapters - Staff Soft Delete" on public.chapters
for update to authenticated
using (public.can_modify_chapter_by_id(id))
with check (public.can_modify_chapter_by_id(id));

drop policy if exists "Chapters - Staff Update" on public.chapters;
create policy "Chapters - Staff Update" on public.chapters
for update to authenticated
using (public.can_modify_chapter_by_id(id))
with check (public.can_modify_chapter_by_id(id));

drop policy if exists "Courses - Staff Update Secured" on public.courses;
create policy "Courses - Staff Update Secured" on public.courses
for update to authenticated
using (public.has_course_authoring_access(id))
with check (public.has_course_authoring_access(id));

drop policy if exists "Collaborators - Staff Insert" on public.course_collaborators;
drop policy if exists "Collaborators - Staff Update" on public.course_collaborators;
drop policy if exists "Collaborators - Staff Delete" on public.course_collaborators;

drop policy if exists "Exercises - Staff Insert" on public.exercises;
create policy "Exercises - Staff Insert" on public.exercises
for insert to authenticated
with check (public.can_modify_content_by_topic(topic_id));

drop policy if exists "Exercises - Staff Select Deleted" on public.exercises;
create policy "Exercises - Staff Select Deleted" on public.exercises
for select to authenticated
using (removed_at is not null and public.has_course_authoring_access(course_id));

drop policy if exists "Exercises - Staff Soft Delete" on public.exercises;
create policy "Exercises - Staff Soft Delete" on public.exercises
for update to authenticated
using (public.can_modify_exercise_by_id(id))
with check (public.can_modify_exercise_by_id(id));

drop policy if exists "Exercises - Staff Update" on public.exercises;
create policy "Exercises - Staff Update" on public.exercises
for update to authenticated
using (public.can_modify_exercise_by_id(id))
with check (public.can_modify_exercise_by_id(id));

drop policy if exists "Questions - Staff Insert" on public.questions;
create policy "Questions - Staff Insert" on public.questions
for insert to authenticated
with check (public.can_modify_content_by_topic(
  (select e.topic_id from public.exercises e where e.id = exercise_id)
));

drop policy if exists "Questions - Staff Select Deleted" on public.questions;
create policy "Questions - Staff Select Deleted" on public.questions
for select to authenticated
using (removed_at is not null and public.has_course_authoring_access(course_id));

drop policy if exists "Questions - Staff Soft Delete" on public.questions;
create policy "Questions - Staff Soft Delete" on public.questions
for update to authenticated
using (public.can_modify_question_by_id(id))
with check (public.can_modify_question_by_id(id));

drop policy if exists "Questions - Staff Update" on public.questions;
create policy "Questions - Staff Update" on public.questions
for update to authenticated
using (public.can_modify_question_by_id(id))
with check (public.can_modify_question_by_id(id));

drop policy if exists "Topics - Staff Insert" on public.topics;
create policy "Topics - Staff Insert" on public.topics
for insert to authenticated
with check (public.has_course_authoring_access(course_id) and status = 'draft');

drop policy if exists "Topics - Staff Select Deleted" on public.topics;
create policy "Topics - Staff Select Deleted" on public.topics
for select to authenticated
using (removed_at is not null and public.has_course_authoring_access(course_id));

drop policy if exists "Topics - Staff Soft Delete" on public.topics;
create policy "Topics - Staff Soft Delete" on public.topics
for update to authenticated
using (public.has_course_authoring_access(course_id) and status = 'draft')
with check (public.has_course_authoring_access(course_id) and status = 'draft');

drop policy if exists "Topics - Staff Update" on public.topics;
create policy "Topics - Staff Update" on public.topics
for update to authenticated
using (public.has_course_authoring_access(course_id) and status = 'draft')
with check (public.has_course_authoring_access(course_id) and status = 'draft');

create or replace function public.d1_review_submission_course_id(p_submission_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.course_id
  from public.topic_review_submissions s
  join public.topics t on t.id = s.topic_id
  where s.id = p_submission_id
$$;

revoke all on function public.d1_review_submission_course_id(uuid) from public, anon, authenticated;
grant execute on function public.d1_review_submission_course_id(uuid) to service_role;

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

  select t.course_id into v_topic.course_id
  from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));

  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if v_topic.removed_at is not null then raise exception 'TOPIC_REMOVED'; end if;
  if v_topic.status <> 'draft' then raise exception 'TOPIC_NOT_DRAFT'; end if;
  if not public.has_course_authoring_access(v_topic.course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  if exists (
    select 1 from public.topic_review_escalations e
    where e.topic_id = p_topic_id
      and e.submitted_by_user_id = v_user_id
      and e.unresolved
  ) then
    raise exception 'TOPIC_REVIEW_ESCALATION_HOLD';
  end if;

  if exists (
    select 1 from public.topic_review_submissions s
    where s.topic_id = p_topic_id and s.status = 'pending'
  ) then
    raise exception 'TOPIC_REVIEW_ALREADY_PENDING';
  end if;

  select count(*) into v_card_count from public.cards c
  where c.topic_id = p_topic_id and c.removed_at is null;
  select count(*) into v_exercise_count from public.exercises e
  where e.topic_id = p_topic_id and e.removed_at is null;
  if v_card_count < 1 or v_exercise_count < 1 then
    raise exception using message = 'TOPIC_REVIEW_NOT_READY',
      detail = format('active_flashcards=%s active_exercises=%s', v_card_count, v_exercise_count);
  end if;

  select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number
  from public.topic_review_submissions s
  where s.topic_id = p_topic_id and s.submitted_by_user_id = v_user_id;

  insert into public.topic_review_submissions (
    topic_id, submitted_by_user_id, status, attempt_number
  ) values (
    p_topic_id, v_user_id, 'pending', v_attempt_number
  ) returning * into v_submission;

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'pending' where id = p_topic_id;

  return jsonb_build_object(
    'status', 'pending',
    'course_id', v_topic.course_id,
    'topic_id', p_topic_id,
    'submission_id', v_submission.id,
    'attempt_number', v_attempt_number,
    'active_flashcard_count', v_card_count,
    'active_exercise_count', v_exercise_count
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
  where e.topic_id = v_topic.id and e.removed_at is null;
  if v_card_count < 1 or v_exercise_count < 1 then raise exception 'TOPIC_REVIEW_NOT_READY'; end if;

  update public.topic_review_submissions
  set status = 'approved', reviewed_by_user_id = v_user_id, reviewed_at = now()
  where id = v_submission.id;
  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'published' where id = v_topic.id;

  update public.topic_review_escalations
  set unresolved = false,
      resolved_by_user_id = v_user_id,
      resolved_at = now(),
      resolution_action = 'rescue',
      resolution_reason = 'Owner/co-owner rescue lifecycle was approved.'
  where topic_id = v_topic.id and unresolved;

  return jsonb_build_object('status', 'published', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'submission_id', v_submission.id);
end;
$$;

create or replace function public.reject_topic_review(p_submission_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_submission public.topic_review_submissions%rowtype;
  v_topic public.topics%rowtype;
  v_course_id uuid;
  v_rejection_count integer;
  v_escalated boolean := false;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_reason is null then raise exception 'TOPIC_REVIEW_REASON_REQUIRED'; end if;
  if length(v_reason) > 2000 then raise exception 'TOPIC_REVIEW_REASON_TOO_LONG'; end if;

  select public.d1_review_submission_course_id(p_submission_id) into v_course_id;
  if v_course_id is null then raise exception 'TOPIC_REVIEW_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));

  select * into v_submission from public.topic_review_submissions s
  where s.id = p_submission_id for update;
  if not found then raise exception 'TOPIC_REVIEW_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_submission.topic_id::text));
  select * into v_topic from public.topics t where t.id = v_submission.topic_id for update;
  if not found or v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;
  if v_submission.status <> 'pending' or v_topic.status <> 'pending' then raise exception 'TOPIC_REVIEW_STALE'; end if;
  if v_submission.submitted_by_user_id = v_user_id then raise exception 'TOPIC_REVIEW_SELF_REVIEW'; end if;
  if not public.has_topic_review_access(v_topic.id) then raise exception 'TOPIC_REVIEW_FORBIDDEN'; end if;

  update public.topic_review_submissions
  set status = 'rejected',
      reviewed_by_user_id = v_user_id,
      reviewed_at = now(),
      rejection_reason = v_reason
  where id = v_submission.id;
  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'draft' where id = v_topic.id;

  select count(*) into v_rejection_count
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id
    and s.submitted_by_user_id = v_submission.submitted_by_user_id
    and s.status = 'rejected';

  if v_rejection_count >= 3 then
    v_escalated := true;
    insert into public.topic_review_escalations (
      topic_id, submitted_by_user_id, rejection_count, unresolved
    ) values (
      v_topic.id, v_submission.submitted_by_user_id, v_rejection_count, true
    )
    on conflict (topic_id, submitted_by_user_id) do update set
      rejection_count = excluded.rejection_count,
      unresolved = true,
      resolved_by_user_id = null,
      resolved_at = null,
      resolution_action = null,
      resolution_reason = null;
  end if;

  return jsonb_build_object(
    'status', 'draft',
    'course_id', v_topic.course_id,
    'topic_id', v_topic.id,
    'submission_id', v_submission.id,
    'rejection_count', v_rejection_count,
    'escalated', v_escalated
  );
end;
$$;

create or replace function public.resolve_topic_review_escalation(
  p_escalation_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_escalation public.topic_review_escalations%rowtype;
  v_topic public.topics%rowtype;
  v_course_id uuid;
  v_attempt_number integer;
  v_submission public.topic_review_submissions%rowtype;
  v_card_count integer;
  v_exercise_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_action not in ('rescue', 'close', 'abandon') then raise exception 'TOPIC_REVIEW_ESCALATION_ACTION_INVALID'; end if;
  if v_reason is null then raise exception 'TOPIC_REVIEW_REASON_REQUIRED'; end if;
  if length(v_reason) > 2000 then raise exception 'TOPIC_REVIEW_REASON_TOO_LONG'; end if;

  select t.course_id into v_course_id
  from public.topic_review_escalations e join public.topics t on t.id = e.topic_id
  where e.id = p_escalation_id;
  if v_course_id is null then raise exception 'TOPIC_REVIEW_ESCALATION_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));

  select * into v_escalation from public.topic_review_escalations e
  where e.id = p_escalation_id for update;
  perform pg_advisory_xact_lock(hashtext(v_escalation.topic_id::text));
  select * into v_topic from public.topics t where t.id = v_escalation.topic_id for update;
  if not v_escalation.unresolved then raise exception 'TOPIC_REVIEW_ESCALATION_STALE'; end if;
  if not public.is_course_owner_or_co_owner(v_topic.course_id) then raise exception 'TOPIC_REVIEW_ESCALATION_FORBIDDEN'; end if;

  if p_action = 'rescue' then
    if v_topic.removed_at is not null or v_topic.status <> 'draft' then raise exception 'TOPIC_NOT_DRAFT'; end if;
    select count(*) into v_card_count from public.cards c where c.topic_id = v_topic.id and c.removed_at is null;
    select count(*) into v_exercise_count from public.exercises e where e.topic_id = v_topic.id and e.removed_at is null;
    if v_card_count < 1 or v_exercise_count < 1 then raise exception 'TOPIC_REVIEW_NOT_READY'; end if;
    if not exists (
      select 1 from public.course_collaborators cc join public.profiles p on p.id = cc.user_id
      where cc.course_id = v_topic.course_id and p.removed_at is null
        and cc.user_id <> v_user_id
        and (cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
          or (cc.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) and cc.can_review_topics))
    ) then raise exception 'TOPIC_REVIEW_NO_REMAINING_REVIEWER'; end if;

    if exists (select 1 from public.topic_review_submissions s where s.topic_id = v_topic.id and s.status = 'pending') then
      raise exception 'TOPIC_REVIEW_ALREADY_PENDING';
    end if;
    select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number
    from public.topic_review_submissions s where s.topic_id = v_topic.id and s.submitted_by_user_id = v_user_id;
    insert into public.topic_review_submissions (topic_id, submitted_by_user_id, attempt_number)
    values (v_topic.id, v_user_id, v_attempt_number) returning * into v_submission;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics set status = 'pending' where id = v_topic.id;

    return jsonb_build_object('status', 'pending', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'submission_id', v_submission.id, 'escalation_id', v_escalation.id);
  end if;

  update public.topic_review_escalations
  set unresolved = false,
      resolved_by_user_id = v_user_id,
      resolved_at = now(),
      resolution_action = p_action,
      resolution_reason = v_reason
  where id = v_escalation.id;

  if p_action = 'abandon' then
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics set removed_at = now(), status = 'draft' where id = v_topic.id;
  end if;

  return jsonb_build_object('status', case when p_action = 'abandon' then 'removed' else 'draft' end, 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'escalation_id', v_escalation.id);
end;
$$;

create or replace function public.d1_assert_pending_review_reviewer_safety(
  p_collaborator_id uuid,
  p_new_role public.course_member_role,
  p_new_can_review_topics boolean,
  p_is_removal boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.course_collaborators%rowtype;
begin
  select * into v_target from public.course_collaborators cc where cc.id = p_collaborator_id;
  if not found then raise exception 'COLLABORATOR_NOT_FOUND'; end if;

  if exists (
    select 1
    from public.topic_review_submissions s
    join public.topics t on t.id = s.topic_id
    where s.status = 'pending'
      and t.course_id = v_target.course_id
      and not exists (
        select 1
        from public.course_collaborators cc
        join public.profiles p on p.id = cc.user_id
        where cc.course_id = t.course_id
          and p.removed_at is null
          and cc.id <> v_target.id
          and cc.user_id <> s.submitted_by_user_id
          and (
            cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
            or (cc.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) and cc.can_review_topics)
          )
      )
      and not p_is_removal
      and p_new_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
      and p_new_can_review_topics
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.topic_review_submissions s
    join public.topics t on t.id = s.topic_id
    where s.status = 'pending'
      and t.course_id = v_target.course_id
      and not exists (
        select 1
        from public.course_collaborators cc
        join public.profiles p on p.id = cc.user_id
        where cc.course_id = t.course_id
          and p.removed_at is null
          and (
            cc.id <> v_target.id
            and cc.user_id <> s.submitted_by_user_id
            and (cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
              or (cc.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) and cc.can_review_topics))
          )
      )
      and (p_is_removal or not (
        p_new_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
        or (p_new_role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) and p_new_can_review_topics)
      ))
  ) then
    raise exception 'COLLABORATOR_LAST_REVIEWER_REQUIRED';
  end if;
end;
$$;

revoke all on function public.d1_assert_pending_review_reviewer_safety(uuid, public.course_member_role, boolean, boolean) from public, anon, authenticated;
grant execute on function public.d1_assert_pending_review_reviewer_safety(uuid, public.course_member_role, boolean, boolean) to service_role;

create or replace function public.set_course_collaborator_review_capability(
  p_collaborator_id uuid,
  p_can_review_topics boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.course_collaborators%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_target from public.course_collaborators cc where cc.id = p_collaborator_id;
  if not found then raise exception 'COLLABORATOR_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_target.course_id::text));
  if not public.is_course_owner_or_co_owner(v_target.course_id) then raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN'; end if;
  if v_target.role not in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) then
    raise exception 'COLLABORATOR_CAPABILITY_ROLE_INVALID';
  end if;
  if not p_can_review_topics then
    perform public.d1_assert_pending_review_reviewer_safety(v_target.id, v_target.role, false, false);
  end if;
  update public.course_collaborators set can_review_topics = p_can_review_topics where id = v_target.id;
  return jsonb_build_object('status', 'updated', 'collaborator_id', v_target.id, 'can_review_topics', p_can_review_topics);
end;
$$;

create or replace function public.update_course_collaborator_role(
  p_collaborator_id uuid,
  p_role public.course_member_role
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.course_collaborators%rowtype;
  v_new_flag boolean;
begin
  select * into v_target from public.course_collaborators cc where cc.id = p_collaborator_id;
  if not found then raise exception 'COLLABORATOR_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_target.course_id::text));
  if not public.is_course_owner_or_co_owner(v_target.course_id) then raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN'; end if;
  if v_target.role = 'owner'::public.course_member_role
     or (
       v_target.role = 'co_owner'::public.course_member_role
       and not exists (
         select 1 from public.course_collaborators cc
         where cc.course_id = v_target.course_id
           and cc.user_id = auth.uid()
           and cc.role = 'owner'::public.course_member_role
       )
     ) then
    raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN';
  end if;
  if p_role not in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) then
    raise exception 'COLLABORATOR_ROLE_CHANGE_OUTSIDE_D1';
  end if;
  v_new_flag := case
    when p_role = v_target.role then v_target.can_review_topics
    when v_target.role = 'previewer'::public.course_member_role and p_role = 'editor'::public.course_member_role then v_target.can_review_topics
    else false
  end;
  perform public.d1_assert_pending_review_reviewer_safety(v_target.id, p_role, v_new_flag, false);
  update public.course_collaborators set role = p_role, can_review_topics = v_new_flag where id = v_target.id;
  return jsonb_build_object('status', 'updated', 'collaborator_id', v_target.id, 'role', p_role, 'can_review_topics', v_new_flag);
end;
$$;

create or replace function public.remove_course_collaborator(p_collaborator_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.course_collaborators%rowtype;
begin
  select * into v_target from public.course_collaborators cc where cc.id = p_collaborator_id;
  if not found then raise exception 'COLLABORATOR_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_target.course_id::text));
  if not public.is_course_owner_or_co_owner(v_target.course_id) then raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN'; end if;
  if v_target.role = 'owner'::public.course_member_role then raise exception 'COURSE_OWNER_REMOVAL_FORBIDDEN'; end if;
  if v_target.role = 'co_owner'::public.course_member_role
     and not exists (
       select 1 from public.course_collaborators cc
       where cc.course_id = v_target.course_id
         and cc.user_id = auth.uid()
         and cc.role = 'owner'::public.course_member_role
     ) then
    raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN';
  end if;
  perform public.d1_assert_pending_review_reviewer_safety(v_target.id, v_target.role, false, true);
  delete from public.course_collaborators where id = v_target.id;
  return jsonb_build_object('status', 'removed', 'collaborator_id', v_target.id);
end;
$$;

revoke all on function public.set_course_collaborator_review_capability(uuid, boolean) from public;
revoke all on function public.update_course_collaborator_role(uuid, public.course_member_role) from public;
revoke all on function public.remove_course_collaborator(uuid) from public;
grant execute on function public.set_course_collaborator_review_capability(uuid, boolean) to authenticated, service_role;
grant execute on function public.update_course_collaborator_role(uuid, public.course_member_role) to authenticated, service_role;
grant execute on function public.remove_course_collaborator(uuid) to authenticated, service_role;

create table if not exists public.platform_moderation_audits (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('course', 'chapter', 'topic')),
  target_id uuid not null,
  action text not null check (action in ('demote', 'takedown', 'invalidate_review')),
  reason text not null check (nullif(btrim(reason), '') is not null),
  previous_status public.item_status,
  previous_removed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists platform_moderation_audits_target_idx
on public.platform_moderation_audits (target_type, target_id, created_at desc);

alter table public.platform_moderation_audits enable row level security;
revoke all on table public.platform_moderation_audits from public, anon, authenticated;
grant all on table public.platform_moderation_audits to service_role;

create or replace function public.d1_cancel_pending_reviews_for_topics(
  p_topic_ids uuid[],
  p_actor_user_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topic_review_submissions s
  set status = 'cancelled',
      cancelled_by_user_id = p_actor_user_id,
      cancelled_at = now(),
      cancellation_reason = p_reason
  where s.status = 'pending' and s.topic_id = any(p_topic_ids);
  get diagnostics v_count = row_count;
  update public.topics set status = 'draft' where id = any(p_topic_ids) and status = 'pending';
  return v_count;
end;
$$;

revoke all on function public.d1_cancel_pending_reviews_for_topics(uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.d1_cancel_pending_reviews_for_topics(uuid[], uuid, text) to service_role;

create or replace function public.moderate_platform_content(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_course_id uuid;
  v_previous_status public.item_status;
  v_previous_removed_at timestamptz;
  v_topic_ids uuid[];
  v_cancelled integer := 0;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_actor and p.role = 'admin') then
    raise exception 'ADMIN_MODERATION_FORBIDDEN';
  end if;
  if p_target_type not in ('course', 'chapter', 'topic') then raise exception 'MODERATION_TARGET_INVALID'; end if;
  if p_action not in ('demote', 'takedown', 'invalidate_review') then raise exception 'MODERATION_ACTION_INVALID'; end if;
  if v_reason is null then raise exception 'MODERATION_REASON_REQUIRED'; end if;
  if length(v_reason) > 2000 then raise exception 'MODERATION_REASON_TOO_LONG'; end if;

  if p_target_type = 'topic' then
    select t.course_id, t.status, t.removed_at into v_course_id, v_previous_status, v_previous_removed_at
    from public.topics t where t.id = p_target_id;
    if v_course_id is null then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    perform pg_advisory_xact_lock(hashtext(p_target_id::text));
    select t.status, t.removed_at into v_previous_status, v_previous_removed_at from public.topics t where t.id = p_target_id for update;
    if p_action = 'invalidate_review' and v_previous_status <> 'pending' then raise exception 'MODERATION_TARGET_STATE_INVALID'; end if;
    if p_action = 'demote' and v_previous_status not in ('published', 'pending') then raise exception 'MODERATION_TARGET_STATE_INVALID'; end if;
    if p_action = 'takedown' and v_previous_removed_at is not null then raise exception 'MODERATION_TARGET_ALREADY_REMOVED'; end if;
    v_topic_ids := array[p_target_id];
    if v_previous_status = 'pending' then
      v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_topic_ids, v_actor, v_reason);
    end if;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics set status = 'draft', removed_at = case when p_action = 'takedown' then now() else removed_at end where id = p_target_id;
  elsif p_target_type = 'chapter' then
    select c.course_id, c.removed_at into v_course_id, v_previous_removed_at from public.chapters c where c.id = p_target_id;
    if v_course_id is null then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    select c.removed_at into v_previous_removed_at from public.chapters c where c.id = p_target_id for update;
    if p_action <> 'takedown' or v_previous_removed_at is not null then raise exception 'MODERATION_ACTION_NOT_SUPPORTED'; end if;
    select array_agg(t.id) into v_topic_ids from public.topics t where t.chapter_id = p_target_id and t.removed_at is null;
    if v_topic_ids is not null then v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_topic_ids, v_actor, v_reason); end if;
    update public.chapters set removed_at = now() where id = p_target_id;
    v_previous_status := null;
  else
    select c.status, c.removed_at into v_previous_status, v_previous_removed_at from public.courses c where c.id = p_target_id;
    if not found then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    v_course_id := p_target_id;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    if p_action = 'demote' then
      if v_previous_status <> 'published' then raise exception 'MODERATION_TARGET_STATE_INVALID'; end if;
      select array_agg(t.id) into v_topic_ids from public.topics t where t.course_id = p_target_id and t.status = 'pending' and t.removed_at is null;
      if v_topic_ids is not null then v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_topic_ids, v_actor, v_reason); end if;
      update public.courses set status = 'draft' where id = p_target_id;
    elsif p_action = 'takedown' then
      if v_previous_removed_at is not null then raise exception 'MODERATION_TARGET_ALREADY_REMOVED'; end if;
      select array_agg(t.id) into v_topic_ids from public.topics t where t.course_id = p_target_id and t.status = 'pending' and t.removed_at is null;
      if v_topic_ids is not null then v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_topic_ids, v_actor, v_reason); end if;
      update public.courses set status = 'draft', removed_at = now() where id = p_target_id;
    else
      raise exception 'MODERATION_ACTION_NOT_SUPPORTED';
    end if;
  end if;

  insert into public.platform_moderation_audits (
    actor_user_id, target_type, target_id, action, reason, previous_status, previous_removed_at
  ) values (
    v_actor, p_target_type, p_target_id, p_action, v_reason, v_previous_status, v_previous_removed_at
  );

  return jsonb_build_object('status', case when p_action = 'takedown' then 'removed' else 'draft' end, 'course_id', v_course_id, 'target_type', p_target_type, 'target_id', p_target_id, 'cancelled_reviews', v_cancelled);
end;
$$;

revoke all on function public.request_topic_review(uuid) from public;
revoke all on function public.approve_topic_review(uuid) from public;
revoke all on function public.reject_topic_review(uuid, text) from public;
revoke all on function public.resolve_topic_review_escalation(uuid, text, text) from public;
revoke all on function public.moderate_platform_content(text, uuid, text, text) from public;
grant execute on function public.request_topic_review(uuid) to authenticated, service_role;
grant execute on function public.approve_topic_review(uuid) to authenticated, service_role;
grant execute on function public.reject_topic_review(uuid, text) to authenticated, service_role;
grant execute on function public.resolve_topic_review_escalation(uuid, text, text) to authenticated, service_role;
grant execute on function public.moderate_platform_content(text, uuid, text, text) to authenticated, service_role;

-- Normal media upload is course-scoped; global admin remains a separate delete/moderation actor.
drop policy if exists "Teacher and Admin Upload Question Group Images" on storage.objects;
drop policy if exists "Course Author Upload Question Group Images" on storage.objects;
create policy "Course Author Upload Question Group Images"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'question_group_images'
  and split_part(name, '/', 1) <> ''
  and exists (
    select 1
    from public.courses c
    join public.topics t on t.course_id = c.id
    join public.course_collaborators cc on cc.course_id = c.id
    join public.profiles p on p.id = cc.user_id
    where c.id::text = split_part(storage.objects.name, '/', 1)
      and t.id::text = split_part(storage.objects.name, '/', 2)
      and c.removed_at is null
      and t.removed_at is null
      and t.status <> 'pending'::public.item_status
      and p.removed_at is null
      and cc.user_id = auth.uid()
      and cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role, 'editor'::public.course_member_role)
  )
);

drop policy if exists "Teacher and Admin Upload Question Group Audios" on storage.objects;
drop policy if exists "Course Author Upload Question Group Audios" on storage.objects;
create policy "Course Author Upload Question Group Audios"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'question_group_audios'
  and split_part(name, '/', 1) <> ''
  and exists (
    select 1
    from public.courses c
    join public.topics t on t.course_id = c.id
    join public.course_collaborators cc on cc.course_id = c.id
    join public.profiles p on p.id = cc.user_id
    where c.id::text = split_part(storage.objects.name, '/', 1)
      and t.id::text = split_part(storage.objects.name, '/', 2)
      and c.removed_at is null
      and t.removed_at is null
      and t.status <> 'pending'::public.item_status
      and p.removed_at is null
      and cc.user_id = auth.uid()
      and cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role, 'editor'::public.course_member_role)
  )
);

create or replace function public.create_topic_ordered(
  p_course_id uuid,
  p_chapter_id uuid,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_chapter public.chapters%rowtype;
  v_next_order integer;
  v_topic public.topics%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext(p_course_id::text));

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_title is null then raise exception 'TOPIC_TITLE_REQUIRED'; end if;
  if length(v_title) < 4 then raise exception 'TOPIC_TITLE_TOO_SHORT'; end if;
  if length(v_title) > 120 then raise exception 'TOPIC_TITLE_TOO_LONG'; end if;

  select * into v_chapter from public.chapters c where c.id = p_chapter_id for update;
  if not found then raise exception 'CHAPTER_NOT_FOUND'; end if;
  if v_chapter.removed_at is not null then raise exception 'CHAPTER_REMOVED'; end if;
  if v_chapter.course_id <> p_course_id then raise exception 'TOPIC_COURSE_MISMATCH'; end if;
  if not exists (select 1 from public.courses c where c.id = p_course_id and c.removed_at is null) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if not public.has_course_authoring_access(p_course_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if exists (
    select 1 from public.topic_review_escalations e
    join public.topics t on t.id = e.topic_id
    where t.course_id = p_course_id
      and e.submitted_by_user_id = v_user_id
      and e.unresolved
  ) then
    raise exception 'TOPIC_REVIEW_CREATION_HOLD';
  end if;

  select coalesce(max(t.order_index), 0) + 1 into v_next_order
  from public.topics t where t.chapter_id = p_chapter_id;
  insert into public.topics (course_id, chapter_id, title, status, order_index)
  values (p_course_id, p_chapter_id, v_title, 'draft', v_next_order)
  returning * into v_topic;

  return jsonb_build_object(
    'status', 'created',
    'topic', jsonb_build_object(
      'id', v_topic.id,
      'course_id', v_topic.course_id,
      'chapter_id', v_topic.chapter_id,
      'title', v_topic.title,
      'status', v_topic.status,
      'order_index', v_topic.order_index,
      'created_at', v_topic.created_at,
      'updated_at', v_topic.updated_at
    )
  );
end;
$$;

create or replace function public.move_topic_order(
  p_topic_id uuid,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_chapter_id uuid;
  v_chapter public.chapters%rowtype;
  v_target public.topics%rowtype;
  v_neighbor public.topics%rowtype;
  v_temp_order integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_direction not in ('up', 'down') then raise exception 'INVALID_DIRECTION'; end if;

  select t.chapter_id into v_initial_chapter_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  select * into v_chapter from public.chapters c where c.id = v_initial_chapter_id for update;
  if not found then raise exception 'CHAPTER_NOT_FOUND'; end if;
  if v_chapter.removed_at is not null then raise exception 'CHAPTER_REMOVED'; end if;
  if not exists (select 1 from public.courses c where c.id = v_chapter.course_id and c.removed_at is null) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_chapter.course_id::text));

  select * into v_target from public.topics t where t.id = p_topic_id and t.chapter_id = v_chapter.id for update;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if v_target.removed_at is not null then raise exception 'TOPIC_REMOVED'; end if;
  if v_target.status = 'pending' then raise exception 'TOPIC_PENDING_FROZEN'; end if;
  if not public.has_course_authoring_access(v_target.course_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;

  if p_direction = 'up' then
    select * into v_neighbor from public.topics t
    where t.chapter_id = v_target.chapter_id and t.removed_at is null and t.order_index < v_target.order_index
    order by t.order_index desc, t.created_at desc, t.id desc limit 1 for update;
  else
    select * into v_neighbor from public.topics t
    where t.chapter_id = v_target.chapter_id and t.removed_at is null and t.order_index > v_target.order_index
    order by t.order_index asc, t.created_at asc, t.id asc limit 1 for update;
  end if;

  if not found then
    return jsonb_build_object(
      'status', 'noop',
      'reason', case when p_direction = 'up' then 'already_first' else 'already_last' end,
      'course_id', v_target.course_id,
      'chapter_id', v_target.chapter_id,
      'topic_id', v_target.id,
      'order_index', v_target.order_index
    );
  end if;
  if v_neighbor.status = 'pending' then raise exception 'TOPIC_PENDING_FROZEN'; end if;

  select coalesce(max(t.order_index), 0) + 1 into v_temp_order
  from public.topics t where t.chapter_id = v_target.chapter_id;
  update public.topics set order_index = v_temp_order, updated_at = timezone('utc', now()) where id = v_target.id;
  update public.topics set order_index = v_target.order_index, updated_at = timezone('utc', now()) where id = v_neighbor.id;
  update public.topics set order_index = v_neighbor.order_index, updated_at = timezone('utc', now()) where id = v_target.id;

  return jsonb_build_object(
    'status', 'moved',
    'course_id', v_target.course_id,
    'chapter_id', v_target.chapter_id,
    'topic_id', v_target.id,
    'neighbor_topic_id', v_neighbor.id,
    'direction', p_direction,
    'previous_order_index', v_target.order_index,
    'new_order_index', v_neighbor.order_index
  );
end;
$$;

create or replace function public.soft_delete_exercise_cascade(p_exercise_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exercise record;
  v_removed_at timestamptz := now();
  v_deleted_options integer := 0;
  v_deleted_questions integer := 0;
  v_deleted_groups integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select e.id, e.topic_id, e.course_id, e.removed_at into v_exercise
  from public.exercises e where e.id = p_exercise_id for update;
  if not found then raise exception 'EXERCISE_NOT_FOUND'; end if;
  if v_exercise.removed_at is not null then raise exception 'EXERCISE_ALREADY_REMOVED'; end if;
  if not public.can_modify_content_by_topic(v_exercise.topic_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;

  perform public.d1_lock_topic_for_mutation(v_exercise.topic_id);
  update public.question_options qo set removed_at = v_removed_at
  where qo.removed_at is null and exists (
    select 1 from public.questions q where q.id = qo.question_id and q.exercise_id = p_exercise_id
  );
  get diagnostics v_deleted_options = row_count;
  update public.questions q set removed_at = v_removed_at where q.exercise_id = p_exercise_id and q.removed_at is null;
  get diagnostics v_deleted_questions = row_count;
  update public.question_groups qg set removed_at = v_removed_at where qg.exercise_id = p_exercise_id and qg.removed_at is null;
  get diagnostics v_deleted_groups = row_count;
  update public.exercises e set removed_at = v_removed_at where e.id = p_exercise_id and e.removed_at is null;

  return jsonb_build_object(
    'exercise_id', p_exercise_id,
    'deleted_options', v_deleted_options,
    'deleted_questions', v_deleted_questions,
    'deleted_groups', v_deleted_groups,
    'removed_at', v_removed_at
  );
end;
$$;

revoke all on function public.create_topic_ordered(uuid, uuid, text) from public;
grant execute on function public.create_topic_ordered(uuid, uuid, text) to authenticated, service_role;
revoke all on function public.move_topic_order(uuid, text) from public;
grant execute on function public.move_topic_order(uuid, text) to authenticated, service_role;
revoke all on function public.soft_delete_exercise_cascade(uuid) from public;
grant execute on function public.soft_delete_exercise_cascade(uuid) to authenticated, service_role;
