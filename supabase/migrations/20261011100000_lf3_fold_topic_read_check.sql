-- LF3 (PERF-RLS-001, Owner decision Q5): gộp hai helper luôn chạy của private.q7_can_read_topic vào chính câu truy vấn của nó.
-- Đo trên runtime tách biệt sau thay đổi per-parent: q7_can_read_topic chiếm ~85% thời gian câu (b), và mỗi lần gọi
-- chạy thêm has_course_content_read_access (plpgsql, nhiều truy vấn) và is_admin (hàm SQL lồng, bị plan lại ở mỗi lần gọi).
-- Kết quả KHÔNG đổi: mọi nhánh của hai helper được viết lại dưới đây với cùng ba giá trị logic (đúng/sai/null).
--   public.is_admin()                         = p.role = 'admin' (cùng dòng profiles của auth.uid(), p đã đòi chưa bị xóa mềm).
--   public.has_course_content_read_access(c)  = khóa học đã xóa mềm -> chỉ admin; còn lại admin, hoặc collaborator
--                                               owner/co_owner/editor/previewer, hoặc enrollment của người gọi khi khóa KHÔNG bị từ chối bởi
--                                               `status != 'published'`: bản gốc dùng `IF v_status != 'published' THEN RETURN false`, nên
--                                               courses.status NULL (cột nullable) không từ chối và enrollment vẫn cấp quyền đọc.
-- d1_topic_group_member và has_topic_review_access giữ nguyên lời gọi (chỉ chạy khi topic chưa published và người gọi không phải
-- admin/staff). Chữ ký, quyền thực thi và mọi nơi gọi (policy, Storage media, D4, LF2, workflow RPC) không đổi.
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
      and (
        (c.removed_at is not null and p.role = 'admin'::public.user_role)
        or (
          c.removed_at is null
          and (
            p.role = 'admin'::public.user_role
            or exists (
              select 1 from public.course_collaborators cc0
              where cc0.course_id = t.course_id
                and cc0.user_id = (select auth.uid())
                and cc0.role in (
                  'owner'::public.course_member_role,
                  'co_owner'::public.course_member_role,
                  'editor'::public.course_member_role,
                  'previewer'::public.course_member_role
                )
            )
            or (
              (c.status is null or c.status = 'published'::public.item_status)
              and exists (
                select 1 from public.enrollments en
                where en.course_id = t.course_id and en.user_id = (select auth.uid())
              )
            )
          )
        )
      )
      and (
        p.role = 'admin'::public.user_role
        or (c.removed_at is null and ch.removed_at is null)
      )
      and (
        t.status = 'published'::public.item_status
        or p.role = 'admin'::public.user_role
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
