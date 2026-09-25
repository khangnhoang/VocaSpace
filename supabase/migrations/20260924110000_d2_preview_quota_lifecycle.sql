alter table public.topics
  add column is_preview boolean not null default false;

-- Preview eligibility stays behind the guarded RPCs. Keep existing content
-- readers' safe topic columns while withholding the persisted marker itself.
revoke select on table public.topics from public, anon, authenticated;
grant select (
  id,
  chapter_id,
  course_id,
  title,
  slug,
  description,
  status,
  order_index,
  original_creator_user_id,
  responsible_author_user_id,
  first_approved_at,
  created_at,
  updated_at,
  removed_at
) on table public.topics to anon, authenticated;

revoke update on table public.topics from public, anon, authenticated;
revoke update (is_preview, removed_at) on table public.topics
  from public, anon, authenticated;

create table public.course_preview_moderation_causes (
  course_id uuid primary key references public.courses(id) on delete cascade,
  audit_id uuid not null unique references public.platform_moderation_audits(id),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.course_preview_moderation_causes enable row level security;
revoke all on table public.course_preview_moderation_causes
  from public, anon, authenticated;
grant all on table public.course_preview_moderation_causes to service_role;

create or replace function public.d2_can_manage_course_preview(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.courses c
    join public.course_collaborators cc on cc.course_id = c.id
    join public.profiles p on p.id = cc.user_id
    where c.id = target_course_id
      and c.removed_at is null
      and cc.user_id = auth.uid()
      and cc.role in (
        'owner'::public.course_member_role,
        'co_owner'::public.course_member_role,
        'editor'::public.course_member_role
      )
      and p.removed_at is null
  )
$$;

revoke all on function public.d2_can_manage_course_preview(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.d2_preview_quota(target_course_id uuid)
returns table(active_topic_count integer, marked_topic_count integer, quota_cap integer)
language sql
stable
security definer
set search_path = public
as $$
  with counts as (
    select
      count(*)::integer as active_count,
      count(*) filter (where t.is_preview)::integer as marked_count
    from public.topics t
    join public.chapters ch
      on ch.id = t.chapter_id
     and ch.course_id = t.course_id
     and ch.removed_at is null
    where t.course_id = target_course_id
      and t.removed_at is null
  )
  select
    active_count,
    marked_count,
    ((active_count + 4) / 5)::integer
  from counts
$$;

revoke all on function public.d2_preview_quota(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.d2_preview_cause_matches_course(
  target_course_id uuid,
  target_audit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_moderation_audits a
    where a.id = target_audit_id
      and (
        (a.target_type = 'course' and a.target_id = target_course_id)
        or (
          a.target_type = 'chapter'
          and exists (
            select 1 from public.chapters ch
            where ch.id = a.target_id and ch.course_id = target_course_id
          )
        )
        or (
          a.target_type = 'topic'
          and exists (
            select 1 from public.topics t
            where t.id = a.target_id and t.course_id = target_course_id
          )
        )
      )
  )
$$;

revoke all on function public.d2_preview_cause_matches_course(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.d2_preview_allocation_snapshot(target_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quota record;
  v_cause jsonb;
  v_cause_verified boolean := false;
begin
  select * into v_quota from public.d2_preview_quota(target_course_id);

  if v_quota.marked_topic_count > v_quota.quota_cap then
    select public.d2_preview_cause_matches_course(p.course_id, p.audit_id)
    into v_cause_verified
    from public.course_preview_moderation_causes p
    where p.course_id = target_course_id;

    if coalesce(v_cause_verified, false) then
      select jsonb_build_object(
        'action', a.action,
        'reason', a.reason,
        'targetType', a.target_type,
        'targetLabel', coalesce(
          case a.target_type
            when 'course' then (select c.title from public.courses c where c.id = a.target_id)
            when 'chapter' then (select ch.title from public.chapters ch where ch.id = a.target_id)
            when 'topic' then (select t.title from public.topics t where t.id = a.target_id)
          end,
          case a.target_type
            when 'course' then 'Khóa học'
            when 'chapter' then 'Chương'
            else 'Bài học'
          end
        )
      )
      into v_cause
      from public.course_preview_moderation_causes p
      join public.platform_moderation_audits a on a.id = p.audit_id
      where p.course_id = target_course_id;
    end if;
  end if;

  return jsonb_build_object(
    'courseId', target_course_id,
    'activeTopicCount', v_quota.active_topic_count,
    'markedTopicCount', v_quota.marked_topic_count,
    'cap', v_quota.quota_cap,
    'remaining', greatest(v_quota.quota_cap - v_quota.marked_topic_count, 0),
    'excess', greatest(v_quota.marked_topic_count - v_quota.quota_cap, 0),
    'isSuspended', v_quota.marked_topic_count > v_quota.quota_cap,
    'causeVerified', case
      when v_quota.marked_topic_count > v_quota.quota_cap
        then coalesce(v_cause_verified, false)
      else null
    end,
    'cause', v_cause,
    'markedTopics', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'title', t.title,
          'status', t.status,
          'chapterId', ch.id,
          'chapterTitle', ch.title,
          'chapterOrderIndex', ch.order_index
        )
        order by ch.order_index, ch.created_at, ch.id, t.order_index, t.created_at, t.id
      )
      from public.topics t
      join public.chapters ch
        on ch.id = t.chapter_id
       and ch.course_id = t.course_id
       and ch.removed_at is null
      where t.course_id = target_course_id
        and t.removed_at is null
        and t.is_preview
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.d2_preview_allocation_snapshot(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.d2_enforce_preview_quota_transition(
  target_course_id uuid,
  before_active_count integer,
  before_marked_count integer,
  after_active_count integer,
  after_marked_count integer,
  allow_denominator_growth boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before_cap integer := (before_active_count + 4) / 5;
  v_after_cap integer := (after_active_count + 4) / 5;
begin
  if after_marked_count <= v_after_cap then
    delete from public.course_preview_moderation_causes p
    where p.course_id = target_course_id;
    return;
  end if;

  if before_marked_count <= v_before_cap then
    raise exception 'PREVIEW_QUOTA_RESOLUTION_REQUIRED';
  end if;

  if allow_denominator_growth
     and after_active_count > before_active_count
     and after_marked_count <= before_marked_count
     and after_marked_count - v_after_cap <= before_marked_count - v_before_cap
     and public.d2_preview_cause_matches_course(
       target_course_id,
       (select p.audit_id
        from public.course_preview_moderation_causes p
        where p.course_id = target_course_id)
     ) then
    return;
  end if;

  raise exception 'PREVIEW_QUOTA_RESOLUTION_REQUIRED';
end;
$$;

revoke all on function public.d2_enforce_preview_quota_transition(uuid, integer, integer, integer, integer, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.d2_finish_preview_mutation(
  target_course_id uuid,
  before_active_count integer,
  before_marked_count integer,
  allow_denominator_growth boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota record;
begin
  select * into v_quota from public.d2_preview_quota(target_course_id);
  perform public.d2_enforce_preview_quota_transition(
    target_course_id,
    before_active_count,
    before_marked_count,
    v_quota.active_topic_count,
    v_quota.marked_topic_count,
    allow_denominator_growth
  );
  return public.d2_preview_allocation_snapshot(target_course_id);
end;
$$;

revoke all on function public.d2_finish_preview_mutation(uuid, integer, integer, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.d2_assert_selected_preview_markers(
  target_course_id uuid,
  selected_topic_ids uuid[],
  excluded_topic_id uuid default null,
  excluded_chapter_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic_count integer;
  v_distinct_topic_count integer;
begin
  select count(*)::integer, count(distinct selected.topic_id)::integer
  into v_topic_count, v_distinct_topic_count
  from unnest(coalesce(selected_topic_ids, '{}'::uuid[])) as selected(topic_id);

  if v_topic_count <> v_distinct_topic_count then
    raise exception 'PREVIEW_SELECTION_INVALID';
  end if;

  if exists (
    select 1
    from unnest(coalesce(selected_topic_ids, '{}'::uuid[])) as selected(topic_id)
    left join public.topics t on t.id = selected.topic_id
    left join public.chapters ch on ch.id = t.chapter_id
    where selected.topic_id is null
       or t.id is null
       or t.course_id <> target_course_id
       or t.removed_at is not null
       or not t.is_preview
       or ch.id is null
       or ch.course_id <> target_course_id
       or ch.removed_at is not null
       or t.id = excluded_topic_id
       or t.chapter_id = excluded_chapter_id
  ) then
    raise exception 'PREVIEW_SELECTION_STALE';
  end if;
end;
$$;

revoke all on function public.d2_assert_selected_preview_markers(uuid, uuid[], uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.d2_guard_topic_preview_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_before record;
  v_old_active boolean := false;
  v_new_active boolean := false;
  v_after_active integer;
  v_after_marked integer;
  v_parent_removed_at timestamptz;
begin
  if auth.uid() is null
     or coalesce(auth.role(), '') = 'service_role'
     or current_setting('voca.d2_preview_internal_mutation', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then raise exception 'TOPIC_LIFECYCLE_GUARDED'; end if;
  if tg_op = 'INSERT' and new.is_preview then
    raise exception 'TOPIC_PREVIEW_MARKER_GUARDED';
  end if;
  if tg_op = 'UPDATE' and old.is_preview is distinct from new.is_preview then
    raise exception 'TOPIC_PREVIEW_MARKER_GUARDED';
  end if;
  if tg_op = 'UPDATE' and old.removed_at is distinct from new.removed_at then
    raise exception 'TOPIC_LIFECYCLE_GUARDED';
  end if;

  v_course_id := case when tg_op = 'DELETE' then old.course_id else new.course_id end;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  select * into v_before from public.d2_preview_quota(v_course_id);

  if tg_op = 'UPDATE' and (new.course_id is distinct from old.course_id or new.chapter_id is distinct from old.chapter_id) then
    raise exception 'TOPIC_LIFECYCLE_GUARDED';
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select ch.removed_at
    into v_parent_removed_at
    from public.chapters ch
    where ch.id = old.chapter_id
      and ch.course_id = old.course_id;
    v_old_active := old.removed_at is null and v_parent_removed_at is null;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select ch.removed_at
    into v_parent_removed_at
    from public.chapters ch
    where ch.id = new.chapter_id
      and ch.course_id = new.course_id;
    v_new_active := new.removed_at is null and v_parent_removed_at is null;

    if tg_op = 'UPDATE'
       and old.removed_at is null
       and new.removed_at is not null then
      new.is_preview := false;
    elsif tg_op = 'UPDATE'
       and old.removed_at is not null
       and new.removed_at is null then
      new.is_preview := false;
    end if;
  end if;

  v_after_active := v_before.active_topic_count;
  v_after_marked := v_before.marked_topic_count;

  if tg_op in ('UPDATE', 'DELETE') and v_old_active then
    v_after_active := v_after_active - 1;
    if old.is_preview then v_after_marked := v_after_marked - 1; end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and v_new_active then
    v_after_active := v_after_active + 1;
    if new.is_preview then v_after_marked := v_after_marked + 1; end if;
  end if;

  perform public.d2_enforce_preview_quota_transition(
    v_course_id,
    v_before.active_topic_count,
    v_before.marked_topic_count,
    v_after_active,
    v_after_marked,
    v_after_active > v_before.active_topic_count
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.d2_guard_topic_preview_quota()
  from public, anon, authenticated, service_role;

drop trigger if exists d2_guard_topic_preview_quota on public.topics;
drop trigger if exists d2_guard_topic_preview_quota_insert_delete on public.topics;
drop trigger if exists d2_guard_topic_preview_quota_update on public.topics;
create trigger d2_guard_topic_preview_quota_insert_delete
before insert or delete
on public.topics
for each row execute function public.d2_guard_topic_preview_quota();

create trigger d2_guard_topic_preview_quota_update
before update of is_preview, removed_at, chapter_id, course_id
on public.topics
for each row execute function public.d2_guard_topic_preview_quota();

create or replace function public.d2_guard_chapter_preview_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before record;
  v_child_active_count integer := 0;
  v_child_marked_count integer := 0;
  v_after_active integer;
  v_after_marked integer;
begin
  if auth.uid() is null
     or coalesce(auth.role(), '') = 'service_role'
     or current_setting('voca.d2_preview_internal_mutation', true) = 'on' then
    return new;
  end if;

  if old.removed_at is distinct from new.removed_at then
    raise exception 'CHAPTER_LIFECYCLE_GUARDED';
  end if;

  perform pg_advisory_xact_lock(hashtext(old.course_id::text));
  select * into v_before from public.d2_preview_quota(old.course_id);

  select
    count(*)::integer,
    count(*) filter (where t.is_preview)::integer
  into v_child_active_count, v_child_marked_count
  from public.topics t
  where t.chapter_id = old.id
    and t.course_id = old.course_id
    and t.removed_at is null;

  v_after_active := v_before.active_topic_count;
  v_after_marked := v_before.marked_topic_count;

  if old.removed_at is null and new.removed_at is not null then
    v_after_active := v_after_active - v_child_active_count;
    v_after_marked := v_after_marked - v_child_marked_count;
  elsif old.removed_at is not null and new.removed_at is null then
    v_after_active := v_after_active + v_child_active_count;
    v_after_marked := v_after_marked + v_child_marked_count;
  end if;

  perform public.d2_enforce_preview_quota_transition(
    old.course_id,
    v_before.active_topic_count,
    v_before.marked_topic_count,
    v_after_active,
    v_after_marked,
    v_after_active > v_before.active_topic_count
  );

  return new;
end;
$$;

revoke all on function public.d2_guard_chapter_preview_quota()
  from public, anon, authenticated, service_role;

drop trigger if exists d2_guard_chapter_preview_quota on public.chapters;
create trigger d2_guard_chapter_preview_quota
before update of removed_at on public.chapters
for each row execute function public.d2_guard_chapter_preview_quota();

create or replace function public.get_course_preview_allocation(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext(p_course_id::text));
  if not public.d2_can_manage_course_preview(p_course_id) then
    raise exception 'COURSE_PREVIEW_FORBIDDEN';
  end if;
  return public.d2_preview_allocation_snapshot(p_course_id);
end;
$$;

revoke all on function public.get_course_preview_allocation(uuid)
  from public, anon;
grant execute on function public.get_course_preview_allocation(uuid)
  to authenticated, service_role;

create or replace function public.set_course_topic_preview_markers(
  p_course_id uuid,
  p_mark_topic_ids uuid[] default '{}'::uuid[],
  p_unmark_topic_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before record;
  v_after record;
  v_mark_count integer;
  v_mark_distinct integer;
  v_unmark_count integer;
  v_unmark_distinct integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext(p_course_id::text));
  if not public.d2_can_manage_course_preview(p_course_id) then
    raise exception 'COURSE_PREVIEW_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.removed_at is null
  ) then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select count(*)::integer, count(distinct x.topic_id)::integer
  into v_mark_count, v_mark_distinct
  from unnest(coalesce(p_mark_topic_ids, '{}'::uuid[])) as x(topic_id);
  if v_mark_count <> v_mark_distinct then raise exception 'PREVIEW_SELECTION_INVALID'; end if;
  select count(*)::integer, count(distinct x.topic_id)::integer
  into v_unmark_count, v_unmark_distinct
  from unnest(coalesce(p_unmark_topic_ids, '{}'::uuid[])) as x(topic_id);
  if v_unmark_count <> v_unmark_distinct then raise exception 'PREVIEW_SELECTION_INVALID'; end if;
  if exists (
    select 1
    from unnest(coalesce(p_mark_topic_ids, '{}'::uuid[])) m(topic_id)
    join unnest(coalesce(p_unmark_topic_ids, '{}'::uuid[])) u(topic_id)
      on u.topic_id = m.topic_id
  ) then raise exception 'PREVIEW_SELECTION_INVALID'; end if;

  if exists (
    select 1
    from unnest(coalesce(p_mark_topic_ids, '{}'::uuid[])) x(topic_id)
    left join public.topics t on t.id = x.topic_id
    left join public.chapters ch on ch.id = t.chapter_id
    where x.topic_id is null or t.id is null
       or t.course_id <> p_course_id or t.removed_at is not null or t.is_preview
       or ch.id is null or ch.course_id <> p_course_id or ch.removed_at is not null
  ) then raise exception 'PREVIEW_SELECTION_STALE'; end if;

  perform public.d2_assert_selected_preview_markers(p_course_id, p_unmark_topic_ids);
  perform pg_advisory_xact_lock(hashtext(topic_id::text))
  from (
    select distinct ids.topic_id
    from unnest(
      coalesce(p_mark_topic_ids, '{}'::uuid[]) ||
      coalesce(p_unmark_topic_ids, '{}'::uuid[])
    ) ids(topic_id)
    order by ids.topic_id
  ) selected;
  perform t.id
  from public.topics t
  where t.id = any(
    coalesce(p_mark_topic_ids, '{}'::uuid[]) ||
    coalesce(p_unmark_topic_ids, '{}'::uuid[])
  )
  order by t.id
  for update;

  select * into v_before from public.d2_preview_quota(p_course_id);
  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  perform set_config('voca.d2_preview_internal_mutation', 'on', true);
  update public.topics
  set is_preview = true
  where id = any(coalesce(p_mark_topic_ids, '{}'::uuid[])) and not is_preview;
  update public.topics
  set is_preview = false
  where id = any(coalesce(p_unmark_topic_ids, '{}'::uuid[])) and is_preview;
  select * into v_after from public.d2_preview_quota(p_course_id);
  perform public.d2_enforce_preview_quota_transition(
    p_course_id,
    v_before.active_topic_count,
    v_before.marked_topic_count,
    v_after.active_topic_count,
    v_after.marked_topic_count,
    false
  );
  return public.d2_preview_allocation_snapshot(p_course_id);
end;
$$;

revoke all on function public.set_course_topic_preview_markers(uuid, uuid[], uuid[])
  from public, anon;
grant execute on function public.set_course_topic_preview_markers(uuid, uuid[], uuid[])
  to authenticated, service_role;

create or replace function public.d2_preview_outside_markers(
  target_course_id uuid,
  excluded_chapter_id uuid default null,
  excluded_topic_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'status', t.status,
      'chapterId', ch.id,
      'chapterTitle', ch.title,
      'chapterOrderIndex', ch.order_index
    ) order by ch.order_index, ch.created_at, ch.id, t.order_index, t.created_at, t.id
  ), '[]'::jsonb)
  from public.topics t
  join public.chapters ch
    on ch.id = t.chapter_id
   and ch.course_id = t.course_id
   and ch.removed_at is null
  where t.course_id = target_course_id
    and t.removed_at is null
    and t.is_preview
    and t.chapter_id is distinct from excluded_chapter_id
    and t.id is distinct from excluded_topic_id
$$;

revoke all on function public.d2_preview_outside_markers(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_chapter_hide_preview_projection(p_chapter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chapter public.chapters%rowtype;
  v_course_id uuid;
  v_before record;
  v_internal_active integer;
  v_internal_marked integer;
  v_after_active integer;
  v_after_marked integer;
  v_after_cap integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_chapter from public.chapters ch where ch.id = p_chapter_id;
  if not found or v_chapter.removed_at is not null then raise exception 'CHAPTER_NOT_FOUND'; end if;
  v_course_id := v_chapter.course_id;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  select * into v_chapter from public.chapters ch
  where ch.id = p_chapter_id and ch.course_id = v_course_id
  for update;
  if not found or v_chapter.removed_at is not null then raise exception 'CHAPTER_NOT_FOUND'; end if;
  if not public.can_manage_chapter_by_id(v_chapter.id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
  if exists (
    select 1 from public.topics t
    where t.chapter_id = v_chapter.id and t.status = 'pending'::public.item_status
      and t.removed_at is null
  ) then raise exception 'TOPIC_PENDING_FROZEN'; end if;

  select * into v_before from public.d2_preview_quota(v_chapter.course_id);
  select count(*)::integer, count(*) filter (where t.is_preview)::integer
  into v_internal_active, v_internal_marked
  from public.topics t
  where t.chapter_id = v_chapter.id and t.course_id = v_chapter.course_id
    and t.removed_at is null;
  v_after_active := v_before.active_topic_count - v_internal_active;
  v_after_marked := v_before.marked_topic_count - v_internal_marked;
  v_after_cap := (v_after_active + 4) / 5;
  return jsonb_build_object(
    'courseId', v_chapter.course_id,
    'chapterId', v_chapter.id,
    'currentAllocation', public.d2_preview_allocation_snapshot(v_chapter.course_id),
    'projectedActiveTopicCount', v_after_active,
    'projectedMarkedTopicCount', v_after_marked,
    'projectedCap', v_after_cap,
    'requiredUnmarkCount', greatest(v_after_marked - v_after_cap, 0),
    'internalActiveTopicCount', v_internal_active,
    'internalMarkedTopicCount', v_internal_marked,
    'outsideMarkedTopics', public.d2_preview_outside_markers(v_chapter.course_id, v_chapter.id),
    'canManageMarkers', public.d2_can_manage_course_preview(v_chapter.course_id)
  );
end;
$$;

revoke all on function public.get_chapter_hide_preview_projection(uuid)
  from public, anon;
grant execute on function public.get_chapter_hide_preview_projection(uuid)
  to authenticated, service_role;

create or replace function public.get_topic_delete_preview_projection(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
  v_before record;
  v_after_active integer;
  v_after_marked integer;
  v_after_cap integer;
  v_can_manage_markers boolean;
  v_allocation jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_topic from public.topics t where t.id = p_topic_id;
  if not found or v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_topic.course_id::text));
  perform pg_advisory_xact_lock(hashtext(v_topic.id::text));
  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  if not found or v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;
  if not public.d1_can_delete_topic(v_topic.id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;

  select * into v_before from public.d2_preview_quota(v_topic.course_id);
  v_after_active := v_before.active_topic_count - case
    when exists (
      select 1 from public.chapters ch where ch.id = v_topic.chapter_id
        and ch.course_id = v_topic.course_id and ch.removed_at is null
    ) then 1 else 0 end;
  v_after_marked := v_before.marked_topic_count - case
    when v_topic.is_preview and exists (
      select 1 from public.chapters ch where ch.id = v_topic.chapter_id
        and ch.course_id = v_topic.course_id and ch.removed_at is null
    ) then 1 else 0 end;
  v_after_cap := (v_after_active + 4) / 5;
  v_can_manage_markers := public.d2_can_manage_course_preview(v_topic.course_id);
  if v_can_manage_markers then
    v_allocation := public.d2_preview_allocation_snapshot(v_topic.course_id);
  else
    v_allocation := jsonb_build_object(
      'courseId', v_topic.course_id,
      'activeTopicCount', v_before.active_topic_count,
      'markedTopicCount', v_before.marked_topic_count,
      'cap', v_before.quota_cap,
      'remaining', greatest(v_before.quota_cap - v_before.marked_topic_count, 0),
      'excess', greatest(v_before.marked_topic_count - v_before.quota_cap, 0),
      'isSuspended', v_before.marked_topic_count > v_before.quota_cap,
      'causeVerified', case when v_before.marked_topic_count > v_before.quota_cap then false else null end,
      'cause', null,
      'markedTopics', '[]'::jsonb
    );
  end if;
  return jsonb_build_object(
    'courseId', v_topic.course_id,
    'topicId', v_topic.id,
    'currentAllocation', v_allocation,
    'projectedActiveTopicCount', v_after_active,
    'projectedMarkedTopicCount', v_after_marked,
    'projectedCap', v_after_cap,
    'requiredUnmarkCount', greatest(v_after_marked - v_after_cap, 0),
    'targetIsPreview', v_topic.is_preview,
    'canManageMarkers', v_can_manage_markers,
    'outsideMarkedTopics', case when v_can_manage_markers
      then public.d2_preview_outside_markers(v_topic.course_id, null, v_topic.id)
      else '[]'::jsonb end
  );
end;
$$;

revoke all on function public.get_topic_delete_preview_projection(uuid)
  from public, anon;
grant execute on function public.get_topic_delete_preview_projection(uuid)
  to authenticated, service_role;

drop function if exists public.hide_chapter(uuid);
create function public.hide_chapter(
  p_chapter_id uuid,
  p_unmark_topic_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_course_id uuid;
  v_course public.courses%rowtype;
  v_chapter public.chapters%rowtype;
  v_before record;
  v_allocation jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select ch.course_id into v_initial_course_id
  from public.chapters ch where ch.id = p_chapter_id;
  if not found then raise exception 'CHAPTER_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtext(v_initial_course_id::text));
  select * into v_course from public.courses c
  where c.id = v_initial_course_id for update;
  if not found or v_course.removed_at is not null then raise exception 'COURSE_NOT_FOUND'; end if;
  select * into v_chapter from public.chapters ch
  where ch.id = p_chapter_id and ch.course_id = v_course.id for update;
  if not found or v_chapter.removed_at is not null then raise exception 'CHAPTER_NOT_FOUND'; end if;
  if not public.can_manage_chapter_by_id(v_chapter.id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  -- D1's pending-child freeze takes precedence over quota resolution.
  if exists (
    select 1 from public.topics t
    where t.chapter_id = v_chapter.id
      and t.status = 'pending'::public.item_status
      and t.removed_at is null
  ) then raise exception 'TOPIC_PENDING_FROZEN'; end if;

  if cardinality(coalesce(p_unmark_topic_ids, '{}'::uuid[])) > 0
     and not public.d2_can_manage_course_preview(v_chapter.course_id) then
    raise exception 'COURSE_PREVIEW_MARKER_MANAGEMENT_REQUIRED';
  end if;
  perform public.d2_assert_selected_preview_markers(
    v_chapter.course_id,
    p_unmark_topic_ids,
    null,
    v_chapter.id
  );
  select * into v_before from public.d2_preview_quota(v_chapter.course_id);

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  perform set_config('voca.d2_preview_internal_mutation', 'on', true);
  update public.topics t set is_preview = false
  where t.course_id = v_chapter.course_id
    and t.chapter_id = v_chapter.id
    and t.is_preview;
  update public.topics t set is_preview = false
  where t.id = any(coalesce(p_unmark_topic_ids, '{}'::uuid[]))
    and t.is_preview;
  update public.chapters ch
  set removed_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where ch.id = v_chapter.id;

  v_allocation := public.d2_finish_preview_mutation(
    v_chapter.course_id,
    v_before.active_topic_count,
    v_before.marked_topic_count,
    false
  );
  return jsonb_build_object(
    'status', 'hidden',
    'course_id', v_chapter.course_id,
    'chapter_id', v_chapter.id,
    'preview_allocation', v_allocation
  );
end;
$$;

revoke all on function public.hide_chapter(uuid, uuid[]) from public, anon;
grant execute on function public.hide_chapter(uuid, uuid[]) to authenticated, service_role;

drop function if exists public.d1_delete_topic(uuid, boolean);
create function public.d1_delete_topic(
  p_topic_id uuid,
  p_confirm_published boolean default false,
  p_unmark_topic_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
  v_before record;
  v_allocation jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_topic := public.d1_lock_topic_lifecycle(p_topic_id);
  if v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;
  if not public.d1_can_delete_topic(v_topic.id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_topic.status = 'published' and not coalesce(p_confirm_published, false) then
    raise exception 'TOPIC_PUBLISHED_CONFIRM_REQUIRED';
  end if;
  if cardinality(coalesce(p_unmark_topic_ids, '{}'::uuid[])) > 0
     and not public.d2_can_manage_course_preview(v_topic.course_id) then
    raise exception 'COURSE_PREVIEW_MARKER_MANAGEMENT_REQUIRED';
  end if;
  perform public.d2_assert_selected_preview_markers(
    v_topic.course_id,
    p_unmark_topic_ids,
    v_topic.id,
    null
  );
  select * into v_before from public.d2_preview_quota(v_topic.course_id);

  -- D1 still owns pending review cancellation and published confirmation.
  if v_topic.status = 'pending' then
    perform public.d1_cancel_pending_reviews_for_topics(
      array[p_topic_id], auth.uid(), 'Hủy yêu cầu duyệt để xóa bài học.'
    );
  end if;

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  perform set_config('voca.d2_preview_internal_mutation', 'on', true);
  update public.topics t set is_preview = false
  where t.id = any(coalesce(p_unmark_topic_ids, '{}'::uuid[])) and t.is_preview;
  update public.topics t
  set is_preview = false,
      status = 'draft',
      removed_at = timezone('utc', now())
  where t.id = p_topic_id;

  v_allocation := public.d2_finish_preview_mutation(
    v_topic.course_id,
    v_before.active_topic_count,
    v_before.marked_topic_count,
    false
  );
  return jsonb_build_object(
    'status', 'removed',
    'course_id', v_topic.course_id,
    'topic_id', p_topic_id,
    'preview_allocation', v_allocation
  );
end;
$$;

revoke all on function public.d1_delete_topic(uuid, boolean, uuid[]) from public, anon;
grant execute on function public.d1_delete_topic(uuid, boolean, uuid[]) to authenticated, service_role;

create or replace function public.d1_restore_topic(p_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic public.topics%rowtype;
  v_before record;
  v_allocation jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_topic := public.d1_lock_topic_lifecycle(p_topic_id);
  if not public.d1_can_delete_topic(v_topic.id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_topic.status = 'pending' then raise exception 'TOPIC_PENDING_FROZEN'; end if;
  if v_topic.removed_at is null then raise exception 'TOPIC_NOT_REMOVED'; end if;
  if v_topic.chapter_id is null or not exists (
    select 1 from public.chapters ch
    where ch.id = v_topic.chapter_id and ch.course_id = v_topic.course_id and ch.removed_at is null
  ) then raise exception 'CHAPTER_NOT_FOUND'; end if;
  if not exists (select 1 from public.courses c where c.id = v_topic.course_id and c.removed_at is null) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  select * into v_before from public.d2_preview_quota(v_topic.course_id);

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  perform set_config('voca.d2_preview_internal_mutation', 'on', true);
  update public.topics t
  set status = 'draft', removed_at = null, is_preview = false
  where t.id = p_topic_id;

  v_allocation := public.d2_finish_preview_mutation(
    v_topic.course_id,
    v_before.active_topic_count,
    v_before.marked_topic_count,
    true
  );
  return jsonb_build_object(
    'status', 'restored', 'course_id', v_topic.course_id,
    'topic_id', p_topic_id, 'preview_allocation', v_allocation
  );
end;
$$;

revoke all on function public.d1_restore_topic(uuid) from public, anon;
grant execute on function public.d1_restore_topic(uuid) to authenticated, service_role;

create or replace function public.restore_chapter_ordered(p_chapter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_course_id uuid;
  v_course public.courses%rowtype;
  v_chapter public.chapters%rowtype;
  v_next_order integer;
  v_before record;
  v_allocation jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select ch.course_id into v_initial_course_id
  from public.chapters ch where ch.id = p_chapter_id;
  if not found then raise exception 'CHAPTER_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtext(v_initial_course_id::text));
  select * into v_course from public.courses c
  where c.id = v_initial_course_id for update;
  if not found or v_course.removed_at is not null then raise exception 'COURSE_NOT_FOUND'; end if;
  select * into v_chapter from public.chapters ch
  where ch.id = p_chapter_id and ch.course_id = v_course.id for update;
  if not found then raise exception 'CHAPTER_NOT_FOUND'; end if;
  if v_chapter.removed_at is null then raise exception 'CHAPTER_NOT_REMOVED'; end if;
  if not public.can_manage_chapter_by_id(v_chapter.id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
  if exists (
    select 1 from public.topics t
    where t.chapter_id = v_chapter.id
      and t.status = 'pending'::public.item_status
      and t.removed_at is null
  ) then raise exception 'TOPIC_PENDING_FROZEN'; end if;
  select * into v_before from public.d2_preview_quota(v_chapter.course_id);

  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  perform set_config('voca.d2_preview_internal_mutation', 'on', true);
  -- A hidden chapter should not revive markers left by pre-D2 state or moderation.
  update public.topics t set is_preview = false
  where t.chapter_id = v_chapter.id and t.course_id = v_chapter.course_id and t.is_preview;

  select coalesce(max(ch.order_index), 0) + 1 into v_next_order
  from public.chapters ch
  where ch.course_id = v_chapter.course_id and ch.removed_at is null;

  update public.chapters ch
  set order_index = v_next_order,
      removed_at = null,
      updated_at = timezone('utc', now())
  where ch.id = v_chapter.id
  returning * into v_chapter;

  v_allocation := public.d2_finish_preview_mutation(
    v_chapter.course_id,
    v_before.active_topic_count,
    v_before.marked_topic_count,
    true
  );
  return jsonb_build_object(
    'status', 'restored',
    'course_id', v_chapter.course_id,
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'course_id', v_chapter.course_id,
      'title', v_chapter.title,
      'order_index', v_chapter.order_index,
      'created_at', v_chapter.created_at,
      'updated_at', v_chapter.updated_at,
      'removed_at', v_chapter.removed_at
    ),
    'preview_allocation', v_allocation
  );
end;
$$;

revoke all on function public.restore_chapter_ordered(uuid) from public, anon;
grant execute on function public.restore_chapter_ordered(uuid) to authenticated, service_role;

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
  v_before record;
  v_allocation jsonb;
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
  select * into v_before from public.d2_preview_quota(p_course_id);
  select coalesce(max(t.order_index), 0) + 1 into v_next_order
  from public.topics t where t.chapter_id = p_chapter_id;

  perform set_config('voca.d1_topic_authorship', 'on', true);
  insert into public.topics (
    course_id, chapter_id, title, status, order_index,
    original_creator_user_id, responsible_author_user_id
  ) values (
    p_course_id, p_chapter_id, v_title, 'draft', v_next_order, v_user_id, v_user_id
  ) returning * into v_topic;
  insert into public.topic_author_review_exclusions (
    topic_id, user_id, exclusion_type, recorded_by_user_id
  ) values (v_topic.id, v_user_id, 'original_creator', v_user_id);

  v_allocation := public.d2_finish_preview_mutation(
    p_course_id,
    v_before.active_topic_count,
    v_before.marked_topic_count,
    true
  );
  return jsonb_build_object(
    'status', 'created',
    'topic', jsonb_build_object(
      'id', v_topic.id,
      'course_id', v_topic.course_id,
      'chapter_id', v_topic.chapter_id,
      'title', v_topic.title,
      'status', v_topic.status,
      'order_index', v_topic.order_index,
      'original_creator_user_id', v_topic.original_creator_user_id,
      'responsible_author_user_id', v_topic.responsible_author_user_id,
      'created_at', v_topic.created_at,
      'updated_at', v_topic.updated_at
    ),
    'preview_allocation', v_allocation
  );
end;
$$;

revoke all on function public.create_topic_ordered(uuid, uuid, text) from public, anon;
grant execute on function public.create_topic_ordered(uuid, uuid, text) to authenticated, service_role;

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
  v_active_pending_ids uuid[];
  v_cancelled integer := 0;
  v_audit_id uuid;
  v_before record;
  v_after record;
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
    select t.course_id, t.status, t.removed_at
    into v_course_id, v_previous_status, v_previous_removed_at
    from public.topics t where t.id = p_target_id;
    if v_course_id is null then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    perform pg_advisory_xact_lock(hashtext(p_target_id::text));
    select t.status, t.removed_at
    into v_previous_status, v_previous_removed_at
    from public.topics t where t.id = p_target_id for update;
    if p_action = 'invalidate_review' and v_previous_status <> 'pending' then
      raise exception 'MODERATION_TARGET_STATE_INVALID';
    elsif p_action = 'demote' and v_previous_status not in ('published', 'pending') then
      raise exception 'MODERATION_TARGET_STATE_INVALID';
    elsif p_action = 'takedown' and v_previous_removed_at is not null then
      raise exception 'MODERATION_TARGET_ALREADY_REMOVED';
    end if;
    select * into v_before from public.d2_preview_quota(v_course_id);
    if v_previous_status = 'pending' then
      v_cancelled := public.d1_cancel_pending_reviews_for_topics(array[p_target_id], v_actor, v_reason);
    end if;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    perform set_config('voca.d2_preview_internal_mutation', 'on', true);
    update public.topics t
    set status = 'draft',
        removed_at = case when p_action = 'takedown' then timezone('utc', now()) else null end,
        is_preview = case when p_action = 'takedown' then false else t.is_preview end
    where t.id = p_target_id;
  elsif p_target_type = 'chapter' then
    select ch.course_id, ch.removed_at
    into v_course_id, v_previous_removed_at
    from public.chapters ch where ch.id = p_target_id;
    if v_course_id is null then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    select ch.removed_at into v_previous_removed_at
    from public.chapters ch where ch.id = p_target_id for update;
    if p_action <> 'takedown' or v_previous_removed_at is not null then
      raise exception 'MODERATION_ACTION_NOT_SUPPORTED';
    end if;
    select * into v_before from public.d2_preview_quota(v_course_id);
    select array_agg(t.id order by t.id),
           array_agg(t.id order by t.id) filter (where t.removed_at is null and t.status = 'pending')
    into v_topic_ids, v_active_pending_ids
    from public.topics t where t.chapter_id = p_target_id and t.course_id = v_course_id;
    if v_topic_ids is not null then perform public.d1_lock_topics_for_moderation(v_topic_ids); end if;
    if v_active_pending_ids is not null then
      v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_active_pending_ids, v_actor, v_reason);
    end if;
    perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
    perform set_config('voca.d2_preview_internal_mutation', 'on', true);
    update public.topics t set is_preview = false
    where t.course_id = v_course_id and t.chapter_id = p_target_id and t.is_preview;
    update public.chapters ch set removed_at = timezone('utc', now()) where ch.id = p_target_id;
    v_previous_status := null;
  else
    select c.status, c.removed_at
    into v_previous_status, v_previous_removed_at
    from public.courses c where c.id = p_target_id;
    if not found then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    v_course_id := p_target_id;
    perform pg_advisory_xact_lock(hashtext(v_course_id::text));
    select c.status, c.removed_at
    into v_previous_status, v_previous_removed_at
    from public.courses c where c.id = p_target_id for update;
    if not found then raise exception 'MODERATION_TARGET_NOT_FOUND'; end if;
    select * into v_before from public.d2_preview_quota(v_course_id);
    if p_action = 'demote' then
      if v_previous_status <> 'published' then raise exception 'MODERATION_TARGET_STATE_INVALID'; end if;
      select array_agg(t.id order by t.id) into v_active_pending_ids
      from public.topics t
      where t.course_id = p_target_id and t.status = 'pending' and t.removed_at is null;
      if v_active_pending_ids is not null then
        perform public.d1_lock_topics_for_moderation(v_active_pending_ids);
        v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_active_pending_ids, v_actor, v_reason);
      end if;
      update public.courses c set status = 'draft' where c.id = p_target_id;
    elsif p_action = 'takedown' then
      if v_previous_removed_at is not null then raise exception 'MODERATION_TARGET_ALREADY_REMOVED'; end if;
      select array_agg(t.id order by t.id),
             array_agg(t.id order by t.id) filter (where t.status = 'pending' and t.removed_at is null)
      into v_topic_ids, v_active_pending_ids
      from public.topics t where t.course_id = p_target_id;
      if v_topic_ids is not null then perform public.d1_lock_topics_for_moderation(v_topic_ids); end if;
      if v_active_pending_ids is not null then
        v_cancelled := public.d1_cancel_pending_reviews_for_topics(v_active_pending_ids, v_actor, v_reason);
      end if;
      perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
      perform set_config('voca.d2_preview_internal_mutation', 'on', true);
      update public.topics t set is_preview = false
      where t.course_id = p_target_id and t.is_preview;
      update public.courses c
      set status = 'draft', removed_at = timezone('utc', now())
      where c.id = p_target_id;
    else
      raise exception 'MODERATION_ACTION_NOT_SUPPORTED';
    end if;
  end if;

  insert into public.platform_moderation_audits (
    actor_user_id, target_type, target_id, action, reason, previous_status, previous_removed_at
  ) values (
    v_actor, p_target_type, p_target_id, p_action, v_reason, v_previous_status, v_previous_removed_at
  ) returning id into v_audit_id;

  select * into v_after from public.d2_preview_quota(v_course_id);
  if v_after.marked_topic_count <= v_after.quota_cap then
    delete from public.course_preview_moderation_causes p where p.course_id = v_course_id;
  elsif v_before.marked_topic_count <= v_before.quota_cap then
    insert into public.course_preview_moderation_causes(course_id, audit_id, created_at)
    values (v_course_id, v_audit_id, timezone('utc', now()))
    on conflict (course_id) do update
      set audit_id = excluded.audit_id,
          created_at = excluded.created_at;
  end if;

  return jsonb_build_object(
    'status', case when p_action = 'takedown' then 'removed' else 'draft' end,
    'course_id', v_course_id,
    'target_type', p_target_type,
    'target_id', p_target_id,
    'audit_id', v_audit_id,
    'cancelled_reviews', v_cancelled
  );
end;
$$;

revoke all on function public.moderate_platform_content(text, uuid, text, text) from public, anon;
grant execute on function public.moderate_platform_content(text, uuid, text, text) to authenticated, service_role;
