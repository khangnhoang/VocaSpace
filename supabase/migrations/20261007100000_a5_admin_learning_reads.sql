-- AUTH-021: policy cũ chỉ cho mỗi user đọc enrollments / user_flashcards của chính mình, nên
-- dashboard admin (dùng user client sau bước kiểm tra admin) chỉ thấy dữ liệu của admin.
-- Thêm policy SELECT cộng thêm (permissive, OR với policy cũ) cho admin đang hoạt động.
-- Không dùng public.is_admin(): hàm đó chỉ kiểm role, không kiểm removed_at, nên admin đã bị
-- xoá mềm vẫn đọc được. Điều kiện nằm tại chỗ để cả hai vế (role và removed_at) đều được kiểm.
create policy "Enrollments - Active Admin Select"
  on public.enrollments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.removed_at is null
    )
  );

create policy "User_flashcards - Active Admin Select"
  on public.user_flashcards
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.removed_at is null
    )
  );
