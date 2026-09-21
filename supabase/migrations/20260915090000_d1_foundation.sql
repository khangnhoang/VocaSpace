do $$
begin
  create type public.topic_review_submission_status as enum (
    'pending',
    'approved',
    'rejected',
    'cancelled'
  );
exception
  when duplicate_object then null;
end;
$$;

alter table public.course_collaborators
  add column if not exists can_review_topics boolean;

update public.course_collaborators
set can_review_topics = false
where can_review_topics is null;

alter table public.course_collaborators
  alter column can_review_topics set default false,
  alter column can_review_topics set not null;

do $$
declare
  v_invalid_count bigint;
  v_invalid_topics text;
begin
  select
    count(*),
    string_agg(
      format('%s(card=%s,exercise=%s)', t.id, card_counts.active_cards, exercise_counts.active_exercises),
      ', '
      order by t.id
    )
  into v_invalid_count, v_invalid_topics
  from public.topics t
  left join lateral (
    select count(*) as active_cards
    from public.cards c
    where c.topic_id = t.id
      and c.removed_at is null
  ) card_counts on true
  left join lateral (
    select count(*) as active_exercises
    from public.exercises e
    where e.topic_id = t.id
      and e.removed_at is null
  ) exercise_counts on true
  where t.status = 'published'::public.item_status
    and t.removed_at is null
    and (card_counts.active_cards = 0 or exercise_counts.active_exercises = 0);

  if v_invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'D1_INVALID_PUBLISHED_TOPIC_READINESS',
      detail = format(
        'Found %s active published topic(s) without at least one active card and one active exercise: %s',
        v_invalid_count,
        v_invalid_topics
      ),
      hint = 'Remediate each listed topic to draft before enabling the D1 database invariant.';
  end if;
end;
$$;

create table if not exists public.topic_review_submissions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  submitted_by_user_id uuid not null references public.profiles(id) on delete cascade,
  status public.topic_review_submission_status not null default 'pending',
  attempt_number integer not null default 1,
  submitted_at timestamptz not null default timezone('utc'::text, now()),
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  cancelled_by_user_id uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint topic_review_submissions_attempt_number_check check (attempt_number > 0),
  constraint topic_review_submissions_rejection_reason_check check (
    status <> 'rejected'::public.topic_review_submission_status
    or nullif(btrim(rejection_reason), '') is not null
  ),
  constraint topic_review_submissions_cancellation_reason_check check (
    status <> 'cancelled'::public.topic_review_submission_status
    or nullif(btrim(cancellation_reason), '') is not null
  )
);

create unique index if not exists topic_review_submissions_one_pending_idx
  on public.topic_review_submissions (topic_id)
  where status = 'pending'::public.topic_review_submission_status;

create unique index if not exists topic_review_submissions_attempt_idx
  on public.topic_review_submissions (topic_id, submitted_by_user_id, attempt_number);

create index if not exists topic_review_submissions_topic_status_idx
  on public.topic_review_submissions (topic_id, status);

drop trigger if exists set_updated_at_topic_review_submissions
  on public.topic_review_submissions;

create trigger set_updated_at_topic_review_submissions
before update on public.topic_review_submissions
for each row
execute function public.handle_updated_at();

alter table public.topic_review_submissions enable row level security;

revoke all on table public.topic_review_submissions from public;
revoke all on table public.topic_review_submissions from anon, authenticated;
grant all on table public.topic_review_submissions to service_role;

create or replace function public.clear_topic_review_capability_on_role_downgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
     and new.role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) then
    new.can_review_topics := false;
  end if;

  return new;
end;
$$;

revoke all on function public.clear_topic_review_capability_on_role_downgrade() from public;

drop trigger if exists clear_topic_review_capability_on_role_downgrade
  on public.course_collaborators;

create trigger clear_topic_review_capability_on_role_downgrade
before update of role, can_review_topics on public.course_collaborators
for each row
execute function public.clear_topic_review_capability_on_role_downgrade();

create or replace function public.has_course_authoring_access(target_course_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  return exists (
    select 1
    from public.courses c
    join public.course_collaborators cc on cc.course_id = c.id
    where c.id = target_course_id
      and c.removed_at is null
      and cc.user_id = auth.uid()
      and cc.role in (
        'owner'::public.course_member_role,
        'co_owner'::public.course_member_role,
        'editor'::public.course_member_role
      )
  );
end;
$$;

revoke all on function public.has_course_authoring_access(uuid) from public;
grant execute on function public.has_course_authoring_access(uuid) to authenticated;
grant execute on function public.has_course_authoring_access(uuid) to service_role;

create or replace function public.create_course_with_owner(
  p_title text,
  p_slug text,
  p_description text,
  p_price numeric,
  p_thumbnail_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.get_my_role() <> 'teacher'::public.user_role then
    raise exception 'COURSE_CREATE_FORBIDDEN';
  end if;

  insert into public.courses (
    title,
    slug,
    description,
    price,
    thumbnail_url,
    status
  )
  values (
    nullif(btrim(coalesce(p_title, '')), ''),
    nullif(btrim(coalesce(p_slug, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(p_price, 0),
    nullif(btrim(coalesce(p_thumbnail_url, '')), ''),
    'draft'
  )
  returning id into v_course_id;

  insert into public.course_collaborators (
    course_id,
    user_id,
    role,
    added_by
  )
  values (
    v_course_id,
    v_user_id,
    'owner',
    v_user_id
  );

  return v_course_id;
end;
$$;

revoke all on function public.create_course_with_owner(text, text, text, numeric, text) from public;
grant execute on function public.create_course_with_owner(text, text, text, numeric, text) to authenticated;
grant execute on function public.create_course_with_owner(text, text, text, numeric, text) to service_role;

drop policy if exists "Insert courses v3" on public.courses;

drop function if exists public.create_topic_ordered(uuid, uuid, text, public.item_status);

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
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');

  if v_title is null then
    raise exception 'TOPIC_TITLE_REQUIRED';
  end if;

  if length(v_title) < 4 then
    raise exception 'TOPIC_TITLE_TOO_SHORT';
  end if;

  if length(v_title) > 120 then
    raise exception 'TOPIC_TITLE_TOO_LONG';
  end if;

  select c.*
  into v_chapter
  from public.chapters c
  where c.id = p_chapter_id
  for update;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  if v_chapter.removed_at is not null then
    raise exception 'CHAPTER_REMOVED';
  end if;

  if v_chapter.course_id <> p_course_id then
    raise exception 'TOPIC_COURSE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and c.removed_at is null
  ) then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  if not public.has_course_authoring_access(p_course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  select coalesce(max(t.order_index), 0) + 1
  into v_next_order
  from public.topics t
  where t.chapter_id = p_chapter_id;

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

revoke all on function public.create_topic_ordered(uuid, uuid, text) from public;
grant execute on function public.create_topic_ordered(uuid, uuid, text) to authenticated;
grant execute on function public.create_topic_ordered(uuid, uuid, text) to service_role;
