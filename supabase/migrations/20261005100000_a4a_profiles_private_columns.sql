-- AUTH-019: policy "Profiles - Public Active Select" vẫn cho mọi role thấy các dòng đang hoạt động,
-- nên chỉ thu hẹp quyền theo cột. email, phone, dob, gender chỉ còn đọc được qua service role
-- (Server Action đã kiểm tra quyền) và các hàm SECURITY DEFINER.
-- id, role, removed_at phải giữ cho cả anon vì policy của bảng khác và của Storage đọc chúng.
-- Chỉ push sau khi bản app không còn đọc các cột riêng tư bằng user client đã deploy READY.
revoke select on table public.profiles from public, anon, authenticated;
grant select (
  id,
  username,
  full_name,
  avatar_url,
  role,
  created_at,
  updated_at,
  removed_at
) on table public.profiles to anon, authenticated;
