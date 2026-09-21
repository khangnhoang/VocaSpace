-- D1 correction: ordinary question-group media deletion follows the same
-- topic lifecycle and authorship boundary as content mutation. Global admins
-- retain the existing platform moderation exception.

drop policy if exists "Owner or Admin Delete Question Group Images" on storage.objects;
create policy "Owner or Admin Delete Question Group Images"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'question_group_images'
  and (
    public.is_admin()
    or (
      owner = auth.uid()
      and exists (
        select 1
        from public.topics t
        where t.id::text = split_part(storage.objects.name, '/', 2)
          and t.course_id::text = split_part(storage.objects.name, '/', 1)
          and t.removed_at is null
          and t.status = 'draft'::public.item_status
          and public.d1_topic_group_member(t.id)
      )
    )
  )
);

drop policy if exists "Owner or Admin Delete Question Group Audios" on storage.objects;
create policy "Owner or Admin Delete Question Group Audios"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'question_group_audios'
  and (
    public.is_admin()
    or (
      owner = auth.uid()
      and exists (
        select 1
        from public.topics t
        where t.id::text = split_part(storage.objects.name, '/', 2)
          and t.course_id::text = split_part(storage.objects.name, '/', 1)
          and t.removed_at is null
          and t.status = 'draft'::public.item_status
          and public.d1_topic_group_member(t.id)
      )
    )
  )
);
