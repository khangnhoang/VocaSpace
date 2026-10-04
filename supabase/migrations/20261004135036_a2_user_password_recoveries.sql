-- A2: bằng chứng recovery thuộc app, chỉ service role được thay thế và tiêu thụ.
create table public.user_password_recoveries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.user_password_recoveries enable row level security;

revoke all on table public.user_password_recoveries from anon, authenticated, service_role, public;
grant select, insert, update, delete on table public.user_password_recoveries to service_role;
