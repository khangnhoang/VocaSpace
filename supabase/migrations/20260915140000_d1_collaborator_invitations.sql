create table if not exists public.course_collaborator_invitations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  invited_by_user_id uuid not null references public.profiles(id) on delete cascade,
  invitee_user_id uuid not null references public.profiles(id) on delete cascade,
  role public.course_member_role not null,
  can_review_topics boolean not null default false,
  status text not null default 'pending',
  actioned_by_user_id uuid references public.profiles(id) on delete set null,
  actioned_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint course_collaborator_invitations_role_check check (role <> 'owner'::public.course_member_role),
  constraint course_collaborator_invitations_capability_check check (
    role <> 'co_owner'::public.course_member_role or not can_review_topics
  ),
  constraint course_collaborator_invitations_status_check check (status in ('pending', 'accepted', 'rejected', 'revoked')),
  constraint course_collaborator_invitations_action_state_check check (
    (status = 'pending' and actioned_by_user_id is null and actioned_at is null)
    or (status <> 'pending' and actioned_at is not null)
  )
);

create unique index if not exists course_collaborator_invitations_one_pending_idx
  on public.course_collaborator_invitations (course_id, invitee_user_id)
  where status = 'pending';

create index if not exists course_collaborator_invitations_invitee_status_idx
  on public.course_collaborator_invitations (invitee_user_id, status, created_at desc);

create index if not exists course_collaborator_invitations_course_status_idx
  on public.course_collaborator_invitations (course_id, status, created_at desc);

drop trigger if exists set_updated_at_course_collaborator_invitations
  on public.course_collaborator_invitations;

create trigger set_updated_at_course_collaborator_invitations
before update on public.course_collaborator_invitations
for each row
execute function public.handle_updated_at();

alter table public.course_collaborator_invitations enable row level security;
revoke all on table public.course_collaborator_invitations from public, anon, authenticated;
grant select on table public.course_collaborator_invitations to authenticated;
grant all on table public.course_collaborator_invitations to service_role;

drop policy if exists "Invitations - Invitee or Manager Select" on public.course_collaborator_invitations;
create policy "Invitations - Invitee or Manager Select"
on public.course_collaborator_invitations
for select to authenticated
using (
  invitee_user_id = auth.uid()
  or public.is_course_owner_or_co_owner(course_id)
);

create or replace function public.d1_course_collaborator_role_cap(
  p_role public.course_member_role
)
returns integer
language sql
immutable
security invoker
as $$
  select case p_role
    when 'co_owner'::public.course_member_role then 2
    when 'editor'::public.course_member_role then 5
    when 'previewer'::public.course_member_role then 10
    else 0
  end;
$$;

revoke all on function public.d1_course_collaborator_role_cap(public.course_member_role) from public, anon, authenticated;
grant execute on function public.d1_course_collaborator_role_cap(public.course_member_role) to service_role;

create or replace function public.send_course_collaborator_invitation(
  p_course_id uuid,
  p_email text,
  p_role public.course_member_role,
  p_can_review_topics boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.course_member_role;
  v_invitee_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_invitation public.course_collaborator_invitations%rowtype;
  v_cap integer;
  v_active_count integer;
  v_pending_count integer;
begin
  if v_actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_role = 'owner'::public.course_member_role then raise exception 'INVITATION_OWNER_ROLE_FORBIDDEN'; end if;
  if v_email = '' then raise exception 'INVITATION_EMAIL_REQUIRED'; end if;
  if p_role = 'co_owner'::public.course_member_role and p_can_review_topics then
    raise exception 'INVITATION_CAPABILITY_ROLE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_course_id::text));
  select cc.role into v_actor_role
  from public.course_collaborators cc
  where cc.course_id = p_course_id and cc.user_id = v_actor_id;
  if not found then raise exception 'INVITATION_MANAGEMENT_FORBIDDEN'; end if;
  if v_actor_role not in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role) then
    raise exception 'INVITATION_MANAGEMENT_FORBIDDEN';
  end if;
  if v_actor_role = 'co_owner'::public.course_member_role
     and p_role = 'co_owner'::public.course_member_role then
    raise exception 'INVITATION_ROLE_FORBIDDEN';
  end if;
  if not exists (select 1 from public.courses c where c.id = p_course_id and c.removed_at is null) then
    raise exception 'COURSE_NOT_FOUND';
  end if;

  select p.id into v_invitee_id
  from public.profiles p
  where p.removed_at is null and lower(coalesce(p.email, '')) = v_email
  order by p.created_at, p.id
  limit 1;
  if v_invitee_id is null then raise exception 'INVITATION_TARGET_NOT_FOUND'; end if;
  if v_invitee_id = v_actor_id then raise exception 'INVITATION_SELF_FORBIDDEN'; end if;
  if exists (
    select 1 from public.course_collaborators cc
    where cc.course_id = p_course_id and cc.user_id = v_invitee_id
  ) then
    raise exception 'INVITATION_ALREADY_MEMBER';
  end if;
  if exists (
    select 1 from public.course_collaborator_invitations i
    where i.course_id = p_course_id and i.invitee_user_id = v_invitee_id and i.status = 'pending'
  ) then
    raise exception 'INVITATION_ALREADY_PENDING';
  end if;

  v_cap := public.d1_course_collaborator_role_cap(p_role);
  select count(*) into v_active_count
  from public.course_collaborators cc
  where cc.course_id = p_course_id and cc.role = p_role;
  select count(*) into v_pending_count
  from public.course_collaborator_invitations i
  where i.course_id = p_course_id and i.role = p_role and i.status = 'pending';
  if v_active_count + v_pending_count >= v_cap then
    raise exception 'INVITATION_CAPACITY_REACHED';
  end if;

  insert into public.course_collaborator_invitations (
    course_id, invited_by_user_id, invitee_user_id, role, can_review_topics
  ) values (
    p_course_id, v_actor_id, v_invitee_id, p_role,
    case when p_role in ('editor'::public.course_member_role, 'previewer'::public.course_member_role)
      then p_can_review_topics else false end
  ) returning * into v_invitation;

  return jsonb_build_object(
    'status', v_invitation.status,
    'invitation_id', v_invitation.id,
    'course_id', v_invitation.course_id,
    'invitee_user_id', v_invitation.invitee_user_id,
    'role', v_invitation.role,
    'can_review_topics', v_invitation.can_review_topics
  );
end;
$$;

create or replace function public.accept_course_collaborator_invitation(
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation public.course_collaborator_invitations%rowtype;
  v_course_id uuid;
  v_cap integer;
  v_active_count integer;
  v_pending_count integer;
  v_collaborator_id uuid;
begin
  if v_actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select course_id into v_course_id
  from public.course_collaborator_invitations
  where id = p_invitation_id;
  if v_course_id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));

  select * into v_invitation
  from public.course_collaborator_invitations i
  where i.id = p_invitation_id
  for update;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  if v_invitation.invitee_user_id <> v_actor_id then raise exception 'INVITATION_FORBIDDEN'; end if;
  if v_invitation.status <> 'pending' then raise exception 'INVITATION_STALE'; end if;
  if not exists (select 1 from public.courses c where c.id = v_invitation.course_id and c.removed_at is null) then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.course_collaborators cc
    where cc.course_id = v_invitation.course_id and cc.user_id = v_actor_id
  ) then
    raise exception 'INVITATION_ALREADY_MEMBER';
  end if;

  v_cap := public.d1_course_collaborator_role_cap(v_invitation.role);
  select count(*) into v_active_count
  from public.course_collaborators cc
  where cc.course_id = v_invitation.course_id and cc.role = v_invitation.role;
  select count(*) into v_pending_count
  from public.course_collaborator_invitations i
  where i.course_id = v_invitation.course_id and i.role = v_invitation.role and i.status = 'pending';
  if v_active_count + v_pending_count > v_cap then
    raise exception 'INVITATION_CAPACITY_INVARIANT_BROKEN';
  end if;

  insert into public.course_collaborators (
    course_id, user_id, role, can_review_topics, added_by
  ) values (
    v_invitation.course_id,
    v_actor_id,
    v_invitation.role,
    v_invitation.can_review_topics,
    v_invitation.invited_by_user_id
  ) returning id into v_collaborator_id;

  update public.course_collaborator_invitations
  set status = 'accepted', actioned_by_user_id = v_actor_id, actioned_at = now()
  where id = v_invitation.id;

  return jsonb_build_object(
    'status', 'accepted',
    'invitation_id', v_invitation.id,
    'course_id', v_invitation.course_id,
    'collaborator_id', v_collaborator_id,
    'role', v_invitation.role,
    'can_review_topics', v_invitation.can_review_topics
  );
end;
$$;

create or replace function public.reject_course_collaborator_invitation(
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_course_id uuid;
begin
  if v_actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select course_id into v_course_id from public.course_collaborator_invitations where id = p_invitation_id;
  if v_course_id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  update public.course_collaborator_invitations
  set status = 'rejected', actioned_by_user_id = v_actor_id, actioned_at = now()
  where id = p_invitation_id and invitee_user_id = v_actor_id and status = 'pending';
  if not found then raise exception 'INVITATION_STALE'; end if;
  return jsonb_build_object('status', 'rejected', 'invitation_id', p_invitation_id, 'course_id', v_course_id);
end;
$$;

create or replace function public.revoke_course_collaborator_invitation(
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.course_member_role;
  v_invitation public.course_collaborator_invitations%rowtype;
begin
  if v_actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_invitation from public.course_collaborator_invitations where id = p_invitation_id;
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_invitation.course_id::text));
  select cc.role into v_actor_role from public.course_collaborators cc
  where cc.course_id = v_invitation.course_id and cc.user_id = v_actor_id;
  if v_actor_role not in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
     or (v_actor_role = 'co_owner'::public.course_member_role and v_invitation.role = 'co_owner'::public.course_member_role) then
    raise exception 'INVITATION_MANAGEMENT_FORBIDDEN';
  end if;
  update public.course_collaborator_invitations
  set status = 'revoked', actioned_by_user_id = v_actor_id, actioned_at = now()
  where id = p_invitation_id and status = 'pending';
  if not found then raise exception 'INVITATION_STALE'; end if;
  return jsonb_build_object('status', 'revoked', 'invitation_id', p_invitation_id, 'course_id', v_invitation.course_id);
end;
$$;

revoke all on function public.send_course_collaborator_invitation(uuid, text, public.course_member_role, boolean) from public, anon;
revoke all on function public.accept_course_collaborator_invitation(uuid) from public, anon;
revoke all on function public.reject_course_collaborator_invitation(uuid) from public, anon;
revoke all on function public.revoke_course_collaborator_invitation(uuid) from public, anon;
grant execute on function public.send_course_collaborator_invitation(uuid, text, public.course_member_role, boolean) to authenticated, service_role;
grant execute on function public.accept_course_collaborator_invitation(uuid) to authenticated, service_role;
grant execute on function public.reject_course_collaborator_invitation(uuid) to authenticated, service_role;
grant execute on function public.revoke_course_collaborator_invitation(uuid) to authenticated, service_role;
