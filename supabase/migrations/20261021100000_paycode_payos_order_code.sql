-- PAYCODE: mã đơn PayOS lấy từ payos_order_code_seq qua RPC chỉ service_role gọi được.
-- RPC cố định sequence và không nhận tên sequence, nên người gọi không thể đọc hay tăng sequence khác (G1).
create function public.next_payos_order_code()
returns bigint
language sql
volatile
security invoker
set search_path = ''
as $$
  select nextval('public.payos_order_code_seq')
$$;

-- ALTER DEFAULT PRIVILEGES cấp function mới của public cho anon/authenticated; thu hồi cả PUBLIC (G2).
revoke all on function public.next_payos_order_code() from public, anon, authenticated;
grant execute on function public.next_payos_order_code() to service_role;

-- Nâng sequence lên trên mã đã lưu và trên mọi mã Date.now() (13 chữ số, hiện ~1,7e12) mà deployment cũ
-- còn tạo được giữa lúc áp migration và lúc deploy, nên điểm sàn là 8999999999999 chứ không chỉ max đã lưu (G3).
-- Mã lưu so sánh bằng numeric để chuỗi số dài bất thường không gây overflow; ngoài khoảng 13 chữ số thì
-- raise exception và cả migration rollback, không đổi gì.
-- Thứ tự bắt buộc: kiểm khoảng -> ALTER SEQUENCE -> setval. setval không tự rollback, nhưng ALTER SEQUENCE cấp storage
-- mới cho sequence trong transaction này nên setval chạy sau nó được rollback cùng migration nếu bước sau đó lỗi.
-- Điều kiện target < 9999999999999 cũng bảo đảm ALTER MAXVALUE không vướng giá trị hiện tại: target >= last_value
-- khi is_called, và >= last_value - 1 khi chưa is_called (mã kế tiếp chính là last_value), nên last_value <= 9999999999999.
do $paycode$
declare
  seq_last bigint;
  seq_called boolean;
  stored_max numeric;
  target numeric;
begin
  select last_value, is_called into seq_last, seq_called from public.payos_order_code_seq;

  select max(gateway_order_id::numeric) into stored_max
  from public.payments
  where gateway = 'payos' and gateway_order_id ~ '^[0-9]+$';

  target := greatest(
    case when seq_called then seq_last else seq_last - 1 end,
    coalesce(stored_max, 0),
    8999999999999
  );

  if target >= 9999999999999 then
    raise exception 'payos_order_code_seq: giá trị kế tiếp % vượt khoảng 13 chữ số (tối đa 9999999999999)', target + 1;
  end if;

  -- Hết dải 13 chữ số thì nextval báo lỗi (2200H) và checkout dừng, thay vì sinh mã 14 chữ số hoặc lặp mã.
  alter sequence public.payos_order_code_seq maxvalue 9999999999999 no cycle;

  perform setval('public.payos_order_code_seq', target::bigint, true);
end
$paycode$;
