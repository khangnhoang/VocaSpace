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
  v_cap integer;
  v_active_count integer;
  v_pending_count integer;
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

  if p_role <> v_target.role then
    v_cap := public.d1_course_collaborator_role_cap(p_role);
    select count(*) into v_active_count
    from public.course_collaborators cc
    where cc.course_id = v_target.course_id and cc.role = p_role;
    select count(*) into v_pending_count
    from public.course_collaborator_invitations i
    where i.course_id = v_target.course_id and i.role = p_role and i.status = 'pending';
    if v_active_count + v_pending_count >= v_cap then
      raise exception 'COLLABORATOR_ROLE_CAPACITY_REACHED';
    end if;
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

revoke all on function public.update_course_collaborator_role(uuid, public.course_member_role) from public, anon;
grant execute on function public.update_course_collaborator_role(uuid, public.course_member_role) to authenticated, service_role;
