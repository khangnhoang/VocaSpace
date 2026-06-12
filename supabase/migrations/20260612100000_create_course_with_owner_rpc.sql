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

  if not (
    public.is_admin()
    or public.get_my_role() = 'teacher'::public.user_role
  ) then
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

drop policy if exists "Select courses dynamic filter" on public.courses;

create policy "Select courses dynamic filter"
on public.courses
for select
to public
using (public.can_view_course_basic(id));
