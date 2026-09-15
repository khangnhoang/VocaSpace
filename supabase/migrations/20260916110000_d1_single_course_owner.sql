-- A course has one owner; additional privileged memberships use co_owner.
do $$
declare
  v_duplicates text;
begin
  select string_agg(
    format('%s(owner_count=%s)', course_id, owner_count),
    ', ' order by course_id
  )
  into v_duplicates
  from (
    select course_id, count(*) as owner_count
    from public.course_collaborators
    where role = 'owner'::public.course_member_role
    group by course_id
    having count(*) > 1
  ) duplicate_courses;

  if v_duplicates is not null then
    raise exception 'D1_OWNER_INVARIANT_PRECHECK_FAILED: %', v_duplicates;
  end if;
end;
$$;

create unique index if not exists course_collaborators_one_owner_idx
on public.course_collaborators (course_id)
where role = 'owner'::public.course_member_role;
