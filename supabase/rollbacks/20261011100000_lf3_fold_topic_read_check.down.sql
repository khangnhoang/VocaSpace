-- Rollback của 20261011100000_lf3_fold_topic_read_check.sql: trả private.q7_can_read_topic về định nghĩa Q7
-- (20260923143029_q7_topic_read_and_private_media.sql), quyền thực thi giữ nguyên vì chỉ thay thân hàm.
-- Không nằm trong supabase/migrations nên Supabase CLI không tự áp dụng; chạy thủ công khi cần quay lui.
create or replace function private.q7_can_read_topic(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.topics t
    join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id
    join public.courses c on c.id = t.course_id
    join public.profiles p on p.id = (select auth.uid())
    where t.id = p_topic_id
      and t.removed_at is null
      and p.removed_at is null
      and public.has_course_content_read_access(t.course_id)
      and (
        public.is_admin()
        or (c.removed_at is null and ch.removed_at is null)
      )
      and (
        t.status = 'published'::public.item_status
        or public.is_admin()
        or exists (
          select 1 from public.course_collaborators cc
          where cc.course_id = t.course_id
            and cc.user_id = (select auth.uid())
            and cc.role in (
              'owner'::public.course_member_role,
              'co_owner'::public.course_member_role,
              'editor'::public.course_member_role
            )
        )
        or public.d1_topic_group_member(t.id)
        or public.has_topic_review_access(t.id)
      )
  )
$$;
