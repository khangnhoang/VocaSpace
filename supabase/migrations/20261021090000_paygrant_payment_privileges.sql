-- PAYGRANT: baseline cấp ALL cho anon/authenticated trên các object thanh toán, nên ai có anon key
-- (hoặc học viên đã đăng nhập) gọi được handle_payment_success để tự đánh dấu paid và được ghi danh.
-- Chỉ service_role (checkout, webhook, cron route) và postgres (job pg_cron) cần các quyền này.

-- Thu hồi cả PUBLIC vì function mặc định được cấp EXECUTE cho PUBLIC; chỉ thu hồi anon/authenticated thì vẫn gọi được.
revoke all on function public.handle_payment_success(text, text, text) from public, anon, authenticated;
revoke all on function public.reserve_discount_usage(uuid) from public, anon, authenticated;
revoke all on function public.expire_stale_payments(integer) from public, anon, authenticated;

-- authenticated chỉ giữ SELECT: lịch sử thanh toán, thẻ nhắc /learn, admin_dashboard_summary (SECURITY INVOKER)
-- và Realtime của modal thanh toán đọc qua RLS own-row/staff. Revoke all rồi grant lại để bỏ cả quyền MAINTAIN nếu có.
revoke all on table public.payments from anon, authenticated;
grant select on table public.payments to authenticated;

revoke all on sequence public.payos_order_code_seq from anon, authenticated;
