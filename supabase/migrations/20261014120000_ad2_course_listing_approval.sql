-- AD2: khóa học chỉ vào catalog công khai khi một admin đang hoạt động duyệt (ADMIN-002).
-- Giáo viên gửi duyệt / rút lại, admin duyệt / từ chối, tất cả qua bốn RPC bên dưới; không ai
-- còn đổi status hay các cột review của `courses` bằng update trực tiếp từ client.

-- Dữ liệu cũ trước: khóa học `pending` mà chưa từng có `submitted_at` là trạng thái không tạo được
-- bằng luồng mới, nên đưa về `draft` để owner gửi duyệt lại. Trigger set_updated_at_courses
-- tự cập nhật updated_at; không cột nào khác đổi. Khóa học `published` giữ nguyên.
update public.courses
set status = 'draft'
where status = 'pending' and submitted_at is null;

-- Khóa quyền ghi: bỏ UPDATE cấp bảng rồi mới cấp UPDATE theo cột (revoke riêng cột không đủ vì
-- quyền cấp bảng phủ mọi cột). Danh sách cột là đúng những cột `updateCourse` và `deleteCourse`
-- ghi; policy "Courses - Staff Update Secured" giữ nguyên. service_role và các RPC security
-- definer không bị ảnh hưởng.
revoke update on table public.courses from public, anon, authenticated;
grant update (title, slug, description, price, thumbnail_url, removed_at)
  on table public.courses to authenticated;

-- Helper dùng chung cho gửi duyệt và duyệt: khóa học có ít nhất một bài đã xuất bản còn hoạt động
-- trong một chương còn hoạt động. Chỉ RPC (chạy bằng quyền owner) gọi được.
create or replace function public.ad2_course_has_published_topic(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.topics t
    join public.chapters ch on ch.id = t.chapter_id and ch.course_id = t.course_id
    where t.course_id = p_course_id
      and t.status = 'published'
      and t.removed_at is null
      and ch.removed_at is null
  )
$$;

revoke all on function public.ad2_course_has_published_topic(uuid)
  from public, anon, authenticated, service_role;

-- Cả bốn RPC dưới đây: course advisory lock trước mọi row lock (cùng thứ tự với các RPC cấu trúc
-- khóa học), rồi mới đọc hàng course `for update`; mọi kiểm tra người gọi và trạng thái chạy SAU
-- khi có khóa, để một lời gọi phải chờ thấy kết quả của giao dịch đang giữ khóa (ví dụ owner vừa
-- bị hạ xuống editor, hoặc course vừa được rút lại).

create or replace function public.submit_course_review(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_course public.courses%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtext(p_course_id::text));
  select * into v_course from public.courses c where c.id = p_course_id for update;
  if v_course.id is null or v_course.removed_at is not null then raise exception 'COURSE_NOT_FOUND'; end if;

  -- Chỉ owner / co_owner có hồ sơ còn hoạt động; editor, previewer và admin ngoài membership không đủ.
  if not exists (
    select 1
    from public.course_collaborators cc
    join public.profiles p on p.id = cc.user_id
    where cc.course_id = p_course_id
      and cc.user_id = v_actor
      and cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
      and p.removed_at is null
  ) then
    raise exception 'COURSE_SUBMIT_FORBIDDEN';
  end if;

  if v_course.status is distinct from 'draft'::public.item_status then
    raise exception 'COURSE_REVIEW_STATE_INVALID';
  end if;
  if not public.ad2_course_has_published_topic(p_course_id) then
    raise exception 'COURSE_SUBMIT_NOT_READY';
  end if;

  update public.courses c
  set status = 'pending',
      submitted_at = now(),
      reject_message = null,
      reviewed_at = null,
      reviewed_by = null
  where c.id = p_course_id;

  return jsonb_build_object('course_id', p_course_id, 'status', 'pending');
end;
$$;

create or replace function public.withdraw_course_review(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_course public.courses%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtext(p_course_id::text));
  select * into v_course from public.courses c where c.id = p_course_id for update;
  if v_course.id is null or v_course.removed_at is not null then raise exception 'COURSE_NOT_FOUND'; end if;

  if not exists (
    select 1
    from public.course_collaborators cc
    join public.profiles p on p.id = cc.user_id
    where cc.course_id = p_course_id
      and cc.user_id = v_actor
      and cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
      and p.removed_at is null
  ) then
    raise exception 'COURSE_SUBMIT_FORBIDDEN';
  end if;

  if v_course.status is distinct from 'pending'::public.item_status then
    raise exception 'COURSE_REVIEW_STATE_INVALID';
  end if;

  -- Các cột review đã được xóa lúc gửi duyệt nên không cần đụng tới.
  update public.courses c
  set status = 'draft',
      submitted_at = null
  where c.id = p_course_id;

  return jsonb_build_object('course_id', p_course_id, 'status', 'draft');
end;
$$;

create or replace function public.approve_course_review(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_course public.courses%rowtype;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtext(p_course_id::text));
  select * into v_course from public.courses c where c.id = p_course_id for update;

  -- Kiểm admin trước kết quả "không tìm thấy" để người không phải admin luôn nhận cùng một lỗi.
  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.removed_at is null
  ) then
    raise exception 'ADMIN_COURSE_REVIEW_FORBIDDEN';
  end if;
  if v_course.id is null or v_course.removed_at is not null then raise exception 'COURSE_NOT_FOUND'; end if;

  if v_course.status is distinct from 'pending'::public.item_status or v_course.submitted_at is null then
    raise exception 'COURSE_REVIEW_STATE_INVALID';
  end if;
  -- Bài có thể bị gỡ xuất bản sau lúc gửi duyệt; kiểm lại tại thời điểm duyệt.
  if not public.ad2_course_has_published_topic(p_course_id) then
    raise exception 'COURSE_SUBMIT_NOT_READY';
  end if;

  update public.courses c
  set status = 'published',
      reviewed_at = now(),
      reviewed_by = v_actor,
      reject_message = null
  where c.id = p_course_id;

  return jsonb_build_object('course_id', p_course_id, 'status', 'published');
end;
$$;

create or replace function public.reject_course_review(p_course_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_course public.courses%rowtype;
  -- Cắt khoảng trắng hai đầu như `.trim()` của rejectCourseSchema (cả tab và xuống dòng).
  v_reason text := regexp_replace(coalesce(p_reason, ''), '^\s+|\s+$', '', 'g');
  v_reason_length integer;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtext(p_course_id::text));
  select * into v_course from public.courses c where c.id = p_course_id for update;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.removed_at is null
  ) then
    raise exception 'ADMIN_COURSE_REVIEW_FORBIDDEN';
  end if;
  if v_course.id is null or v_course.removed_at is not null then raise exception 'COURSE_NOT_FOUND'; end if;

  if v_course.status is distinct from 'pending'::public.item_status or v_course.submitted_at is null then
    raise exception 'COURSE_REVIEW_STATE_INVALID';
  end if;
  -- Độ dài tính theo đơn vị UTF-16 như `.min(10).max(1000)` của Zod: ký tự ngoài BMP (4 byte UTF-8,
  -- ví dụ emoji) chiếm 2 đơn vị, còn char_length chỉ đếm 1.
  select char_length(v_reason) + count(*) filter (where octet_length(ch) = 4)
    into v_reason_length
  from regexp_split_to_table(v_reason, '') as ch;
  if v_reason_length < 10 or v_reason_length > 1000 then
    raise exception 'COURSE_REJECT_REASON_INVALID';
  end if;

  update public.courses c
  set status = 'draft',
      submitted_at = null,
      reject_message = v_reason,
      reviewed_at = now(),
      reviewed_by = v_actor
  where c.id = p_course_id;

  return jsonb_build_object('course_id', p_course_id, 'status', 'draft');
end;
$$;

-- `service_role` được cấp execute mặc định trên hàm mới, nên phải thu hồi tường minh;
-- chỉ người đã đăng nhập gọi được, và mỗi RPC tự kiểm auth.uid().
revoke all on function public.submit_course_review(uuid) from public, anon, authenticated, service_role;
revoke all on function public.withdraw_course_review(uuid) from public, anon, authenticated, service_role;
revoke all on function public.approve_course_review(uuid) from public, anon, authenticated, service_role;
revoke all on function public.reject_course_review(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_course_review(uuid) to authenticated;
grant execute on function public.withdraw_course_review(uuid) to authenticated;
grant execute on function public.approve_course_review(uuid) to authenticated;
grant execute on function public.reject_course_review(uuid, text) to authenticated;
