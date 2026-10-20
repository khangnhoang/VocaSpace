-- FEAT6 AC10 / G7: học viên vẫn thấy tên khóa học họ đã thanh toán sau khi khóa đó bị ẩn (nháp, gỡ).
-- Policy "Users can view their own payments" cho đọc dòng thanh toán của mình, nhưng bảng courses chỉ đọc được qua
-- can_view_course_basic nên phép join course trong lịch sử có thể rỗng. Hàm này chỉ trả tiêu đề, và chỉ cho những
-- payment mà chính người gọi sở hữu. SECURITY DEFINER vì người gọi không có quyền đọc dòng courses đó.
-- Không bảng, policy hay grant bảng nào đổi.
create function public.get_own_payment_course_titles(p_payment_ids uuid[])
returns table (payment_id uuid, course_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, c.title
  from public.payments p
  join public.courses c on c.id = p.course_id
  where p.user_id = (select auth.uid())
    and p.id = any (p_payment_ids)
$$;

-- Default privileges của schema public cấp EXECUTE cho anon và service_role; chỉ authenticated được gọi.
revoke all on function public.get_own_payment_course_titles(uuid[]) from public, anon, service_role;
grant execute on function public.get_own_payment_course_titles(uuid[]) to authenticated;
