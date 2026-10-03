-- A1: hook "Before User Created" chỉ cho tạo user qua Google hoặc qua server của app.
-- Contract: docs/refactors/auth-onboarding/implementation-plans/a1/plan.md (G8, H12).
--
-- Public Auth API (`signUp`, `signInWithOtp`) với anon key không được tạo user email, vì
-- người tạo trước có thể đặt sẵn mật khẩu cho email của người khác. User email chỉ được tạo
-- bằng `admin.createUser` kèm marker `app_metadata.d7_server_created` do server đặt; client
-- không ghi được `app_metadata`. Hàm không đọc/ghi bảng nào nên không cần `security definer`.
create or replace function public.d7_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if event->'user'->'app_metadata'->>'provider' = 'google'
     or event->'user'->'app_metadata'->'d7_server_created' = 'true'::jsonb then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Signups must go through VocaSpace'
    )
  );
end;
$$;

grant execute on function public.d7_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.d7_before_user_created(jsonb) from authenticated, anon, public;
