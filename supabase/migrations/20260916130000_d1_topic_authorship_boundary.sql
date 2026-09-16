-- D1 P1-A: trusted topic authorship, reviewer exclusion and membership transfer boundary.

create table public.topic_authorship_feedback (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  previous_responsible_user_id uuid references public.profiles(id) on delete set null,
  new_responsible_user_id uuid references public.profiles(id) on delete set null,
  feedback_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint topic_authorship_feedback_type_check
    check (feedback_type in ('responsibility_transfer'))
);

create index topic_authorship_feedback_recipient_idx
  on public.topic_authorship_feedback (recipient_user_id, created_at desc);

create index topic_authorship_feedback_topic_idx
  on public.topic_authorship_feedback (topic_id, created_at desc);

alter table public.topic_authorship_feedback enable row level security;
revoke all on table public.topic_authorship_feedback from public, anon, authenticated;
grant all on table public.topic_authorship_feedback to service_role;

create or replace function public.d1_is_active_course_author(
  p_course_id uuid,
  p_user_id uuid
)
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
    where c.id = p_course_id
      and c.removed_at is null
      and cc.user_id = p_user_id
      and p.removed_at is null
      and cc.role in (
        'owner'::public.course_member_role,
        'co_owner'::public.course_member_role,
        'editor'::public.course_member_role
      )
  )
$$;

revoke all on function public.d1_is_active_course_author(uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_is_active_course_author(uuid, uuid) to service_role;

create or replace function public.d1_topic_group_member(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.topics t
    join public.chapters ch on ch.id = t.chapter_id
    join public.courses c on c.id = t.course_id
    join public.course_collaborators cc on cc.course_id = t.course_id and cc.user_id = auth.uid()
    join public.profiles p on p.id = auth.uid()
    where t.id = p_topic_id
      and t.removed_at is null
      and ch.removed_at is null
      and ch.course_id = t.course_id
      and c.removed_at is null
      and p.removed_at is null
      and cc.role in (
        'owner'::public.course_member_role,
        'co_owner'::public.course_member_role,
        'editor'::public.course_member_role
      )
      and (
        t.responsible_author_user_id = auth.uid()
        or exists (
          select 1
          from public.topic_contributors tc
          where tc.topic_id = t.id
            and tc.user_id = auth.uid()
            and tc.removed_at is null
        )
      )
  )
$$;

revoke all on function public.d1_topic_group_member(uuid) from public, anon;
grant execute on function public.d1_topic_group_member(uuid) to authenticated, service_role;

create or replace function public.d1_is_topic_reviewer_excluded(
  p_topic_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.topics t
    where t.id = p_topic_id
      and t.first_approved_at is null
      and (
        t.original_creator_user_id = p_user_id
        or t.responsible_author_user_id = p_user_id
        or exists (
          select 1
          from public.topic_author_review_exclusions e
          where e.topic_id = t.id
            and e.user_id = p_user_id
        )
      )
  )
$$;

revoke all on function public.d1_is_topic_reviewer_excluded(uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_is_topic_reviewer_excluded(uuid, uuid) to service_role;

create or replace function public.d1_has_eligible_topic_reviewer(
  p_topic_id uuid,
  p_first_excluded_user_id uuid default null,
  p_second_excluded_user_id uuid default null
)
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
    where t.id = p_topic_id
      and t.removed_at is null
      and c.removed_at is null
      and p.removed_at is null
      and (p_first_excluded_user_id is null or cc.user_id <> p_first_excluded_user_id)
      and (p_second_excluded_user_id is null or cc.user_id <> p_second_excluded_user_id)
      and (
        cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
        or (
          cc.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role)
          and cc.can_review_topics
        )
      )
      and not public.d1_is_topic_reviewer_excluded(t.id, cc.user_id)
  )
$$;

revoke all on function public.d1_has_eligible_topic_reviewer(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_has_eligible_topic_reviewer(uuid, uuid, uuid) to service_role;

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
      and not public.d1_is_topic_reviewer_excluded(t.id, cc.user_id)
  )
$$;

revoke all on function public.has_topic_review_access(uuid) from public, anon;
grant execute on function public.has_topic_review_access(uuid) to authenticated, service_role;

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
  select * into v_target
  from public.course_collaborators cc
  where cc.id = p_collaborator_id;
  if not found then raise exception 'COLLABORATOR_NOT_FOUND'; end if;

  if exists (
    select 1
    from public.topic_review_submissions s
    join public.topics t on t.id = s.topic_id
    where s.status = 'pending'::public.topic_review_submission_status
      and t.removed_at is null
      and t.course_id = v_target.course_id
      and not exists (
        select 1
        from public.course_collaborators cc
        join public.profiles p on p.id = cc.user_id
        where cc.course_id = t.course_id
          and p.removed_at is null
          and cc.user_id <> s.submitted_by_user_id
          and not public.d1_is_topic_reviewer_excluded(t.id, cc.user_id)
          and case
            when cc.id = v_target.id then
              not p_is_removal
              and (
                p_new_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
                or (
                  p_new_role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role)
                  and p_new_can_review_topics
                )
              )
            else
              cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
              or (
                cc.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role)
                and cc.can_review_topics
              )
          end
      )
  ) then
    raise exception 'COLLABORATOR_LAST_REVIEWER_REQUIRED';
  end if;
end;
$$;

revoke all on function public.d1_assert_pending_review_reviewer_safety(uuid, public.course_member_role, boolean, boolean) from public, anon, authenticated;
grant execute on function public.d1_assert_pending_review_reviewer_safety(uuid, public.course_member_role, boolean, boolean) to service_role;

create or replace function public.d1_transfer_topic_responsibility_locked(
  p_topic_id uuid,
  p_recipient_user_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
  v_recipient_role public.course_member_role;
begin
  select * into v_topic
  from public.topics t
  where t.id = p_topic_id
  for update;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if v_topic.status = 'pending'::public.item_status then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;
  if p_recipient_user_id is null or p_recipient_user_id = v_topic.responsible_author_user_id then
    raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID';
  end if;

  select cc.role into v_recipient_role
  from public.course_collaborators cc
  join public.profiles p on p.id = cc.user_id
  where cc.course_id = v_topic.course_id
    and cc.user_id = p_recipient_user_id
    and p.removed_at is null;
  if not found or v_recipient_role not in (
    'owner'::public.course_member_role,
    'co_owner'::public.course_member_role,
    'editor'::public.course_member_role
  ) then
    raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID';
  end if;

  if p_recipient_user_id = p_actor_user_id then
    if v_recipient_role not in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role) then
      raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID';
    end if;
  elsif v_recipient_role not in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
     and not exists (
       select 1
       from public.topic_contributors tc
       where tc.topic_id = v_topic.id
         and tc.user_id = p_recipient_user_id
         and tc.removed_at is null
     ) then
    raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID';
  end if;

  if v_topic.first_approved_at is null then
    insert into public.topic_author_review_exclusions (
      topic_id,
      user_id,
      exclusion_type,
      recorded_by_user_id
    ) values (
      v_topic.id,
      v_topic.responsible_author_user_id,
      'preapproval_responsible',
      p_actor_user_id
    ) on conflict (topic_id, user_id, exclusion_type) do nothing;
  end if;

  update public.topic_contributors
  set removed_at = timezone('utc', now()),
      removed_by_user_id = p_actor_user_id
  where topic_id = v_topic.id
    and user_id = p_recipient_user_id
    and removed_at is null;

  perform set_config('voca.d1_topic_authorship', 'on', true);
  update public.topics
  set responsible_author_user_id = p_recipient_user_id
  where id = v_topic.id;

  if p_recipient_user_id <> p_actor_user_id then
    insert into public.topic_authorship_feedback (
      topic_id,
      recipient_user_id,
      actor_user_id,
      previous_responsible_user_id,
      new_responsible_user_id,
      feedback_type
    ) values (
      v_topic.id,
      p_recipient_user_id,
      p_actor_user_id,
      v_topic.responsible_author_user_id,
      p_recipient_user_id,
      'responsibility_transfer'
    );
  end if;
end;
$$;

revoke all on function public.d1_transfer_topic_responsibility_locked(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_transfer_topic_responsibility_locked(uuid, uuid, uuid) to service_role;

create or replace function public.d1_transfer_member_topic_responsibilities(
  p_course_id uuid,
  p_member_user_id uuid,
  p_recipient_user_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
  v_count integer := 0;
begin
  if p_recipient_user_id is null then
    if exists (
      select 1 from public.topics t
      where t.course_id = p_course_id
        and t.responsible_author_user_id = p_member_user_id
        and t.first_approved_at is null
    ) then
      raise exception 'TOPIC_RESPONSIBILITY_TRANSFER_REQUIRED';
    end if;
    return 0;
  end if;

  for v_topic in
    select t.*
    from public.topics t
    where t.course_id = p_course_id
      and t.responsible_author_user_id = p_member_user_id
      and t.first_approved_at is null
    order by t.id
    for update
  loop
    perform public.d1_transfer_topic_responsibility_locked(
      v_topic.id,
      p_recipient_user_id,
      p_actor_user_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.d1_transfer_member_topic_responsibilities(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.d1_transfer_member_topic_responsibilities(uuid, uuid, uuid, uuid) to service_role;

create or replace function public.add_topic_contributor(
  p_topic_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_topic public.topics%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select t.course_id into v_topic.course_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if not public.is_course_owner_or_co_owner(v_topic.course_id) then
    raise exception 'TOPIC_AUTHORSHIP_MANAGEMENT_FORBIDDEN';
  end if;
  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if v_topic.removed_at is not null then raise exception 'TOPIC_REMOVED'; end if;
  if v_topic.status = 'pending'::public.item_status then raise exception 'TOPIC_PENDING_FROZEN'; end if;
  if not public.d1_is_active_course_author(v_topic.course_id, p_user_id) then
    raise exception 'TOPIC_CONTRIBUTOR_MEMBERSHIP_REQUIRED';
  end if;
  if p_user_id = v_topic.responsible_author_user_id then
    raise exception 'TOPIC_RESPONSIBLE_AUTHOR_NOT_CONTRIBUTOR';
  end if;

  insert into public.topic_contributors (topic_id, user_id, added_by_user_id)
  values (v_topic.id, p_user_id, v_actor);

  if v_topic.first_approved_at is null then
    insert into public.topic_author_review_exclusions (
      topic_id,
      user_id,
      exclusion_type,
      recorded_by_user_id
    ) values (
      v_topic.id,
      p_user_id,
      'initial_contributor',
      v_actor
    ) on conflict (topic_id, user_id, exclusion_type) do nothing;
  end if;

  return jsonb_build_object('status', 'added', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'user_id', p_user_id);
end;
$$;

create or replace function public.remove_topic_contributor(p_contributor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_contributor public.topic_contributors%rowtype;
  v_topic public.topics%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_contributor
  from public.topic_contributors tc
  where tc.id = p_contributor_id;
  if not found then raise exception 'TOPIC_CONTRIBUTOR_NOT_FOUND'; end if;
  select t.course_id into v_topic.course_id
  from public.topics t
  where t.id = v_contributor.topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  select * into v_contributor
  from public.topic_contributors tc
  where tc.id = p_contributor_id
  for update;
  if not found then raise exception 'TOPIC_CONTRIBUTOR_NOT_FOUND'; end if;
  select * into v_topic from public.topics t where t.id = v_contributor.topic_id for update;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if not public.is_course_owner_or_co_owner(v_topic.course_id) then
    raise exception 'TOPIC_AUTHORSHIP_MANAGEMENT_FORBIDDEN';
  end if;
  select * into v_topic from public.topics t where t.id = v_contributor.topic_id for update;
  if v_topic.status = 'pending'::public.item_status then raise exception 'TOPIC_PENDING_FROZEN'; end if;
  if v_contributor.removed_at is not null then raise exception 'TOPIC_CONTRIBUTOR_NOT_FOUND'; end if;

  update public.topic_contributors
  set removed_at = timezone('utc', now()),
      removed_by_user_id = v_actor
  where id = v_contributor.id;

  return jsonb_build_object('status', 'removed', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'user_id', v_contributor.user_id);
end;
$$;

revoke all on function public.add_topic_contributor(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_topic_contributor(uuid) from public, anon, authenticated;
grant execute on function public.add_topic_contributor(uuid, uuid) to authenticated, service_role;
grant execute on function public.remove_topic_contributor(uuid) to authenticated, service_role;

create or replace function public.transfer_topic_responsibility(
  p_topic_id uuid,
  p_recipient_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_topic public.topics%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select t.course_id into v_topic.course_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if not public.is_course_owner_or_co_owner(v_topic.course_id) then
    raise exception 'TOPIC_AUTHORSHIP_MANAGEMENT_FORBIDDEN';
  end if;
  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  perform public.d1_transfer_topic_responsibility_locked(p_topic_id, p_recipient_user_id, v_actor);
  return jsonb_build_object(
    'status', 'transferred',
    'course_id', v_topic.course_id,
    'topic_id', v_topic.id,
    'previous_responsible_user_id', v_topic.responsible_author_user_id,
    'new_responsible_user_id', p_recipient_user_id
  );
end;
$$;

revoke all on function public.transfer_topic_responsibility(uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_topic_responsibility(uuid, uuid) to authenticated, service_role;

create or replace function public.update_course_collaborator_role_with_responsibility(
  p_collaborator_id uuid,
  p_role public.course_member_role,
  p_recipient_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.course_collaborators%rowtype;
  v_new_flag boolean;
  v_cap integer;
  v_active_count integer;
  v_pending_count integer;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_target from public.course_collaborators cc where cc.id = p_collaborator_id;
  if not found then raise exception 'COLLABORATOR_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_target.course_id::text));
  select * into v_target from public.course_collaborators cc where cc.id = p_collaborator_id for update;
  if not public.is_course_owner_or_co_owner(v_target.course_id) then raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN'; end if;
  if v_target.role = 'owner'::public.course_member_role
     or (
       v_target.role = 'co_owner'::public.course_member_role
       and not exists (
         select 1 from public.course_collaborators cc
         where cc.course_id = v_target.course_id and cc.user_id = v_actor and cc.role = 'owner'::public.course_member_role
       )
     ) then
    raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN';
  end if;
  if p_role not in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) then
    raise exception 'COLLABORATOR_ROLE_CHANGE_OUTSIDE_D1';
  end if;

  if p_role <> v_target.role then
    v_cap := public.d1_course_collaborator_role_cap(p_role);
    select count(*) into v_active_count
    from public.course_collaborators cc
    where cc.course_id = v_target.course_id and cc.role = p_role;
    select count(*) into v_pending_count
    from public.course_collaborator_invitations i
    where i.course_id = v_target.course_id and i.role = p_role and i.status = 'pending';
    if v_active_count + v_pending_count >= v_cap then raise exception 'COLLABORATOR_ROLE_CAPACITY_REACHED'; end if;
  end if;

  v_new_flag := case
    when p_role = v_target.role then v_target.can_review_topics
    when v_target.role = 'previewer'::public.course_member_role and p_role = 'editor'::public.course_member_role then v_target.can_review_topics
    else false
  end;
  perform public.d1_assert_pending_review_reviewer_safety(v_target.id, p_role, v_new_flag, false);
  perform public.d1_transfer_member_topic_responsibilities(
    v_target.course_id,
    v_target.user_id,
    p_recipient_user_id,
    v_actor
  );
  update public.course_collaborators
  set role = p_role, can_review_topics = v_new_flag
  where id = v_target.id;
  return jsonb_build_object('status', 'updated', 'collaborator_id', v_target.id, 'role', p_role, 'can_review_topics', v_new_flag);
end;
$$;

create or replace function public.update_course_collaborator_role(
  p_collaborator_id uuid,
  p_role public.course_member_role
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.update_course_collaborator_role_with_responsibility(p_collaborator_id, p_role, null)
$$;

create or replace function public.remove_course_collaborator_with_responsibility(
  p_collaborator_id uuid,
  p_recipient_user_id uuid default null
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
  select * into v_target from public.course_collaborators cc where cc.id = p_collaborator_id for update;
  if not public.is_course_owner_or_co_owner(v_target.course_id) then raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN'; end if;
  if v_target.role = 'owner'::public.course_member_role then raise exception 'COURSE_OWNER_REMOVAL_FORBIDDEN'; end if;
  if v_target.role = 'co_owner'::public.course_member_role
     and not exists (
       select 1 from public.course_collaborators cc
       where cc.course_id = v_target.course_id and cc.user_id = v_actor and cc.role = 'owner'::public.course_member_role
     ) then
    raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN';
  end if;
  perform public.d1_assert_pending_review_reviewer_safety(v_target.id, v_target.role, false, true);
  perform public.d1_transfer_member_topic_responsibilities(
    v_target.course_id,
    v_target.user_id,
    p_recipient_user_id,
    v_actor
  );
  delete from public.course_collaborators where id = v_target.id;
  return jsonb_build_object('status', 'removed', 'collaborator_id', v_target.id);
end;
$$;

create or replace function public.remove_course_collaborator(p_collaborator_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.remove_course_collaborator_with_responsibility(p_collaborator_id, null)
$$;

create or replace function public.leave_course_collaboration(
  p_course_id uuid,
  p_recipient_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.course_collaborators%rowtype;
  v_transferred_count integer;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext(p_course_id::text));
  select * into v_target
  from public.course_collaborators cc
  where cc.course_id = p_course_id and cc.user_id = v_actor
  for update;
  if not found then raise exception 'COLLABORATOR_NOT_FOUND'; end if;
  if v_target.role = 'owner'::public.course_member_role then raise exception 'COURSE_OWNER_LEAVE_FORBIDDEN'; end if;
  if p_recipient_user_id = v_actor then raise exception 'TOPIC_RESPONSIBILITY_RECIPIENT_INVALID'; end if;
  perform public.d1_assert_pending_review_reviewer_safety(v_target.id, v_target.role, false, true);
  v_transferred_count := public.d1_transfer_member_topic_responsibilities(
    p_course_id,
    v_actor,
    p_recipient_user_id,
    v_actor
  );
  delete from public.course_collaborators where id = v_target.id;
  return jsonb_build_object('status', 'left', 'course_id', p_course_id, 'transferred_topic_count', v_transferred_count);
end;
$$;

revoke all on function public.update_course_collaborator_role_with_responsibility(uuid, public.course_member_role, uuid) from public, anon, authenticated;
revoke all on function public.update_course_collaborator_role(uuid, public.course_member_role) from public, anon;
revoke all on function public.remove_course_collaborator_with_responsibility(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_course_collaborator(uuid) from public, anon;
revoke all on function public.leave_course_collaboration(uuid, uuid) from public, anon, authenticated;
grant execute on function public.update_course_collaborator_role_with_responsibility(uuid, public.course_member_role, uuid) to authenticated, service_role;
grant execute on function public.update_course_collaborator_role(uuid, public.course_member_role) to authenticated, service_role;
grant execute on function public.remove_course_collaborator_with_responsibility(uuid, uuid) to authenticated, service_role;
grant execute on function public.remove_course_collaborator(uuid) to authenticated, service_role;
grant execute on function public.leave_course_collaboration(uuid, uuid) to authenticated, service_role;

drop policy if exists "Topics - Staff Update" on public.topics;
create policy "Topics - Staff Update" on public.topics
for update to authenticated
using (public.d1_topic_group_member(id) and status = 'draft'::public.item_status)
with check (public.d1_topic_group_member(id) and status = 'draft'::public.item_status);

drop policy if exists "Topics - Staff Soft Delete" on public.topics;
create policy "Topics - Staff Soft Delete" on public.topics
for update to authenticated
using (public.d1_topic_group_member(id) and status = 'draft'::public.item_status)
with check (public.d1_topic_group_member(id) and status = 'draft'::public.item_status);

revoke insert, update, delete on public.course_collaborators from authenticated;
grant select on public.course_collaborators to authenticated;

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
  if not public.has_course_authoring_access(v_topic.course_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_topic.responsible_author_user_id <> v_user_id then raise exception 'TOPIC_RESPONSIBLE_AUTHOR_REQUIRED'; end if;
  if exists (
    select 1 from public.topic_review_escalations e
    where e.topic_id = p_topic_id and e.submitted_by_user_id = v_user_id and e.unresolved
  ) then raise exception 'TOPIC_REVIEW_ESCALATION_HOLD'; end if;
  if exists (
    select 1 from public.topic_review_submissions s
    where s.topic_id = p_topic_id and s.status = 'pending'::public.topic_review_submission_status
  ) then raise exception 'TOPIC_REVIEW_ALREADY_PENDING'; end if;

  select count(*) into v_card_count from public.cards c where c.topic_id = p_topic_id and c.removed_at is null;
  select count(*) into v_exercise_count from public.exercises e where e.topic_id = p_topic_id and e.removed_at is null;
  if v_card_count < 1 or v_exercise_count < 1 then
    raise exception using message = 'TOPIC_REVIEW_NOT_READY', detail = format('active_flashcards=%s active_exercises=%s', v_card_count, v_exercise_count);
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
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select t.* into v_topic
  from public.topics t
  join public.chapters ch on ch.id = t.chapter_id
  join public.courses c on c.id = t.course_id
  where t.id = p_topic_id and t.removed_at is null and ch.removed_at is null and ch.course_id = t.course_id and c.removed_at is null;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  select cc.role into v_role
  from public.course_collaborators cc join public.profiles p on p.id = cc.user_id
  where cc.course_id = v_topic.course_id and cc.user_id = v_user_id and p.removed_at is null;
  if not found then raise exception 'TOPIC_WORKFLOW_FORBIDDEN'; end if;

  v_can_edit := public.d1_topic_group_member(v_topic.id);
  v_can_review := public.has_topic_review_access(v_topic.id);
  v_has_distinct_reviewer := public.d1_has_eligible_topic_reviewer(v_topic.id, v_user_id);
  select count(*) into v_card_count from public.cards c where c.topic_id = v_topic.id and c.removed_at is null;
  select count(*) into v_exercise_count from public.exercises e where e.topic_id = v_topic.id and e.removed_at is null;
  select * into v_pending from public.topic_review_submissions s where s.topic_id = v_topic.id and s.status = 'pending' order by s.submitted_at desc, s.id desc limit 1;
  select * into v_latest_rejection from public.topic_review_submissions s where s.topic_id = v_topic.id and s.submitted_by_user_id = v_user_id and s.status = 'rejected' order by s.reviewed_at desc nulls last, s.id desc limit 1;
  select * into v_escalation from public.topic_review_escalations e where e.topic_id = v_topic.id and e.unresolved order by e.updated_at desc, e.id desc limit 1;
  select count(*) into v_rejection_count from public.topic_review_submissions s where s.topic_id = v_topic.id and s.submitted_by_user_id = v_user_id and s.status = 'rejected';

  return jsonb_build_object(
    'topicId', v_topic.id, 'courseId', v_topic.course_id, 'chapterId', v_topic.chapter_id,
    'title', v_topic.title, 'status', v_topic.status, 'role', v_role,
    'canEdit', v_can_edit, 'canReview', v_can_review,
    'canRequestReview', v_can_edit and v_topic.responsible_author_user_id = v_user_id
      and v_topic.status = 'draft' and v_card_count > 0 and v_exercise_count > 0
      and v_has_distinct_reviewer and not coalesce(v_escalation.unresolved, false),
    'activeFlashcardCount', v_card_count, 'activeExerciseCount', v_exercise_count,
    'isReady', v_card_count > 0 and v_exercise_count > 0,
    'pendingSubmissionId', v_pending.id, 'pendingSubmitterId', v_pending.submitted_by_user_id,
    'isCurrentUserSubmitter', coalesce(v_pending.submitted_by_user_id = v_user_id, false),
    'latestRejectionReason', v_latest_rejection.rejection_reason, 'rejectionCount', v_rejection_count,
    'escalationUnresolved', coalesce(v_escalation.unresolved, false),
    'hasDistinctEligibleReviewer', v_has_distinct_reviewer, 'escalationId', v_escalation.id,
    'escalationSubmitterId', v_escalation.submitted_by_user_id,
    'canResolveEscalation', v_role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
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
  select * into v_escalation from public.topic_review_escalations e where e.id = p_escalation_id for update;
  perform pg_advisory_xact_lock(hashtext(v_escalation.topic_id::text));
  select * into v_topic from public.topics t where t.id = v_escalation.topic_id for update;
  if not v_escalation.unresolved then raise exception 'TOPIC_REVIEW_ESCALATION_STALE'; end if;
  if not public.is_course_owner_or_co_owner(v_topic.course_id) then raise exception 'TOPIC_REVIEW_ESCALATION_FORBIDDEN'; end if;

  if p_action = 'rescue' then
    if v_escalation.submitted_by_user_id = v_user_id then raise exception 'TOPIC_REVIEW_RESCUE_FORBIDDEN'; end if;
    if v_topic.removed_at is not null or v_topic.status <> 'draft' then raise exception 'TOPIC_NOT_DRAFT'; end if;
    select count(*) into v_card_count from public.cards c where c.topic_id = v_topic.id and c.removed_at is null;
    select count(*) into v_exercise_count from public.exercises e where e.topic_id = v_topic.id and e.removed_at is null;
    if v_card_count < 1 or v_exercise_count < 1 then raise exception 'TOPIC_REVIEW_NOT_READY'; end if;
    if not public.d1_has_eligible_topic_reviewer(v_topic.id, v_user_id, v_escalation.submitted_by_user_id) then raise exception 'TOPIC_REVIEW_NO_REMAINING_REVIEWER'; end if;
    if exists (select 1 from public.topic_review_escalations e where e.topic_id = v_topic.id and e.unresolved and e.id <> v_escalation.id) then raise exception 'TOPIC_REVIEW_ESCALATION_HOLD'; end if;
    if exists (select 1 from public.topic_review_submissions s where s.topic_id = v_topic.id and s.status = 'pending') then raise exception 'TOPIC_REVIEW_ALREADY_PENDING'; end if;
    select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number from public.topic_review_submissions s where s.topic_id = v_topic.id and s.submitted_by_user_id = v_user_id;
    insert into public.topic_review_submissions (topic_id, submitted_by_user_id, status, attempt_number, rescue_escalation_id)
    values (v_topic.id, v_user_id, 'pending', v_attempt_number, v_escalation.id) returning * into v_submission;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics set status = 'pending' where id = v_topic.id;
    return jsonb_build_object('status', 'pending', 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'submission_id', v_submission.id, 'escalation_id', v_escalation.id);
  end if;

  update public.topic_review_escalations
  set unresolved = false, resolved_by_user_id = v_user_id, resolved_at = now(), resolution_action = p_action, resolution_reason = v_reason
  where id = v_escalation.id;
  if p_action = 'abandon' then
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    update public.topics set removed_at = now(), status = 'draft' where id = v_topic.id;
  end if;
  return jsonb_build_object('status', case when p_action = 'abandon' then 'removed' else 'draft' end, 'course_id', v_topic.course_id, 'topic_id', v_topic.id, 'escalation_id', v_escalation.id);
end;
$$;

revoke all on function public.request_topic_review(uuid) from public, anon;
revoke all on function public.get_topic_workflow_state(uuid) from public, anon;
revoke all on function public.resolve_topic_review_escalation(uuid, text, text) from public, anon;
grant execute on function public.request_topic_review(uuid) to authenticated, service_role;
grant execute on function public.get_topic_workflow_state(uuid) to authenticated, service_role;
grant execute on function public.resolve_topic_review_escalation(uuid, text, text) to authenticated, service_role;
