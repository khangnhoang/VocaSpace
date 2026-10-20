-- Trả lại quyền như baseline trước PAYGRANT. Việc này mở lại lỗ hổng tự đánh dấu paid,
-- chỉ dùng khi một luồng production bị hỏng và không sửa tiến được.
grant execute on function public.handle_payment_success(text, text, text) to public, anon, authenticated;
grant execute on function public.reserve_discount_usage(uuid) to public, anon, authenticated;
grant execute on function public.expire_stale_payments(integer) to public, anon, authenticated;

grant all on table public.payments to anon, authenticated;

grant all on sequence public.payos_order_code_seq to anon, authenticated;
