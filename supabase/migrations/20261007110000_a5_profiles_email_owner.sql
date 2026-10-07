-- AUTH-020: user tự sửa được email, phone và removed_at của chính dòng profiles qua REST API,
-- trong khi /profile chỉ sửa full_name, dob, gender, username (một lần) và avatar_url.
-- email phải bám auth.users.email, phone chỉ admin sửa (service role), removed_at là cờ xoá mềm.
-- Thu hẹp quyền UPDATE theo cột còn đúng sáu cột /profile dùng. Không được khôi phục ba cột đã bỏ.
revoke update on table public.profiles from authenticated;
grant update (
  username,
  full_name,
  avatar_url,
  dob,
  gender,
  updated_at
) on table public.profiles to authenticated;

-- Email chỉ đổi qua Auth (admin API hoặc luồng đổi email). Trigger giữ profiles.email khớp
-- auth.users.email sau khi đổi. security definer + search_path rỗng; chỉ ghi profiles.email của
-- đúng new.id và chỉ chạy khi email thật sự đổi. Thứ tự khoá: auth.users (đang bị UPDATE) rồi
-- profiles, cùng thứ tự với FK cascade và public.admin_delete_learner.
create or replace function public.a5_sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return null;
end;
$$;

revoke all on function public.a5_sync_profile_email() from public, anon, authenticated;

create trigger a5_sync_profile_email
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.a5_sync_profile_email();
