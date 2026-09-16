-- D1 P0-A: immutable topic authorship provenance and authoring-group foundation.

alter table public.topics
  add column original_creator_user_id uuid references public.profiles(id),
  add column responsible_author_user_id uuid references public.profiles(id),
  add column first_approved_at timestamptz;

do $$
declare
  v_invalid_ids text;
begin
  select string_agg(t.id::text, ', ' order by t.id)
  into v_invalid_ids
  from public.topics t
  where t.original_creator_user_id is null
     or t.responsible_author_user_id is null
     or (t.status = 'published'::public.item_status and t.first_approved_at is null);

  if v_invalid_ids is not null then
    raise exception 'D1_TOPIC_AUTHORSHIP_PRECHECK_FAILED: topic ids=%', v_invalid_ids;
  end if;
end;
$$;

alter table public.topics
  alter column original_creator_user_id set not null,
  alter column responsible_author_user_id set not null;

alter table public.topics
  add constraint topics_published_requires_first_approval
  check (
    status <> 'published'::public.item_status
    or first_approved_at is not null
  ) not valid;

alter table public.topics
  validate constraint topics_published_requires_first_approval;

create table public.topic_contributors (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  added_by_user_id uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  removed_at timestamptz,
  removed_by_user_id uuid references public.profiles(id)
);

create unique index topic_contributors_active_user_idx
  on public.topic_contributors (topic_id, user_id)
  where removed_at is null;

create index topic_contributors_active_topic_idx
  on public.topic_contributors (topic_id)
  where removed_at is null;

create table public.topic_author_review_exclusions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  exclusion_type text not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  recorded_by_user_id uuid references public.profiles(id),
  constraint topic_author_review_exclusions_type_check
    check (exclusion_type in ('original_creator', 'initial_contributor', 'preapproval_responsible')),
  constraint topic_author_review_exclusions_unique
    unique (topic_id, user_id, exclusion_type)
);

create index topic_author_review_exclusions_topic_idx
  on public.topic_author_review_exclusions (topic_id, recorded_at);

create or replace function public.d1_guard_topic_authorship_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_authorship_trusted boolean := coalesce(current_setting('voca.d1_topic_authorship', true), '') = 'on';
  v_lifecycle_trusted boolean := coalesce(current_setting('voca.d1_trusted_topic_lifecycle', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.original_creator_user_id is null or new.responsible_author_user_id is null then
      raise exception 'TOPIC_AUTHORSHIP_PROVENANCE_REQUIRED';
    end if;

    if auth.uid() is not null
       and (
         not v_authorship_trusted
         or new.original_creator_user_id <> auth.uid()
         or new.responsible_author_user_id <> auth.uid()
       ) then
      raise exception 'TOPIC_AUTHORSHIP_CREATE_TRUSTED_ONLY' using errcode = '42501';
    end if;

    return new;
  end if;

  if new.original_creator_user_id is distinct from old.original_creator_user_id then
    raise exception 'TOPIC_ORIGINAL_CREATOR_IMMUTABLE' using errcode = '42501';
  end if;

  if old.first_approved_at is not null
     and new.first_approved_at is distinct from old.first_approved_at then
    raise exception 'TOPIC_FIRST_APPROVAL_IMMUTABLE' using errcode = '42501';
  end if;

  if new.status = 'published'::public.item_status
     and old.status is distinct from 'published'::public.item_status
     and new.first_approved_at is null
     and v_lifecycle_trusted then
    new.first_approved_at := timezone('utc', now());
  end if;

  if auth.uid() is not null
     and new.responsible_author_user_id is distinct from old.responsible_author_user_id
     and not v_authorship_trusted then
    raise exception 'TOPIC_AUTHORSHIP_FIELDS_TRUSTED_ONLY' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.d1_guard_topic_authorship_mutation() from public, anon, authenticated;

drop trigger if exists d1_guard_topic_authorship_mutation on public.topics;
create trigger d1_guard_topic_authorship_mutation
before insert or update on public.topics
for each row execute function public.d1_guard_topic_authorship_mutation();

create or replace function public.d1_guard_topic_contributor_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_responsible_author_id uuid;
  v_active_count integer;
begin
  if tg_op = 'UPDATE'
     and (
       new.topic_id is distinct from old.topic_id
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at
     ) then
    raise exception 'TOPIC_CONTRIBUTOR_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;

  if new.removed_at is null then
    perform pg_advisory_xact_lock(hashtext(new.topic_id::text));

    select t.responsible_author_user_id
    into v_responsible_author_id
    from public.topics t
    where t.id = new.topic_id
    for update;

    if not found then
      raise exception 'TOPIC_NOT_FOUND';
    end if;

    if new.user_id = v_responsible_author_id then
      raise exception 'TOPIC_RESPONSIBLE_AUTHOR_NOT_CONTRIBUTOR';
    end if;

    select count(*)
    into v_active_count
    from public.topic_contributors c
    where c.topic_id = new.topic_id
      and c.removed_at is null
      and (tg_op <> 'UPDATE' or c.id <> new.id);

    if v_active_count >= 2 then
      raise exception 'TOPIC_CONTRIBUTOR_CAP_REACHED';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.d1_guard_topic_contributor_mutation() from public, anon, authenticated;

drop trigger if exists d1_guard_topic_contributor_mutation on public.topic_contributors;
create trigger d1_guard_topic_contributor_mutation
before insert or update on public.topic_contributors
for each row execute function public.d1_guard_topic_contributor_mutation();

alter table public.topic_contributors enable row level security;
alter table public.topic_author_review_exclusions enable row level security;

revoke all on table public.topic_contributors from public, anon, authenticated;
revoke all on table public.topic_author_review_exclusions from public, anon, authenticated;
grant all on table public.topic_contributors to service_role;
grant all on table public.topic_author_review_exclusions to service_role;

revoke update on table public.topics from authenticated;
grant update (
  title,
  description,
  slug,
  order_index,
  removed_at
) on table public.topics to authenticated;

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

  perform set_config('voca.d1_topic_authorship', 'on', true);
  insert into public.topics (
    course_id,
    chapter_id,
    title,
    status,
    order_index,
    original_creator_user_id,
    responsible_author_user_id
  ) values (
    p_course_id,
    p_chapter_id,
    v_title,
    'draft',
    v_next_order,
    v_user_id,
    v_user_id
  ) returning * into v_topic;

  insert into public.topic_author_review_exclusions (
    topic_id,
    user_id,
    exclusion_type,
    recorded_by_user_id
  ) values (
    v_topic.id,
    v_user_id,
    'original_creator',
    v_user_id
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
    )
  );
end;
$$;

revoke all on function public.create_topic_ordered(uuid, uuid, text) from public, anon;
grant execute on function public.create_topic_ordered(uuid, uuid, text) to authenticated, service_role;
