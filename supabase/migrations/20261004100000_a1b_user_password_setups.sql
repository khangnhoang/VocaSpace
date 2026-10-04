-- A1b: marker do app sở hữu, không bị GoTrue ghi đè khi cập nhật app_metadata.
create table public.user_password_setups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_set_at timestamptz not null default now()
);

alter table public.user_password_setups enable row level security;

-- Thu hồi cả quyền mặc định: marker chỉ được đọc/thêm bằng service role, không sửa/xóa.
revoke all on table public.user_password_setups from anon, authenticated, service_role, public;
grant select, insert on table public.user_password_setups to service_role;

-- Giữ các user đã đặt mật khẩu bằng code cũ; có thể chạy lại sau deploy mà không đổi marker.
insert into public.user_password_setups (user_id)
select id from auth.users
where raw_app_meta_data->'d7_password_set' = 'true'::jsonb
on conflict do nothing;
