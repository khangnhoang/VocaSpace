-- AD4: số liệu tổng quan của /admin tính hoàn toàn trong database để tổng không dừng ở max_rows (1000)
-- của PostgREST. Chỉ đọc, không đổi dữ liệu; không có bảng, cột hay policy nào bị thay.

-- SECURITY INVOKER: các policy hiện có (payments, enrollments, user_flashcards, courses, profiles)
-- vẫn là lớp chặn cuối cùng. Kiểm tra is_admin() chạy đầu tiên nên người không phải admin, hoặc admin
-- đã bị gỡ (removed_at) dù JWT còn hạn, nhận lỗi 42501 và không đọc bất kỳ bảng nào.
create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz constant text := 'Asia/Ho_Chi_Minh';
  -- Một now() cho cả lời gọi: cửa sổ sáu tháng và các cột biểu đồ dùng chung một mốc nên luôn khớp nhau.
  v_now timestamptz := now();
  v_current_month timestamp := date_trunc('month', v_now at time zone v_tz);
  v_first_month timestamp := date_trunc('month', v_now at time zone v_tz) - interval '5 months';
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_pending_count bigint;
  v_pending_oldest timestamptz;
  v_students bigint;
  v_teachers bigint;
  v_admins bigint;
  v_published bigint;
  v_flashcards bigint;
  v_months jsonb;
  v_revenue_total numeric;
  v_top_courses jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  v_window_start := v_first_month at time zone v_tz;
  v_window_end := (v_current_month + interval '1 month') at time zone v_tz;

  select count(*), min(c.submitted_at)
  into v_pending_count, v_pending_oldest
  from public.courses c
  where c.status = 'pending' and c.removed_at is null;

  select
    count(*) filter (where p.role = 'student'),
    count(*) filter (where p.role = 'teacher'),
    count(*) filter (where p.role = 'admin')
  into v_students, v_teachers, v_admins
  from public.profiles p
  where p.removed_at is null;

  select count(*) into v_published
  from public.courses c
  where c.status = 'published' and c.removed_at is null;

  select count(*) into v_flashcards from public.user_flashcards;

  -- Doanh thu theo thời điểm tạo đơn (created_at): updated_at đổi khi học viên bị xóa nên không dùng được.
  -- Chỉ đơn paid bằng VND; tháng không có đơn vẫn có một dòng bằng 0. Tổng sáu tháng lấy từ chính các cột này.
  with months as (
    select m.month_start, coalesce(r.revenue, 0) as revenue
    from generate_series(v_first_month, v_current_month, interval '1 month') as m(month_start)
    left join (
      select date_trunc('month', pay.created_at at time zone v_tz) as month_start,
             sum(pay.amount_final) as revenue
      from public.payments pay
      where pay.status = 'paid'
        and pay.currency = 'VND'
        and pay.created_at >= v_window_start
        and pay.created_at < v_window_end
      group by 1
    ) r on r.month_start = m.month_start
  )
  select
    jsonb_agg(jsonb_build_object('month', to_char(months.month_start, 'YYYY-MM'), 'revenue', months.revenue)
              order by months.month_start),
    sum(months.revenue)
  into v_months, v_revenue_total
  from months;

  -- Xếp hạng theo số ghi danh (gồm cả học viên đã bị gỡ), hòa thì theo tên rồi id để thứ tự ổn định.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'enrollment_count', t.enrollment_count,
        'revenue', t.revenue
      )
      order by t.enrollment_count desc, t.title asc, t.id asc
    ),
    '[]'::jsonb
  )
  into v_top_courses
  from (
    select
      c.id,
      c.title,
      (select count(*) from public.enrollments e where e.course_id = c.id) as enrollment_count,
      (select coalesce(sum(pay.amount_final), 0)
       from public.payments pay
       where pay.course_id = c.id and pay.status = 'paid' and pay.currency = 'VND') as revenue
    from public.courses c
    where c.removed_at is null
    order by 3 desc, c.title asc, c.id asc
    limit 5
  ) t;

  return jsonb_build_object(
    'generated_at', v_now,
    'pending', jsonb_build_object('count', v_pending_count, 'oldest_submitted_at', v_pending_oldest),
    'users', jsonb_build_object('students', v_students, 'teachers', v_teachers, 'admins', v_admins),
    'published_courses', v_published,
    'flashcards', v_flashcards,
    'revenue', jsonb_build_object('total', v_revenue_total, 'months', v_months),
    'top_courses', v_top_courses
  );
end;
$$;

-- Schema mặc định cấp execute cho cả ba role API; thu hồi hết rồi chỉ cấp cho authenticated
-- (anon bị từ chối ngay ở quyền execute, service_role không có phiên admin để qua is_admin()).
revoke all on function public.admin_dashboard_summary() from public, anon, authenticated, service_role;
grant execute on function public.admin_dashboard_summary() to authenticated;
