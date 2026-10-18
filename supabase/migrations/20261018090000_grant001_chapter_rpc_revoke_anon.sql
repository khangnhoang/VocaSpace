-- GRANT-001: các migration trước chỉ revoke từ public, nên quyền execute mặc định Supabase cấp cho anon vẫn còn.
-- Thu hồi riêng anon, giữ authenticated và service_role như hiện tại (cùng mẫu với move_topic_order, rename_chapter).
revoke all on function public.create_chapter_ordered(uuid, text) from anon;
revoke all on function public.move_chapter_order(uuid, text) from anon;
