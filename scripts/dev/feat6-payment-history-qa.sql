-- FEAT6 QA: dữ liệu để Owner kiểm tra lịch sử thanh toán trong /profile và thẻ thanh toán gọn trong /learn.
-- Chỉ chạy trên DB local gốc (cổng 45322) bằng psql; không phải seed, không chạy trên runtime E2E tách biệt (45442) hay hosted,
-- và không dùng `supabase db reset`.
-- Cách chạy: psql -h 127.0.0.1 -p 45322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f scripts/dev/feat6-payment-history-qa.sql
-- Chạy lặp lại an toàn: id cố định và `on conflict (id) do nothing`.
--
-- Tài khoản: student@gmail.com (33333333-3333-4333-8333-333333333333), vốn đã có 5 khoản thanh toán B2 (4 đang chờ, 1 đã trả).
-- Fixture thêm cho học viên này 13 dòng, trong đó 12 dòng tính vào lịch sử (dòng `gateway = 'free'` không hiện):
--   - 8 dòng đã kết thúc: paid, cancelled, expired, failed; 2 dòng có giảm giá (amount_discount > 0);
--   - 1 dòng paid trên khóa học nháp mà học viên không đọc được (hiện "Khóa học không còn khả dụng");
--   - 1 dòng paid miễn phí (gateway = 'free') để kiểm tra dòng này bị loại;
--   - 2 dòng đang chờ cùng expires_at = 2090-01-01 (sớm hơn các dòng seed hạn 2099; dòng created_at mới hơn đứng trước);
--   - 1 dòng đang chờ có expires_at null (đứng cuối trong thẻ /learn, không có dòng "Hạn").
-- Cộng 5 dòng seed là 17 dòng không miễn phí, nên danh sách "Tất cả" có 4 trang (5 dòng mỗi trang).
-- Các dòng đang chờ đặt trên khóa học 7, 8, 9 của B2 nơi học viên chưa có khoản đang chờ nào, để không vi phạm uq_active_payment.

begin;

insert into public.courses (id, title, slug, price, status)
values (
  'f6000000-0000-4000-8000-000000000001',
  'FEAT6 QA khóa học nháp không đọc được',
  'feat6-qa-unreadable-draft',
  250000,
  'draft'
)
on conflict (id) do nothing;

insert into public.payments (
  id, user_id, course_id, amount_original, amount_discount, amount_final,
  currency, status, gateway, gateway_order_id, created_at, expires_at
)
values
  -- Đã kết thúc.
  ('f6700001-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000001',
   159000, 0, 159000, 'VND', 'paid', 'local-seed', 'feat6-qa-payment-01', '2026-09-28 08:00:00+00', null),
  ('f6700001-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000002',
   200000, 40000, 160000, 'VND', 'paid', 'local-seed', 'feat6-qa-payment-02', '2026-09-26 08:00:00+00', null),
  ('f6700001-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000003',
   179000, 0, 179000, 'VND', 'cancelled', 'local-seed', 'feat6-qa-payment-03', '2026-09-24 08:00:00+00', null),
  ('f6700001-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000007',
   189000, 0, 189000, 'VND', 'expired', 'local-seed', 'feat6-qa-payment-04', '2026-09-22 08:00:00+00', '2026-09-23 08:00:00+00'),
  ('f6700001-0000-4000-8000-000000000005', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000008',
   169000, 0, 169000, 'VND', 'failed', 'local-seed', 'feat6-qa-payment-05', '2026-09-20 08:00:00+00', null),
  ('f6700001-0000-4000-8000-000000000006', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000009',
   300000, 60000, 240000, 'VND', 'paid', 'local-seed', 'feat6-qa-payment-06', '2026-09-18 08:00:00+00', null),
  ('f6700001-0000-4000-8000-000000000007', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000001',
   159000, 0, 159000, 'VND', 'cancelled', 'local-seed', 'feat6-qa-payment-07', '2026-09-16 08:00:00+00', null),
  ('f6700001-0000-4000-8000-000000000008', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000002',
   200000, 0, 200000, 'VND', 'expired', 'local-seed', 'feat6-qa-payment-08', '2026-09-14 08:00:00+00', '2026-09-15 08:00:00+00'),
  -- Miễn phí: bị loại khỏi lịch sử.
  ('f6700001-0000-4000-8000-000000000009', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000003',
   0, 0, 0, 'VND', 'paid', 'free', 'FREE-feat6-qa-09', '2026-09-12 08:00:00+00', null),
  -- Khóa học học viên không đọc được (nháp, chưa ghi danh).
  ('f6700001-0000-4000-8000-000000000010', '33333333-3333-4333-8333-333333333333', 'f6000000-0000-4000-8000-000000000001',
   250000, 0, 250000, 'VND', 'paid', 'local-seed', 'feat6-qa-payment-10', '2026-09-10 08:00:00+00', null),
  -- Đang chờ: hai dòng cùng hạn, một dòng không có hạn.
  ('f6700001-0000-4000-8000-000000000011', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000007',
   189000, 0, 189000, 'VND', 'pending', 'local-seed', 'feat6-qa-payment-11', '2026-09-30 08:00:00+00', '2090-01-01 00:00:00+00'),
  ('f6700001-0000-4000-8000-000000000012', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000008',
   169000, 0, 169000, 'VND', 'creating', 'local-seed', 'feat6-qa-payment-12', '2026-09-29 08:00:00+00', '2090-01-01 00:00:00+00'),
  ('f6700001-0000-4000-8000-000000000013', '33333333-3333-4333-8333-333333333333', 'b2000000-0000-4000-8000-000000000009',
   300000, 0, 300000, 'VND', 'pending', 'local-seed', 'feat6-qa-payment-13', '2026-09-27 08:00:00+00', null)
on conflict (id) do nothing;

commit;
