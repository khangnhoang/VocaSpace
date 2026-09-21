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

  select u.id into v_invitee_id
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.deleted_at is null
    and p.removed_at is null
    and lower(coalesce(u.email, '')) = v_email
    and not exists (
      select 1
      from auth.users duplicate
      where duplicate.id <> u.id
        and duplicate.deleted_at is null
        and lower(coalesce(duplicate.email, '')) = v_email
    )
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

revoke all on function public.send_course_collaborator_invitation(uuid, text, public.course_member_role, boolean) from public, anon;
grant execute on function public.send_course_collaborator_invitation(uuid, text, public.course_member_role, boolean) to authenticated, service_role;

create or replace function public.get_my_pending_course_collaborator_invitations()
returns table (
  id uuid,
  course_id uuid,
  course_title text,
  course_slug text,
  invitee_user_id uuid,
  role public.course_member_role,
  can_review_topics boolean,
  status text,
  created_at timestamptz,
  actioned_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.course_id,
    c.title,
    c.slug,
    i.invitee_user_id,
    i.role,
    i.can_review_topics,
    i.status,
    i.created_at,
    i.actioned_at
  from public.course_collaborator_invitations i
  join public.courses c on c.id = i.course_id
  where i.invitee_user_id = auth.uid()
    and i.status = 'pending'
  order by i.created_at desc;
$$;

revoke all on function public.get_my_pending_course_collaborator_invitations() from public, anon;
grant execute on function public.get_my_pending_course_collaborator_invitations() to authenticated, service_role;
