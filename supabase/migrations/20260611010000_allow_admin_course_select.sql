-- Temporary RLS fix: allow admins to select courses explicitly.
-- Broader course visibility policy can be refactored later.
drop policy if exists "Select courses dynamic filter" on public.courses;

create policy "Select courses dynamic filter"
on public.courses
for select
to public
using (
  public.is_admin()
  or public.can_view_course_basic(id)
);
