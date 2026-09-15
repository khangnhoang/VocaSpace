-- Keep course thumbnail Storage writes aligned with normal course authoring.
-- Course creation has no course row yet, so it uses a caller-scoped staging prefix.
drop policy if exists "Teacher and Admin Upload Thumbnails" on storage.objects;
drop policy if exists "Course Author Upload Thumbnails" on storage.objects;

create policy "Course Author Upload Thumbnails"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'course_thumbnails'
  and (
    (
      name like 'create/' || auth.uid()::text || '/%'
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.removed_at is null
          and p.role = 'teacher'::public.user_role
      )
    )
    or (
      split_part(name, '/', 1) = 'course'
      and exists (
        select 1
        from public.courses c
        join public.course_collaborators cc on cc.course_id = c.id
        where c.id::text = split_part(storage.objects.name, '/', 2)
          and c.removed_at is null
          and cc.user_id = auth.uid()
          and cc.role in (
            'owner'::public.course_member_role,
            'co_owner'::public.course_member_role,
            'editor'::public.course_member_role
          )
      )
    )
  )
);
