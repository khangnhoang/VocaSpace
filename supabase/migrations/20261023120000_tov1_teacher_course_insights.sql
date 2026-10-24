-- TOV1: số liệu tổng hợp cho trang /teacher/courses/[id] (Tổng quan khóa học): tổng ghi danh, ghi danh mới
-- theo tháng và phân bố tiến độ học viên. Chỉ đọc; không ghi bảng nào. Kế hoạch: docs/teacher-course-overview-plan.md (CP1).
-- Rollback: supabase/rollbacks/20261023120000_tov1_teacher_course_insights.down.sql.
--
-- SECURITY DEFINER vì policy SELECT của enrollments và user_topic_progress chỉ cho học viên đọc dòng của
-- chính mình (G1). Vì vậy hàm tự chặn quyền trước khi đọc: người gọi lấy từ auth.uid(), profile phải còn
-- hoạt động (has_course_authoring_access không kiểm removed_at) và phải là owner/co_owner/editor của khóa
-- học còn hoạt động theo đúng predicate D1 (G2). Kết quả chỉ có số đếm, không id hay dòng của học viên (G3).
create or replace function public.get_teacher_course_insights(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tz constant text := 'Asia/Ho_Chi_Minh';
  -- Một now() cho cả lời gọi để cửa sổ sáu tháng và "tháng hiện tại" luôn khớp nhau (G7).
  v_current_month timestamp := date_trunc('month', now() at time zone v_tz);
  v_first_month timestamp := date_trunc('month', now() at time zone v_tz) - interval '5 months';
  v_enrollment_total bigint;
  v_months jsonb;
  v_counted_topic_total bigint;
  v_progress jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.removed_at is null
  ) then
    raise exception 'TEACHER_INSIGHTS_FORBIDDEN';
  end if;

  -- Khóa học không tồn tại, đã xóa mềm, người ngoài và previewer cùng một mã lỗi để không lộ khóa học nào tồn tại.
  if p_course_id is null or not public.has_course_authoring_access(p_course_id) then
    raise exception 'TEACHER_INSIGHTS_FORBIDDEN';
  end if;

  select count(*) into v_enrollment_total
  from public.enrollments e
  where e.course_id = p_course_id;

  -- Tháng không có ghi danh vẫn có một dòng bằng 0; tháng được cắt theo giờ Việt Nam trong database.
  select jsonb_agg(jsonb_build_object('month', to_char(m.month_start, 'YYYY-MM'), 'count', coalesce(b.enrolled, 0))
                   order by m.month_start)
  into v_months
  from generate_series(v_first_month, v_current_month, interval '1 month') as m(month_start)
  left join (
    select date_trunc('month', e.enrolled_at at time zone v_tz) as month_start, count(*) as enrolled
    from public.enrollments e
    where e.course_id = p_course_id
      and e.enrolled_at >= v_first_month at time zone v_tz
      and e.enrolled_at < (v_current_month + interval '1 month') at time zone v_tz
    group by 1
  ) b on b.month_start = m.month_start;

  -- Bài được tính giống trang học viên (app/actions/enrolled-course-overview.ts): topic published, chưa xóa,
  -- nằm trong chapter chưa xóa của khóa học. Trạng thái từng học viên theo lib/learn-dashboard.ts:
  -- không hoàn thành bài nào → chưa bắt đầu; hoàn thành mọi bài được tính → hoàn thành; còn lại → đang học.
  select count(*) into v_counted_topic_total
  from public.topics t
  join public.chapters ch on ch.id = t.chapter_id
  where ch.course_id = p_course_id
    and ch.removed_at is null
    and t.removed_at is null
    and t.status = 'published'::public.item_status;

  -- Khóa học chưa có bài được tính thì không có phân bố tiến độ (AC8): trả null thay vì xếp mọi người vào "chưa bắt đầu".
  if v_counted_topic_total > 0 then
    with counted_topics as (
      select t.id
      from public.topics t
      join public.chapters ch on ch.id = t.chapter_id
      where ch.course_id = p_course_id
        and ch.removed_at is null
        and t.removed_at is null
        and t.status = 'published'::public.item_status
    ),
    -- user_topic_progress là duy nhất theo (user_id, topic_id) nên mỗi bài được đếm tối đa một lần.
    per_learner as (
      select e.user_id, count(utp.topic_id) as completed
      from public.enrollments e
      left join public.user_topic_progress utp
        on utp.user_id = e.user_id
       and utp.is_topic_completed is true
       and utp.topic_id in (select ct.id from counted_topics ct)
      where e.course_id = p_course_id
      group by e.user_id
    )
    select jsonb_build_object(
             'not_started', count(*) filter (where pl.completed = 0),
             'in_progress', count(*) filter (where pl.completed > 0 and pl.completed < v_counted_topic_total),
             'completed', count(*) filter (where pl.completed >= v_counted_topic_total)
           )
    into v_progress
    from per_learner pl;
  end if;

  return jsonb_build_object(
    'enrollment_total', v_enrollment_total,
    'enrollments_by_month', v_months,
    'counted_topic_total', v_counted_topic_total,
    'progress', v_progress
  );
end;
$$;

-- Thu hồi cả anon: quyền execute mặc định của Supabase vẫn còn sau khi chỉ revoke từ public.
revoke all on function public.get_teacher_course_insights(uuid) from public, anon;
grant execute on function public.get_teacher_course_insights(uuid) to authenticated, service_role;
