-- Gỡ RPC mã đơn PayOS và trả giới hạn sequence về mặc định. Không hạ giá trị sequence:
-- hạ xuống sẽ cho phép cấp lại mã đã dùng, còn để cao thì vô hại.
-- Triển khai lại action cũ (fallback Date.now()) trước khi chạy file này.
drop function public.next_payos_order_code();

alter sequence public.payos_order_code_seq no maxvalue;
