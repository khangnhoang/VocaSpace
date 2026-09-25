alter table public.chapters
  add column if not exists created_by_user_id uuid;

do $$
begin
  if exists (
    select 1
    from public.chapters ch
    where ch.created_by_user_id is null
      and not exists (
        select 1
        from public.courses c
        join public.course_collaborators cc on cc.course_id = c.id
        join public.profiles p on p.id = cc.user_id
        where c.id = ch.course_id
          and c.removed_at is null
          and p.removed_at is null
          and cc.role in (
            'owner'::public.course_member_role,
            'co_owner'::public.course_member_role,
            'editor'::public.course_member_role
          )
      )
  ) then
    raise exception 'D2_CHAPTER_CREATOR_BACKFILL_NO_CANDIDATE';
  end if;
end;
$$;

update public.chapters ch
set created_by_user_id = (
  select cc.user_id
  from public.courses c
  join public.course_collaborators cc on cc.course_id = c.id
  join public.profiles p on p.id = cc.user_id
  where c.id = ch.course_id
    and c.removed_at is null
    and p.removed_at is null
    and cc.role in (
      'owner'::public.course_member_role,
      'co_owner'::public.course_member_role,
      'editor'::public.course_member_role
    )
  order by
    case cc.role
      when 'owner'::public.course_member_role then 1
      when 'co_owner'::public.course_member_role then 2
      else 3
    end,
    cc.user_id
  limit 1
)
where ch.created_by_user_id is null;

alter table public.chapters
  alter column created_by_user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.chapters'::regclass
      and conname = 'chapters_created_by_user_id_fkey'
  ) then
    alter table public.chapters
      add constraint chapters_created_by_user_id_fkey
      foreign key (created_by_user_id)
      references public.profiles(id);
  end if;
end;
$$;

create or replace function public.can_manage_chapter_by_id(target_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chapters ch
    join public.courses c on c.id = ch.course_id
    join public.course_collaborators cc on cc.course_id = c.id
    join public.profiles p on p.id = cc.user_id
    where ch.id = target_chapter_id
      and c.removed_at is null
      and p.removed_at is null
      and cc.user_id = auth.uid()
      and (
        cc.role in (
          'owner'::public.course_member_role,
          'co_owner'::public.course_member_role
        )
        or (
          cc.role = 'editor'::public.course_member_role
          and ch.created_by_user_id = auth.uid()
        )
      )
  )
$$;

revoke all on function public.can_manage_chapter_by_id(uuid) from public;
grant execute on function public.can_manage_chapter_by_id(uuid) to authenticated, service_role;

create or replace function public.can_reorder_course_chapters(target_course_id uuid)
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
      and cc.role in (
        'owner'::public.course_member_role,
        'co_owner'::public.course_member_role
      )
  )
$$;

revoke all on function public.can_reorder_course_chapters(uuid) from public;
grant execute on function public.can_reorder_course_chapters(uuid) to authenticated, service_role;

create or replace function public.can_modify_chapter_by_id(target_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_chapter_by_id(target_chapter_id)
    and not exists (
      select 1
      from public.topics t
      where t.chapter_id = target_chapter_id
        and t.status = 'pending'::public.item_status
        and t.removed_at is null
    )
$$;

revoke all on function public.can_modify_chapter_by_id(uuid) from public;
grant execute on function public.can_modify_chapter_by_id(uuid) to authenticated, service_role;

create or replace function public.d2_guard_chapter_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      raise exception 'CHAPTER_USE_TRUSTED_CREATE_RPC';
    end if;

    if new.course_id is distinct from old.course_id
      or new.created_by_user_id is distinct from old.created_by_user_id
      or new.order_index is distinct from old.order_index
      or new.removed_at is distinct from old.removed_at
      or new.created_at is distinct from old.created_at then
      raise exception 'CHAPTER_PROTECTED_FIELD';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.d2_guard_chapter_identity() from public;

drop trigger if exists d2_guard_chapter_identity on public.chapters;
create trigger d2_guard_chapter_identity
before insert or update on public.chapters
for each row execute function public.d2_guard_chapter_identity();

drop policy if exists "Chapters - Staff Select Deleted" on public.chapters;
create policy "Chapters - Staff Select Deleted" on public.chapters
for select to authenticated
using (
  removed_at is not null
  and public.has_course_authoring_access(course_id)
  and (
    public.can_reorder_course_chapters(course_id)
    or created_by_user_id = auth.uid()
  )
);

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

revoke insert, update, delete on table public.chapters from anon, authenticated;
revoke update (title) on table public.chapters from anon, authenticated;
grant update (title) on table public.chapters to authenticated;

create or replace function public.create_chapter_ordered(
  p_course_id uuid,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_course record;
  v_next_order integer;
  v_chapter public.chapters%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');

  if v_title is null then
    raise exception 'CHAPTER_TITLE_REQUIRED';
  end if;

  if length(v_title) < 3 then
    raise exception 'CHAPTER_TITLE_TOO_SHORT';
  end if;

  if length(v_title) > 100 then
    raise exception 'CHAPTER_TITLE_TOO_LONG';
  end if;

  select c.id, c.removed_at
  into v_course
  from public.courses c
  where c.id = p_course_id
  for update;

  if not found or v_course.removed_at is not null then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  if not public.has_course_management_access(p_course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  select coalesce(max(c.order_index), 0) + 1
  into v_next_order
  from public.chapters c
  where c.course_id = p_course_id;

  insert into public.chapters (course_id, title, order_index, created_by_user_id)
  values (p_course_id, v_title, v_next_order, auth.uid())
  returning * into v_chapter;

  return jsonb_build_object(
    'status', 'created',
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'course_id', v_chapter.course_id,
      'title', v_chapter.title,
      'order_index', v_chapter.order_index,
      'created_at', v_chapter.created_at,
      'updated_at', v_chapter.updated_at,
      'removed_at', v_chapter.removed_at
    )
  );
end;
$$;

create or replace function public.move_chapter_order(
  p_chapter_id uuid,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_course_id uuid;
  v_course record;
  v_target public.chapters%rowtype;
  v_neighbor public.chapters%rowtype;
  v_temp_order integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'INVALID_DIRECTION';
  end if;

  select ch.course_id
  into v_initial_course_id
  from public.chapters ch
  where ch.id = p_chapter_id;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  select c.id, c.removed_at
  into v_course
  from public.courses c
  where c.id = v_initial_course_id
  for update;

  if not found or v_course.removed_at is not null then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select ch.*
  into v_target
  from public.chapters ch
  where ch.id = p_chapter_id
    and ch.course_id = v_course.id
  for update;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  if v_target.removed_at is not null then
    raise exception 'CHAPTER_REMOVED';
  end if;

  if not public.can_reorder_course_chapters(v_target.course_id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  if p_direction = 'up' then
    select ch.*
    into v_neighbor
    from public.chapters ch
    where ch.course_id = v_target.course_id
      and ch.removed_at is null
      and ch.order_index < v_target.order_index
    order by ch.order_index desc, ch.created_at desc, ch.id desc
    limit 1
    for update;
  else
    select ch.*
    into v_neighbor
    from public.chapters ch
    where ch.course_id = v_target.course_id
      and ch.removed_at is null
      and ch.order_index > v_target.order_index
    order by ch.order_index asc, ch.created_at asc, ch.id asc
    limit 1
    for update;
  end if;

  if not found then
    return jsonb_build_object(
      'status', 'noop',
      'reason', case when p_direction = 'up' then 'already_first' else 'already_last' end,
      'course_id', v_target.course_id,
      'chapter_id', v_target.id,
      'order_index', v_target.order_index
    );
  end if;

  select coalesce(max(ch.order_index), 0) + 1
  into v_temp_order
  from public.chapters ch
  where ch.course_id = v_target.course_id;

  update public.chapters
  set order_index = v_temp_order,
      updated_at = timezone('utc', now())
  where id = v_target.id;

  update public.chapters
  set order_index = v_target.order_index,
      updated_at = timezone('utc', now())
  where id = v_neighbor.id;

  update public.chapters
  set order_index = v_neighbor.order_index,
      updated_at = timezone('utc', now())
  where id = v_target.id;

  return jsonb_build_object(
    'status', 'moved',
    'course_id', v_target.course_id,
    'chapter_id', v_target.id,
    'neighbor_chapter_id', v_neighbor.id,
    'direction', p_direction,
    'previous_order_index', v_target.order_index,
    'new_order_index', v_neighbor.order_index
  );
end;
$$;

create or replace function public.hide_chapter(p_chapter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_course_id uuid;
  v_course record;
  v_chapter public.chapters%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select ch.course_id
  into v_initial_course_id
  from public.chapters ch
  where ch.id = p_chapter_id;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  select c.id, c.removed_at
  into v_course
  from public.courses c
  where c.id = v_initial_course_id
  for update;

  if not found or v_course.removed_at is not null then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select ch.*
  into v_chapter
  from public.chapters ch
  where ch.id = p_chapter_id
    and ch.course_id = v_course.id
  for update;

  if not found or v_chapter.removed_at is not null then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  if not public.can_manage_chapter_by_id(v_chapter.id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;

  if exists (
    select 1
    from public.topics t
    where t.chapter_id = v_chapter.id
      and t.status = 'pending'::public.item_status
      and t.removed_at is null
  ) then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;

  update public.chapters
  set removed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = v_chapter.id;

  return jsonb_build_object(
    'status', 'hidden',
    'course_id', v_chapter.course_id,
    'chapter_id', v_chapter.id
  );
end;
$$;

create or replace function public.restore_chapter_ordered(p_chapter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_course_id uuid;
  v_course record;
  v_chapter public.chapters%rowtype;
  v_next_order integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select ch.course_id
  into v_initial_course_id
  from public.chapters ch
  where ch.id = p_chapter_id;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;

  select c.id, c.removed_at
  into v_course
  from public.courses c
  where c.id = v_initial_course_id
  for update;

  if not found or v_course.removed_at is not null then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select ch.*
  into v_chapter
  from public.chapters ch
  where ch.id = p_chapter_id
    and ch.course_id = v_course.id
  for update;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND';
  end if;
  if v_chapter.removed_at is null then
    raise exception 'CHAPTER_NOT_REMOVED';
  end if;
  if not public.can_manage_chapter_by_id(v_chapter.id) then
    raise exception 'COURSE_EDIT_FORBIDDEN';
  end if;
  if exists (
    select 1
    from public.topics t
    where t.chapter_id = v_chapter.id
      and t.status = 'pending'::public.item_status
      and t.removed_at is null
  ) then
    raise exception 'TOPIC_PENDING_FROZEN';
  end if;

  select coalesce(max(ch.order_index), 0) + 1
  into v_next_order
  from public.chapters ch
  where ch.course_id = v_chapter.course_id
    and ch.removed_at is null;

  update public.chapters
  set order_index = v_next_order,
      removed_at = null,
      updated_at = timezone('utc', now())
  where id = v_chapter.id
  returning * into v_chapter;

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
    )
  );
end;
$$;

revoke all on function public.create_chapter_ordered(uuid, text) from public;
grant execute on function public.create_chapter_ordered(uuid, text) to authenticated, service_role;
revoke all on function public.move_chapter_order(uuid, text) from public;
grant execute on function public.move_chapter_order(uuid, text) to authenticated, service_role;
revoke all on function public.hide_chapter(uuid) from public;
grant execute on function public.hide_chapter(uuid) to authenticated, service_role;
revoke all on function public.restore_chapter_ordered(uuid) from public;
grant execute on function public.restore_chapter_ordered(uuid) to authenticated, service_role;
