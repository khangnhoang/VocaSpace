-- TPORT1: đọc một lần cho trang /teacher/courses (khóa học đang cộng tác + hàng chờ việc liên khóa).
-- Chỉ đọc; không ghi bảng nào. Kế hoạch: docs/teacher-course-portfolio-plan.md (CP1).
-- Rollback: supabase/rollbacks/20261021120000_tport1_teacher_course_portfolio.down.sql.
--
-- Danh tính người gọi chỉ lấy từ auth.uid(); hàm không nhận tham số. Hàm là SECURITY DEFINER vì
-- topic_review_submissions không cho authenticated đọc trực tiếp. Mọi điều kiện quyền tái dùng đúng
-- predicate D1 đang hiệu lực thay vì tự định nghĩa lại:
--   - duyệt:      public.has_topic_review_access (approve/reject_topic_review cũng gọi hàm này) + loại người gửi
--   - sửa topic:  public.d1_topic_group_member (canEdit của get_topic_workflow_state) + creator/responsible
--   - sửa course: public.has_course_authoring_access (policy "Courses - Staff Update Secured")
create or replace function public.get_teacher_course_portfolio()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_role public.user_role;
  v_courses jsonb;
  v_attention jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select p.role into v_profile_role
  from public.profiles p
  where p.id = v_user_id and p.removed_at is null;
  if not found then raise exception 'TEACHER_PORTFOLIO_FORBIDDEN'; end if;

  -- Cùng nguồn và thứ tự với getCoursesForTeacher; thêm membership_created_at để UI chọn khóa
  -- học tiếp tục theo thứ tự ổn định khi không có việc cần xử lý.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'title', c.title,
           'slug', c.slug,
           'description', c.description,
           'thumbnail_url', c.thumbnail_url,
           'price', coalesce(c.price, 0),
           'status', coalesce(c.status, 'draft'::public.item_status),
           'order_index', coalesce(c.order_index, 0),
           'reject_message', c.reject_message,
           'reviewed_at', c.reviewed_at,
           'my_role', cc.role,
           'membership_created_at', cc.created_at
         ) order by cc.created_at desc, c.id), '[]'::jsonb)
  into v_courses
  from public.course_collaborators cc
  join public.courses c on c.id = cc.course_id
  where cc.user_id = v_user_id
    and c.removed_at is null;

  -- Mỗi dòng sinh ra từ topic hoặc course (không từ vai trò), nên người giữ nhiều vai trò trên
  -- cùng một topic không bị lặp. Một topic không thể vừa pending vừa draft nên review và
  -- correction không trùng nhau.
  with my_courses as (
    select c.id, c.title, c.status, c.reject_message, c.reviewed_at
    from public.course_collaborators cc
    join public.courses c on c.id = cc.course_id
    where cc.user_id = v_user_id
      and c.removed_at is null
  ),
  -- Cùng ràng buộc topic/chapter/course đang hoạt động mà get_topic_workflow_state yêu cầu, để
  -- link vào Topic Builder không rơi vào TOPIC_NOT_FOUND.
  live_topics as (
    select t.id, t.title, t.status, t.course_id, t.original_creator_user_id,
           t.responsible_author_user_id, mc.title as course_title
    from public.topics t
    join my_courses mc on mc.id = t.course_id
    join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id
    where t.removed_at is null
      and ch.removed_at is null
  ),
  review_items as (
    select 'topic_review'::text as kind, lt.course_id, lt.course_title,
           lt.id as topic_id, lt.title as topic_title,
           null::text as reason, s.submitted_at as ordering_at
    from live_topics lt
    join public.topic_review_submissions s on s.topic_id = lt.id and s.status = 'pending'
    where lt.status = 'pending'
      and s.submitted_by_user_id <> v_user_id
      and public.has_topic_review_access(lt.id)
  ),
  -- Bản nộp mới nhất của topic theo mọi người gửi; chỉ khi bản đó là 'rejected' topic mới còn cần
  -- sửa. Bản pending/approved/cancelled mới hơn đều thay thế lần từ chối cũ.
  latest_submissions as (
    select distinct on (s.topic_id)
           s.topic_id, s.status, s.rejection_reason, s.reviewed_at, s.submitted_at
    from public.topic_review_submissions s
    where s.topic_id in (select id from live_topics)
    order by s.topic_id, s.submitted_at desc, s.id desc
  ),
  correction_items as (
    select 'topic_correction'::text as kind, lt.course_id, lt.course_title,
           lt.id as topic_id, lt.title as topic_title,
           ls.rejection_reason as reason,
           coalesce(ls.reviewed_at, ls.submitted_at) as ordering_at
    from live_topics lt
    join latest_submissions ls on ls.topic_id = lt.id
    where ls.status = 'rejected'
      and lt.status = 'draft'
      and not exists (
        select 1 from public.topic_review_submissions p
        where p.topic_id = lt.id and p.status = 'pending'
      )
      and v_user_id in (lt.original_creator_user_id, lt.responsible_author_user_id)
      and public.d1_topic_group_member(lt.id)
  ),
  -- Cùng điều kiện hiển thị lý do từ chối mà CourseList đang dùng, cộng quyền sửa course.
  course_items as (
    select 'course_rejection'::text as kind, mc.id as course_id, mc.title as course_title,
           null::uuid as topic_id, null::text as topic_title,
           btrim(mc.reject_message) as reason, mc.reviewed_at as ordering_at
    from my_courses mc
    where mc.status = 'draft'::public.item_status
      and mc.reviewed_at is not null
      and nullif(btrim(coalesce(mc.reject_message, '')), '') is not null
      and public.has_course_authoring_access(mc.id)
  ),
  all_items as (
    select * from correction_items
    union all select * from course_items
    union all select * from review_items
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', i.kind,
           'course_id', i.course_id,
           'course_title', i.course_title,
           'topic_id', i.topic_id,
           'topic_title', i.topic_title,
           'reason', i.reason,
           'ordering_at', i.ordering_at
         ) order by i.ordering_at, i.kind, i.course_id, i.topic_id), '[]'::jsonb)
  into v_attention
  from all_items i;

  return jsonb_build_object(
    'can_create_course', v_profile_role = 'teacher'::public.user_role,
    'courses', v_courses,
    'attention', v_attention
  );
end;
$$;

-- Thu hồi cả anon: quyền execute mặc định của Supabase vẫn còn sau khi chỉ revoke từ public.
revoke all on function public.get_teacher_course_portfolio() from public, anon;
grant execute on function public.get_teacher_course_portfolio() to authenticated, service_role;
